import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import type {
  DashboardError,
  DashboardIpcResponse,
  DashboardPayload,
  DisplayUnits,
  SaveDesktopSettingsInput
} from "@nightscout/shared-types";
import { NightscoutHttpClient, computeTrendSummary } from "./nightscoutClient";
import { SettingsStore } from "./settingsStore";

const settingsStore = new SettingsStore();

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

  const client = new NightscoutHttpClient({
    baseUrl,
    readToken,
    timeoutMs: 10_000
  });

  try {
    const entries = await client.get24hSeries();
    const summary = computeTrendSummary(entries);

    const payload: DashboardPayload = {
      entries,
      summary,
      fetchedAt: new Date().toISOString(),
      source: "network",
      stale: false
    };

    settingsStore.setCachedPayload(payload);

    return {
      payload,
      error: null
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
    width: 1220,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    title: "Nightscout Desktop",
    backgroundColor: "#071019",
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

  return window;
}

function registerIpcHandlers(): void {
  ipcMain.handle("desktop:get-settings", async () => settingsStore.getPublicSettings());

  ipcMain.handle("desktop:save-settings", async (_event, input: unknown) => {
    const payload = sanitizeSaveInput(input);
    return settingsStore.saveSettings(payload);
  });

  ipcMain.handle("desktop:remove-read-token", async () => settingsStore.removeReadToken());

  ipcMain.handle("desktop:get-dashboard", async () => fetchDashboardData());
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
