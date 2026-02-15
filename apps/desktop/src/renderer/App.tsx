import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import type {
  DashboardError,
  DashboardPayload,
  DisplayUnits,
  InsulinRatioWindow,
  InsulinTherapyProfile,
  LanguageCode,
  NightscoutDesktopSettings,
  TargetRangeWindow,
  WidgetLayout
} from "@nightscout/shared-types";
import { AppHeader } from "../components/header/AppHeader";
import { BurgerMenu } from "../components/navigation/BurgerMenu";
import { WidgetView } from "../components/widget/WidgetView";
import { createTranslator } from "../i18n/translations";
import { calculateTimeInRange, toChartData } from "../lib/dashboard";
import { formatTimestamp } from "../lib/format";
import {
  computeHealthScore,
  computeInsulinSensitivityInsight,
  detectInferredMeals
} from "../lib/insights";
import { BolusPage } from "../page/BolusPage";
import { HomePage } from "../page/HomePage";
import { SettingsPage } from "../page/SettingsPage";
import {
  calculateInsulinAdvice,
  computeIobCobFromTreatments,
  glucoseFromMgdlToGL
} from "./insulinAdvisor";

const REFRESH_INTERVAL_MS = 60_000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

function getCurrentLocalTimeHHMM(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function parseNumericInput(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return null;
  }

  return value;
}

function createDefaultRatioWindow(): InsulinRatioWindow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startHHMM: "12:00",
    endHHMM: "12:59",
    gramsPerUnit: 10
  };
}

function createDefaultTargetWindow(): TargetRangeWindow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startHHMM: "12:00",
    endHHMM: "12:59",
    lowGL: 0.8,
    highGL: 1.3
  };
}

function nextWidgetLayout(layout: WidgetLayout): WidgetLayout {
  if (layout === "minimal") {
    return "compact";
  }
  if (layout === "compact") {
    return "chart";
  }
  return "minimal";
}

export function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<NightscoutDesktopSettings | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [dashboardError, setDashboardError] = useState<DashboardError | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingIntegrations, setIsSyncingIntegrations] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [isWidgetPinned, setIsWidgetPinned] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [baseUrlInput, setBaseUrlInput] = useState("");
  const [readTokenInput, setReadTokenInput] = useState("");
  const [unitsInput, setUnitsInput] = useState<DisplayUnits>("mmol");
  const [integrationApiUrlInput, setIntegrationApiUrlInput] = useState("");
  const [integrationReadTokenInput, setIntegrationReadTokenInput] = useState("");
  const [languageInput, setLanguageInput] = useState<LanguageCode>("fr");
  const [startWithWindowsInput, setStartWithWindowsInput] = useState(false);
  const [widgetLayoutInput, setWidgetLayoutInput] = useState<WidgetLayout>("compact");
  const [insulinProfileDraft, setInsulinProfileDraft] = useState<InsulinTherapyProfile | null>(
    null
  );
  const [carbsInput, setCarbsInput] = useState("");
  const [glucoseGLInput, setGlucoseGLInput] = useState("");
  const [mealTimeInput, setMealTimeInput] = useState(getCurrentLocalTimeHHMM());

  const isWidgetMode = location.pathname === "/widget";
  const activeUnits = settings?.units ?? unitsInput;
  const activeLanguage = settings?.appPreferences.language ?? languageInput;
  const t = useMemo(() => createTranslator(activeLanguage), [activeLanguage]);
  const activeProfile = insulinProfileDraft ?? settings?.insulinProfile ?? null;
  const activeWidgetLayout = settings?.appPreferences.widgetLayout ?? widgetLayoutInput;

  const entries24h = useMemo(() => {
    if (!dashboard) {
      return [];
    }
    const cutoff = Date.now() - DAY_IN_MS;
    return dashboard.entries.filter((entry) => entry.date >= cutoff).sort((a, b) => b.date - a.date);
  }, [dashboard]);

  const chartData = useMemo(() => toChartData(entries24h, activeUnits), [entries24h, activeUnits]);

  const miniChartData = useMemo(() => {
    if (!dashboard) {
      return [];
    }
    const cutoff = Date.now() - THREE_HOURS_MS;
    const entries = dashboard.entries.filter((entry) => entry.date >= cutoff);
    return toChartData(entries, activeUnits);
  }, [dashboard, activeUnits]);

  const meals24h = useMemo(() => {
    if (!dashboard) {
      return [];
    }
    const cutoff = Date.now() - DAY_IN_MS;
    return dashboard.meals
      .filter((meal) => Date.parse(meal.eatenAt) >= cutoff)
      .sort((a, b) => Date.parse(a.eatenAt) - Date.parse(b.eatenAt));
  }, [dashboard]);

  const iobCob = useMemo(() => {
    if (!dashboard || !activeProfile) {
      return { iobUnits: 0, cobGrams: 0 };
    }
    return computeIobCobFromTreatments(dashboard.treatments, activeProfile);
  }, [dashboard, activeProfile]);

  const tirStats = useMemo(() => {
    if (!dashboard || !activeProfile) {
      return null;
    }
    return calculateTimeInRange(dashboard.entries, activeProfile);
  }, [dashboard, activeProfile]);

  const inferredMeals = useMemo(() => detectInferredMeals(entries24h, meals24h), [entries24h, meals24h]);

  const sensitivityInsight = useMemo(() => {
    if (!dashboard || !activeProfile) {
      return {
        sampleCount: 0,
        averageDropPerUnitGL: null,
        suggestedCorrectionFactorGL: null,
        confidence: "low" as const
      };
    }
    return computeInsulinSensitivityInsight(
      dashboard.entries,
      dashboard.treatments,
      activeProfile
    );
  }, [dashboard, activeProfile]);

  const healthScore = useMemo(() => {
    if (!dashboard || !activeProfile) {
      return null;
    }
    return computeHealthScore(dashboard.entries, activeProfile);
  }, [dashboard, activeProfile]);

  const liveGlucoseGL = useMemo(() => {
    if (dashboard?.summary.current === null || dashboard?.summary.current === undefined) {
      return null;
    }
    return glucoseFromMgdlToGL(dashboard.summary.current);
  }, [dashboard?.summary.current]);

  const insulinAdvisorState = useMemo(() => {
    const carbs = parseNumericInput(carbsInput);
    const currentGlucoseGL = parseNumericInput(glucoseGLInput);

    if (!activeProfile) {
      return {
        advice: null,
        message: t("profileNotLoaded")
      };
    }

    if (!carbsInput.trim() || !glucoseGLInput.trim()) {
      return {
        advice: null,
        message: t("advisorAwaitingValues")
      };
    }

    if (carbs === null || currentGlucoseGL === null) {
      return {
        advice: null,
        message: t("advisorNumericOnly")
      };
    }

    try {
      const advice = calculateInsulinAdvice({
        carbsGrams: carbs,
        currentGlucoseGL,
        mealTimeHHMM: mealTimeInput,
        profile: activeProfile,
        iobUnits: iobCob.iobUnits,
        cobGrams: iobCob.cobGrams
      });

      return { advice, message: null };
    } catch (error) {
      return {
        advice: null,
        message: error instanceof Error ? error.message : t("advisorCalculationFailed")
      };
    }
  }, [activeProfile, carbsInput, glucoseGLInput, mealTimeInput, iobCob, t]);

  async function loadSettings(): Promise<void> {
    try {
      const nextSettings = await window.nightscoutApi.getSettings();
      setSettings(nextSettings);
      setBaseUrlInput(nextSettings.baseUrl);
      setUnitsInput(nextSettings.units);
      setIntegrationApiUrlInput(nextSettings.integrations.integrationApiUrl);
      setLanguageInput(nextSettings.appPreferences.language);
      setStartWithWindowsInput(nextSettings.appPreferences.startWithWindows);
      setWidgetLayoutInput(nextSettings.appPreferences.widgetLayout);
      setInsulinProfileDraft(nextSettings.insulinProfile);
      setConfigError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load settings.";
      setConfigError(message);
    }
  }

  async function refreshDashboard(showLoadingState = true): Promise<void> {
    if (showLoadingState) {
      setIsRefreshing(true);
    }

    try {
      const response = await window.nightscoutApi.getDashboard();
      setDashboard(response.payload);
      setDashboardError(response.error);
      setLastRefreshAt(new Date().toISOString());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to refresh dashboard.";
      setDashboardError({ message, canUseCachedData: false });
    } finally {
      if (showLoadingState) {
        setIsRefreshing(false);
      }
    }
  }

  useEffect(() => {
    void (async () => {
      await loadSettings();
      await refreshDashboard(true);
    })();

    const interval = setInterval(() => {
      void refreshDashboard(false);
    }, REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (glucoseGLInput.trim() || liveGlucoseGL === null) {
      return;
    }
    setGlucoseGLInput(liveGlucoseGL.toFixed(2));
  }, [liveGlucoseGL, glucoseGLInput]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  async function handleSaveConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const nextSettings = await window.nightscoutApi.saveSettings({
        baseUrl: baseUrlInput,
        readToken: readTokenInput.trim() ? readTokenInput.trim() : undefined,
        units: unitsInput
      });

      setSettings(nextSettings);
      setReadTokenInput("");
      setConfigError(null);
      await refreshDashboard(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save connection settings.";
      setConfigError(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveInsulinProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!insulinProfileDraft) {
      return;
    }

    setIsSaving(true);
    try {
      const nextSettings = await window.nightscoutApi.saveInsulinProfile(insulinProfileDraft);
      setSettings(nextSettings);
      setInsulinProfileDraft(nextSettings.insulinProfile);
      setConfigError(null);
      setSyncMessage(t("profileSaved"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save insulin profile.";
      setConfigError(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveReadToken() {
    try {
      const nextSettings = await window.nightscoutApi.removeReadToken();
      setSettings(nextSettings);
      setConfigError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove token.";
      setConfigError(message);
    }
  }

  async function handleSaveIntegrationSettings() {
    setIsSaving(true);
    try {
      const nextSettings = await window.nightscoutApi.saveIntegrationSettings({
        integrationApiUrl: integrationApiUrlInput,
        integrationReadToken: integrationReadTokenInput.trim()
          ? integrationReadTokenInput
          : undefined
      });
      setSettings(nextSettings);
      setIntegrationReadTokenInput("");
      setIntegrationApiUrlInput(nextSettings.integrations.integrationApiUrl);
      setConfigError(null);
      setSyncMessage(t("integrationSettingsSaved"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save integration settings.";
      setConfigError(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSyncIntegrations() {
    setIsSyncingIntegrations(true);
    try {
      const result = await window.nightscoutApi.syncIntegrations({
        integrationApiUrl: integrationApiUrlInput,
        integrationReadToken: integrationReadTokenInput.trim()
          ? integrationReadTokenInput
          : undefined
      });
      setSyncMessage(result.message);
      if (result.ok) {
        setIntegrationReadTokenInput("");
        await refreshDashboard(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Integrations sync failed.";
      setConfigError(message);
    } finally {
      setIsSyncingIntegrations(false);
    }
  }

  async function handleRemoveIntegrationToken() {
    setIsSaving(true);
    try {
      const nextSettings = await window.nightscoutApi.saveIntegrationSettings({
        integrationReadToken: ""
      });
      setSettings(nextSettings);
      setIntegrationReadTokenInput("");
      setConfigError(null);
      setSyncMessage(t("integrationTokenRemoved"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to remove integration token.";
      setConfigError(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveAppPreferences() {
    setIsSaving(true);
    try {
      const nextSettings = await window.nightscoutApi.saveAppPreferences({
        language: languageInput,
        startWithWindows: startWithWindowsInput,
        widgetLayout: widgetLayoutInput
      });
      setSettings(nextSettings);
      setLanguageInput(nextSettings.appPreferences.language);
      setStartWithWindowsInput(nextSettings.appPreferences.startWithWindows);
      setWidgetLayoutInput(nextSettings.appPreferences.widgetLayout);
      setConfigError(null);
      setSyncMessage(t("appSettingsSaved"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save app settings.";
      setConfigError(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleOpenWidget() {
    await window.nightscoutApi.openWidget();
  }

  async function handleCloseWidget() {
    await window.nightscoutApi.closeWidget();
  }

  async function handleToggleWidgetPinned() {
    const next = await window.nightscoutApi.setWidgetAlwaysOnTop(!isWidgetPinned);
    setIsWidgetPinned(next);
  }

  async function handleCycleWidgetLayout() {
    const nextLayout = nextWidgetLayout(activeWidgetLayout);
    setWidgetLayoutInput(nextLayout);
    try {
      const nextSettings = await window.nightscoutApi.saveAppPreferences({
        widgetLayout: nextLayout
      });
      setSettings(nextSettings);
      setSyncMessage(t("widgetLayoutSaved"));
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : "Failed to save widget layout.");
    }
  }

  function updateRatioWindow(
    windowId: string,
    field: keyof Omit<InsulinRatioWindow, "id">,
    value: string
  ) {
    if (!insulinProfileDraft) {
      return;
    }

    const updated = insulinProfileDraft.ratioWindows.map((window) => {
      if (window.id !== windowId) {
        return window;
      }

      if (field === "gramsPerUnit") {
        const parsed = Number(value.replace(",", "."));
        return {
          ...window,
          gramsPerUnit: Number.isFinite(parsed) ? parsed : window.gramsPerUnit
        };
      }

      return {
        ...window,
        [field]: value
      };
    });

    setInsulinProfileDraft({
      ...insulinProfileDraft,
      ratioWindows: updated
    });
  }

  function removeRatioWindow(windowId: string) {
    if (!insulinProfileDraft || insulinProfileDraft.ratioWindows.length <= 1) {
      return;
    }

    setInsulinProfileDraft({
      ...insulinProfileDraft,
      ratioWindows: insulinProfileDraft.ratioWindows.filter((window) => window.id !== windowId)
    });
  }

  function addRatioWindow() {
    if (!insulinProfileDraft) {
      return;
    }

    setInsulinProfileDraft({
      ...insulinProfileDraft,
      ratioWindows: [...insulinProfileDraft.ratioWindows, createDefaultRatioWindow()]
    });
  }

  function updateTargetWindow(
    windowId: string,
    field: keyof Omit<TargetRangeWindow, "id">,
    value: string
  ) {
    if (!insulinProfileDraft || !insulinProfileDraft.targetWindows) {
      return;
    }

    const updated = insulinProfileDraft.targetWindows.map((window) => {
      if (window.id !== windowId) {
        return window;
      }

      if (field === "lowGL" || field === "highGL") {
        const parsed = Number(value.replace(",", "."));
        return {
          ...window,
          [field]: Number.isFinite(parsed) ? parsed : window[field]
        };
      }

      return {
        ...window,
        [field]: value
      };
    });

    setInsulinProfileDraft({
      ...insulinProfileDraft,
      targetWindows: updated
    });
  }

  function removeTargetWindow(windowId: string) {
    if (!insulinProfileDraft || !insulinProfileDraft.targetWindows) {
      return;
    }
    if (insulinProfileDraft.targetWindows.length <= 1) {
      return;
    }

    setInsulinProfileDraft({
      ...insulinProfileDraft,
      targetWindows: insulinProfileDraft.targetWindows.filter((window) => window.id !== windowId)
    });
  }

  function addTargetWindow() {
    if (!insulinProfileDraft) {
      return;
    }

    setInsulinProfileDraft({
      ...insulinProfileDraft,
      targetWindows: [
        ...(insulinProfileDraft.targetWindows ?? []),
        createDefaultTargetWindow()
      ]
    });
  }

  function updateProfileNumberField(
    field:
      | "correctionFactorDropGLPerUnit"
      | "targetLowGL"
      | "targetHighGL"
      | "insulinActionHours"
      | "carbAbsorptionHours",
    value: string
  ) {
    if (!insulinProfileDraft) {
      return;
    }

    const parsed = Number(value.replace(",", "."));
    if (!Number.isFinite(parsed)) {
      return;
    }

    setInsulinProfileDraft({
      ...insulinProfileDraft,
      [field]: parsed
    });
  }

  if (isWidgetMode) {
    return (
      <WidgetView
        dashboard={dashboard}
        dashboardError={dashboardError}
        units={activeUnits}
        layout={activeWidgetLayout}
        miniChartData={miniChartData}
        lastRefreshAt={lastRefreshAt}
        isRefreshing={isRefreshing}
        onRefresh={() => {
          void refreshDashboard(true);
        }}
        onCloseWidget={() => {
          void handleCloseWidget();
        }}
        onTogglePinned={() => {
          void handleToggleWidgetPinned();
        }}
        onCycleLayout={() => {
          void handleCycleWidgetLayout();
        }}
        isPinned={isWidgetPinned}
      />
    );
  }

  const sourceLabel = dashboard?.source === "cache" ? t("sourceCache") : t("sourceLive");
  const lastRefreshLabel = `${t("updatedAt")}: ${formatTimestamp(lastRefreshAt)}`;

  return (
    <div className="app-shell">
      <BurgerMenu
        open={isMenuOpen}
        activePath={location.pathname}
        onClose={() => setIsMenuOpen(false)}
        onNavigate={(path) => navigate(path)}
        t={t}
      />

      <AppHeader
        sourceLabel={sourceLabel}
        lastRefreshAtLabel={lastRefreshLabel}
        onOpenWidget={() => {
          void handleOpenWidget();
        }}
        onRefresh={() => {
          void refreshDashboard(true);
        }}
        onToggleMenu={() => setIsMenuOpen(true)}
        isRefreshing={isRefreshing}
        t={t}
      />

      {configError ? <p className="error-banner">{configError}</p> : null}
      {syncMessage ? <p className="warn-banner">{syncMessage}</p> : null}
      {dashboardError ? <p className="warn-banner">{dashboardError.message}</p> : null}

      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              dashboard={dashboard}
              units={activeUnits}
              chartData={chartData}
              meals24h={meals24h}
              inferredMeals={inferredMeals}
              iobCob={iobCob}
              tirStats={tirStats}
              healthScore={healthScore}
              t={t}
            />
          }
        />
        <Route
          path="/bolus"
          element={
            <BolusPage
              carbsInput={carbsInput}
              onCarbsInput={setCarbsInput}
              glucoseGLInput={glucoseGLInput}
              onGlucoseGLInput={setGlucoseGLInput}
              mealTimeInput={mealTimeInput}
              onMealTimeInput={setMealTimeInput}
              liveGlucoseGL={liveGlucoseGL}
              iobUnits={iobCob.iobUnits}
              cobGrams={iobCob.cobGrams}
              advisor={insulinAdvisorState.advice}
              advisorMessage={insulinAdvisorState.message}
              sensitivity={sensitivityInsight}
              onUseLiveGlucose={() => {
                if (liveGlucoseGL !== null) {
                  setGlucoseGLInput(liveGlucoseGL.toFixed(2));
                }
              }}
              t={t}
            />
          }
        />
        <Route
          path="/settings"
          element={
            <SettingsPage
              baseUrlInput={baseUrlInput}
              onBaseUrlInput={setBaseUrlInput}
              readTokenInput={readTokenInput}
              onReadTokenInput={setReadTokenInput}
              unitsInput={unitsInput}
              onUnitsInput={setUnitsInput}
              integrationApiUrlInput={integrationApiUrlInput}
              onIntegrationApiUrlInput={setIntegrationApiUrlInput}
              integrationReadTokenInput={integrationReadTokenInput}
              onIntegrationReadTokenInput={setIntegrationReadTokenInput}
              languageInput={languageInput}
              onLanguageInput={setLanguageInput}
              startWithWindowsInput={startWithWindowsInput}
              onStartWithWindowsInput={setStartWithWindowsInput}
              widgetLayoutInput={widgetLayoutInput}
              onWidgetLayoutInput={setWidgetLayoutInput}
              insulinProfileDraft={insulinProfileDraft}
              onSaveInsulinProfile={(event) => {
                void handleSaveInsulinProfile(event);
              }}
              onAddRatioWindow={addRatioWindow}
              onRemoveRatioWindow={removeRatioWindow}
              onUpdateRatioWindow={updateRatioWindow}
              onAddTargetWindow={addTargetWindow}
              onRemoveTargetWindow={removeTargetWindow}
              onUpdateTargetWindow={updateTargetWindow}
              onUpdateProfileNumber={updateProfileNumberField}
              hasReadToken={Boolean(settings?.hasReadToken)}
              hasIntegrationReadToken={Boolean(settings?.integrations.hasIntegrationReadToken)}
              isSaving={isSaving}
              isSyncingIntegrations={isSyncingIntegrations}
              onSaveConnection={(event) => {
                void handleSaveConnection(event);
              }}
              onRemoveReadToken={() => {
                void handleRemoveReadToken();
              }}
              onSaveIntegration={() => {
                void handleSaveIntegrationSettings();
              }}
              onSyncIntegrations={() => {
                void handleSyncIntegrations();
              }}
              onRemoveIntegrationToken={() => {
                void handleRemoveIntegrationToken();
              }}
              onSaveAppPreferences={() => {
                void handleSaveAppPreferences();
              }}
              t={t}
            />
          }
        />
        <Route path="/widget" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
