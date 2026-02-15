import { Menu, app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import type {
  DashboardError,
  DashboardIpcResponse,
  DashboardPayload,
  DisplayUnits,
  InsulinTherapyProfile,
  SaveAppPreferencesInput,
  SaveDesktopSettingsInput,
  SaveIntegrationSettingsInput,
  SyncResponse
} from "@nightscout/shared-types";
import { IntegrationsHttpClient } from "./integrationsClient";
import { NightscoutHttpClient, computeTrendSummary } from "./nightscoutClient";
import { SettingsStore } from "./settingsStore";

const settingsStore = new SettingsStore();
let mainWindow: BrowserWindow | null = null;
let widgetWindow: BrowserWindow | null = null;

function sanitizeUnits(units: unknown): DisplayUnits {
  return units === "mg/dL" ? "mg/dL" : "mmol";
}

function sanitizeSaveInput(input: unknown): SaveDesktopSettingsInput {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid settings payload.");
  }

  const candidate = input as Partial<SaveDesktopSettingsInput>;

  return {
    baseUrl: String(candidate.baseUrl ?? "").trim(),
    units: sanitizeUnits(candidate.units),
    readToken:
      typeof candidate.readToken === "string" ? candidate.readToken : undefined
  };
}

function sanitizeIntegrationInput(input: unknown): SaveIntegrationSettingsInput {
  if (!input || typeof input !== "object") {
    return {};
  }

  const candidate = input as Partial<SaveIntegrationSettingsInput>;

  return {
    integrationApiUrl:
      typeof candidate.integrationApiUrl === "string"
        ? candidate.integrationApiUrl
        : undefined,
    integrationReadToken:
      typeof candidate.integrationReadToken === "string"
        ? candidate.integrationReadToken
        : undefined
  };
}

function sanitizeAppPreferencesInput(input: unknown): SaveAppPreferencesInput {
  if (!input || typeof input !== "object") {
    return {};
  }

  const candidate = input as Partial<SaveAppPreferencesInput>;
  return {
    language:
      candidate.language === "en" || candidate.language === "fr"
        ? candidate.language
        : undefined,
    startWithWindows:
      typeof candidate.startWithWindows === "boolean"
        ? candidate.startWithWindows
        : undefined,
    widgetLayout:
      candidate.widgetLayout === "minimal" ||
      candidate.widgetLayout === "compact" ||
      candidate.widgetLayout === "chart"
        ? candidate.widgetLayout
        : undefined
  };
}

function setStartWithWindows(enabled: boolean): void {
  if (process.platform !== "win32" && process.platform !== "darwin") {
    return;
  }

  app.setLoginItemSettings({
    openAtLogin: enabled
  });
}

function getStartWithWindows(): boolean {
  if (process.platform !== "win32" && process.platform !== "darwin") {
    return false;
  }

  return app.getLoginItemSettings().openAtLogin;
}

function toDashboardError(error: unknown, canUseCachedData: boolean): DashboardError {
  const fallbackMessage = "Unable to load Nightscout data.";

  if (error instanceof Error) {
    return {
      message: error.message || fallbackMessage,
      canUseCachedData
    };
  }

  return {
    message: fallbackMessage,
    canUseCachedData
  };
}

async function fetchDashboardData(): Promise<DashboardIpcResponse> {
  const baseUrl = settingsStore.getBaseUrl();

  if (!baseUrl) {
    return {
      payload: null,
      error: {
        message: "Configure Nightscout base URL in settings.",
        canUseCachedData: false
      }
    };
  }

  const readToken = await settingsStore.getReadToken();

  if (!readToken) {
    return {
      payload: null,
      error: {
        message: "Configure a read token in settings.",
        canUseCachedData: false
      }
    };
  }

  const nightscoutClient = new NightscoutHttpClient({
    baseUrl,
    readToken,
    timeoutMs: 10_000
  });

  try {
    const [entries, treatments] = await Promise.all([
      nightscoutClient.getEntriesForDays(30),
      nightscoutClient.getTreatmentsForDays(7)
    ]);

    const summary = computeTrendSummary(entries);
    let healthConnect: DashboardPayload["healthConnect"] = null;
    let meals: DashboardPayload["meals"] = [];
    let integrationError: DashboardError | null = null;

    const integrationApiUrl = settingsStore.getIntegrationApiUrl();
    const integrationReadToken = await settingsStore.getIntegrationReadToken();

    if (integrationApiUrl && integrationReadToken) {
      try {
        const integrationsClient = new IntegrationsHttpClient({
          baseUrl: integrationApiUrl,
          readToken: integrationReadToken,
          timeoutMs: 10_000
        });

        const [nextSummary, nextMeals] = await Promise.all([
          integrationsClient.getHealthSummary(),
          integrationsClient.getMeals(30)
        ]);

        healthConnect = nextSummary;
        meals = nextMeals;
      } catch (error) {
        integrationError = {
          message:
            error instanceof Error
              ? `Integrations API unavailable: ${error.message}`
              : "Integrations API unavailable.",
          canUseCachedData: true
        };
      }
    }

    const payload: DashboardPayload = {
      entries,
      summary,
      treatments,
      meals,
      healthConnect,
      fetchedAt: new Date().toISOString(),
      source: "network",
      stale: false
    };

    settingsStore.setCachedPayload(payload);

    return {
      payload,
      error: integrationError
    };
  } catch (error) {
    const cachedPayload = settingsStore.getCachedPayload();

    if (!cachedPayload) {
      return {
        payload: null,
        error: toDashboardError(error, false)
      };
    }

    const stalePayload: DashboardPayload = {
      ...cachedPayload,
      source: "cache",
      stale: true
    };

    return {
      payload: stalePayload,
      error: toDashboardError(error, true)
    };
  }
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1320,
    height: 920,
    minWidth: 1024,
    minHeight: 720,
    title: "Nightscout Desktop",
    backgroundColor: "#071019",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    window.loadURL(devServerUrl).catch((error) => {
      console.error("Failed to load dev server", error);
    });
  } else {
    window
      .loadFile(path.resolve(__dirname, "../renderer/index.html"))
      .catch((error) => {
        console.error("Failed to load renderer bundle", error);
      });
  }

  window.setMenuBarVisibility(false);

  return window;
}

function createWidgetWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 300,
    height: 190,
    minWidth: 280,
    minHeight: 160,
    maxWidth: 420,
    maxHeight: 260,
    title: "Nightscout Widget",
    backgroundColor: "#061019",
    alwaysOnTop: true,
    frame: false,
    transparent: false,
    movable: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    window.loadURL(`${devServerUrl}#/widget`).catch((error) => {
      console.error("Failed to load widget dev server", error);
    });
  } else {
    window
      .loadFile(path.resolve(__dirname, "../renderer/index.html"), { hash: "/widget" })
      .catch((error) => {
        console.error("Failed to load widget renderer bundle", error);
      });
  }

  return window;
}

function getOrCreateWidgetWindow(): BrowserWindow {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    return widgetWindow;
  }

  widgetWindow = createWidgetWindow();
  widgetWindow.on("closed", () => {
    widgetWindow = null;
  });

  return widgetWindow;
}

function registerIpcHandlers(): void {
  ipcMain.handle("desktop:get-settings", async () => settingsStore.getPublicSettings());

  ipcMain.handle("desktop:save-settings", async (_event, input: unknown) => {
    const payload = sanitizeSaveInput(input);
    return settingsStore.saveSettings(payload);
  });

  ipcMain.handle("desktop:remove-read-token", async () => settingsStore.removeReadToken());
  ipcMain.handle("desktop:get-dashboard", async () => fetchDashboardData());

  ipcMain.handle("desktop:save-insulin-profile", async (_event, input: unknown) => {
    if (!input || typeof input !== "object") {
      throw new Error("Invalid insulin profile payload.");
    }

    settingsStore.saveInsulinProfile(input as InsulinTherapyProfile);
    return settingsStore.getPublicSettings();
  });

  ipcMain.handle("desktop:save-integration-settings", async (_event, input: unknown) => {
    const payload = sanitizeIntegrationInput(input);
    await settingsStore.saveIntegrationSettings(payload);
    return settingsStore.getPublicSettings();
  });

  ipcMain.handle("desktop:save-app-preferences", async (_event, input: unknown) => {
    const payload = sanitizeAppPreferencesInput(input);
    const nextPreferences = await settingsStore.saveAppPreferences(payload);
    setStartWithWindows(nextPreferences.startWithWindows);
    return settingsStore.getPublicSettings();
  });

  ipcMain.handle("desktop:sync-integrations", async (_event, input: unknown) => {
    const payload = sanitizeIntegrationInput(input);
    if (Object.keys(payload).length > 0) {
      await settingsStore.saveIntegrationSettings(payload);
    }

    const integrationApiUrl = settingsStore.getIntegrationApiUrl();
    const integrationReadToken = await settingsStore.getIntegrationReadToken();

    if (!integrationApiUrl || !integrationReadToken) {
      return {
        ok: false,
        message: "Configure Integrations API URL and read token first."
      } satisfies SyncResponse;
    }

    const integrationsClient = new IntegrationsHttpClient({
      baseUrl: integrationApiUrl,
      readToken: integrationReadToken,
      timeoutMs: 10_000
    });

    const [summary, meals] = await Promise.all([
      integrationsClient.getHealthSummary(),
      integrationsClient.getMeals(30)
    ]);

    return {
      ok: true,
      message: `Integrations synced (${meals.length} meals, summary ${
        summary ? "available" : "missing"
      }).`
    } satisfies SyncResponse;
  });

  ipcMain.handle("desktop:widget-open", async () => {
    const widget = getOrCreateWidgetWindow();
    widget.show();
    widget.focus();
    return true;
  });

  ipcMain.handle("desktop:widget-close", async () => {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.close();
    }
    return true;
  });

  ipcMain.handle("desktop:widget-set-always-on-top", async (_event, isPinned: unknown) => {
    const widget = getOrCreateWidgetWindow();
    widget.setAlwaysOnTop(Boolean(isPinned));
    return widget.isAlwaysOnTop();
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerIpcHandlers();
  const currentPreferences = settingsStore.getAppPreferences();
  const shouldStartWithWindows =
    typeof currentPreferences.startWithWindows === "boolean"
      ? currentPreferences.startWithWindows
      : getStartWithWindows();
  setStartWithWindows(shouldStartWithWindows);
  void settingsStore.saveAppPreferences({ startWithWindows: shouldStartWithWindows });
  mainWindow = createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
