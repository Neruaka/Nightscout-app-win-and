import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type {
  DashboardError,
  DashboardPayload,
  DisplayUnits,
  GlucoseEntry,
  InsulinRatioWindow,
  InsulinTherapyProfile,
  NightscoutDesktopSettings,
  TimeInRangeBucket,
  TimeInRangeStats
} from "@nightscout/shared-types";
import {
  calculateInsulinAdvice,
  computeIobCobFromTreatments,
  glucoseFromMgdlToGL
} from "./insulinAdvisor";

const REFRESH_INTERVAL_MS = 60_000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const DIRECTION_TO_ARROW: Record<string, string> = {
  DoubleUp: "++",
  SingleUp: "+",
  FortyFiveUp: "/",
  Flat: "=",
  FortyFiveDown: "\\",
  SingleDown: "-",
  DoubleDown: "--",
  NONE: "?",
  NOT_COMPUTABLE: "?",
  RATE_OUT_OF_RANGE: "!"
};

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function toDisplayValue(rawMgdl: number, units: DisplayUnits): number {
  if (units === "mmol") {
    return Number((rawMgdl / 18).toFixed(1));
  }
  return Math.round(rawMgdl);
}

function formatGlucose(rawMgdl: number | null, units: DisplayUnits): string {
  if (rawMgdl === null) {
    return "--";
  }
  return `${toDisplayValue(rawMgdl, units)} ${units}`;
}

function formatDelta(rawMgdl: number | null, units: DisplayUnits): string {
  if (rawMgdl === null) {
    return "--";
  }
  const value = toDisplayValue(rawMgdl, units);
  const sign = value > 0 ? "+" : "";
  return `${sign}${value} ${units}`;
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleString();
}

function mapTrend(direction: string | null): string {
  if (!direction) {
    return "?";
  }
  return DIRECTION_TO_ARROW[direction] ?? direction;
}

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

function formatDateTick(value: number): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function toChartData(entries: GlucoseEntry[], units: DisplayUnits) {
  return [...entries]
    .sort((a, b) => a.date - b.date)
    .map((entry) => ({
      ts: entry.date,
      sgv: toDisplayValue(entry.sgv, units),
      raw: entry.sgv
    }));
}

function createDefaultRatioWindow(): InsulinRatioWindow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startHHMM: "12:00",
    endHHMM: "12:59",
    gramsPerUnit: 10
  };
}

function createEmptyTirBucket(label: TimeInRangeBucket["label"]): TimeInRangeBucket {
  return {
    label,
    from: new Date(0).toISOString(),
    to: new Date(0).toISOString(),
    count: 0,
    inRangePct: 0,
    lowPct: 0,
    highPct: 0,
    avgGL: null
  };
}

function calculateTirBucket(
  entries: GlucoseEntry[],
  periodMs: number,
  targetLowGL: number,
  targetHighGL: number,
  label: TimeInRangeBucket["label"]
): TimeInRangeBucket {
  const to = Date.now();
  const from = to - periodMs;
  const scoped = entries.filter((entry) => entry.date >= from && entry.date <= to);

  if (scoped.length === 0) {
    return {
      ...createEmptyTirBucket(label),
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString()
    };
  }

  let lowCount = 0;
  let inRangeCount = 0;
  let highCount = 0;
  let totalGL = 0;

  for (const entry of scoped) {
    const glucoseGL = entry.sgv / 100;
    totalGL += glucoseGL;

    if (glucoseGL < targetLowGL) {
      lowCount += 1;
    } else if (glucoseGL > targetHighGL) {
      highCount += 1;
    } else {
      inRangeCount += 1;
    }
  }

  const count = scoped.length;
  return {
    label,
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    count,
    inRangePct: round2((inRangeCount / count) * 100),
    lowPct: round2((lowCount / count) * 100),
    highPct: round2((highCount / count) * 100),
    avgGL: round2(totalGL / count)
  };
}

function calculateTimeInRange(
  entries: GlucoseEntry[],
  profile: InsulinTherapyProfile
): TimeInRangeStats {
  return {
    day: calculateTirBucket(entries, DAY_IN_MS, profile.targetLowGL, profile.targetHighGL, "day"),
    week: calculateTirBucket(entries, 7 * DAY_IN_MS, profile.targetLowGL, profile.targetHighGL, "week"),
    month: calculateTirBucket(entries, 30 * DAY_IN_MS, profile.targetLowGL, profile.targetHighGL, "month")
  };
}

async function loadSettingsIntoState(
  setSettings: (value: NightscoutDesktopSettings) => void,
  setBaseUrl: (value: string) => void,
  setUnits: (value: DisplayUnits) => void,
  setInsulinProfileDraft: (value: InsulinTherapyProfile) => void,
  setIntegrationApiUrlInput: (value: string) => void,
  setConfigError: (value: string | null) => void
): Promise<void> {
  try {
    const nextSettings = await window.nightscoutApi.getSettings();
    setSettings(nextSettings);
    setBaseUrl(nextSettings.baseUrl);
    setUnits(nextSettings.units);
    setInsulinProfileDraft(nextSettings.insulinProfile);
    setIntegrationApiUrlInput(nextSettings.integrations.integrationApiUrl);
    setConfigError(null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load settings.";
    setConfigError(message);
  }
}

function WidgetView(props: {
  dashboard: DashboardPayload | null;
  dashboardError: DashboardError | null;
  units: DisplayUnits;
  lastRefreshAt: string | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  onCloseWidget: () => void;
  onTogglePinned: () => void;
  isPinned: boolean;
}) {
  const sourceLabel = props.dashboard?.source === "cache" ? "Cache" : "Live";

  return (
    <div className="widget-shell">
      <div className="widget-topbar">
        <span className="widget-title">Nightscout Widget</span>
        <div className="widget-actions">
          <button
            type="button"
            className="widget-btn"
            onClick={props.onTogglePinned}
            title="Toggle always-on-top"
          >
            {props.isPinned ? "Unpin" : "Pin"}
          </button>
          <button type="button" className="widget-btn" onClick={props.onCloseWidget} title="Close widget">
            X
          </button>
        </div>
      </div>

      <div className="widget-main">
        <p className="widget-value">
          {formatGlucose(props.dashboard?.summary.current ?? null, props.units)}
        </p>
        <p className="widget-meta">
          Trend {mapTrend(props.dashboard?.summary.direction ?? null)} / Delta{" "}
          {formatDelta(props.dashboard?.summary.delta ?? null, props.units)}
        </p>
        <p className="widget-meta">Updated {formatTimestamp(props.dashboard?.summary.updatedAt ?? null)}</p>
      </div>

      <div className="widget-footer">
        <span>{sourceLabel}</span>
        <button type="button" className="widget-btn" onClick={props.onRefresh} disabled={props.isRefreshing}>
          {props.isRefreshing ? "..." : "Refresh"}
        </button>
      </div>

      {props.dashboardError ? <p className="widget-error">{props.dashboardError.message}</p> : null}
      <p className="widget-refresh">Last refresh {formatTimestamp(props.lastRefreshAt)}</p>
    </div>
  );
}

export function App() {
  const [settings, setSettings] = useState<NightscoutDesktopSettings | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [dashboardError, setDashboardError] = useState<DashboardError | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingIntegrations, setIsSyncingIntegrations] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [baseUrlInput, setBaseUrlInput] = useState("");
  const [readTokenInput, setReadTokenInput] = useState("");
  const [unitsInput, setUnitsInput] = useState<DisplayUnits>("mmol");
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [carbsInput, setCarbsInput] = useState("");
  const [glucoseGLInput, setGlucoseGLInput] = useState("");
  const [mealTimeInput, setMealTimeInput] = useState(getCurrentLocalTimeHHMM());
  const [insulinProfileDraft, setInsulinProfileDraft] = useState<InsulinTherapyProfile | null>(null);
  const [integrationApiUrlInput, setIntegrationApiUrlInput] = useState("");
  const [integrationReadTokenInput, setIntegrationReadTokenInput] = useState("");
  const [isWidgetPinned, setIsWidgetPinned] = useState(true);

  const isWidgetMode = window.location.hash === "#widget";
  const activeUnits = settings?.units ?? unitsInput;
  const activeProfile = insulinProfileDraft ?? settings?.insulinProfile ?? null;

  const entries24h = useMemo(() => {
    if (!dashboard) {
      return [];
    }
    const cutoff = Date.now() - DAY_IN_MS;
    return dashboard.entries.filter((entry) => entry.date >= cutoff).sort((a, b) => b.date - a.date);
  }, [dashboard]);

  const chartData = useMemo(() => toChartData(entries24h, activeUnits), [entries24h, activeUnits]);

  const meals24h = useMemo(() => {
    if (!dashboard) {
      return [];
    }
    const cutoff = Date.now() - DAY_IN_MS;
    return dashboard.meals
      .filter((meal) => Date.parse(meal.eatenAt) >= cutoff)
      .sort((a, b) => Date.parse(a.eatenAt) - Date.parse(b.eatenAt));
  }, [dashboard]);

  const historyRows = useMemo(() => entries24h.slice(0, 36), [entries24h]);

  const liveGlucoseGL = useMemo(() => {
    if (dashboard?.summary.current === null || dashboard?.summary.current === undefined) {
      return null;
    }
    return glucoseFromMgdlToGL(dashboard.summary.current);
  }, [dashboard?.summary.current]);

  const iobCobSnapshot = useMemo(() => {
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

  const insulinAdvisorState = useMemo(() => {
    const carbs = parseNumericInput(carbsInput);
    const currentGlucoseGL = parseNumericInput(glucoseGLInput);

    if (!activeProfile) {
      return {
        advice: null,
        message: "Insulin profile is not loaded yet."
      };
    }

    if (!carbsInput.trim() || !glucoseGLInput.trim()) {
      return {
        advice: null,
        message: "Enter carbs and current glucose to calculate an estimate."
      };
    }

    if (carbs === null || currentGlucoseGL === null) {
      return {
        advice: null,
        message: "Carbs and glucose must be numeric values."
      };
    }

    try {
      const advice = calculateInsulinAdvice({
        carbsGrams: carbs,
        currentGlucoseGL,
        mealTimeHHMM: mealTimeInput,
        profile: activeProfile,
        iobUnits: iobCobSnapshot.iobUnits,
        cobGrams: iobCobSnapshot.cobGrams
      });

      return { advice, message: null };
    } catch (error) {
      return {
        advice: null,
        message: error instanceof Error ? error.message : "Unable to calculate insulin estimate."
      };
    }
  }, [activeProfile, carbsInput, glucoseGLInput, mealTimeInput, iobCobSnapshot]);

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
    let mounted = true;

    void (async () => {
      if (!mounted) {
        return;
      }

      await loadSettingsIntoState(
        setSettings,
        setBaseUrlInput,
        setUnitsInput,
        setInsulinProfileDraft,
        setIntegrationApiUrlInput,
        setConfigError
      );
      await refreshDashboard(true);
    })();

    const interval = setInterval(() => {
      void refreshDashboard(false);
    }, REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (glucoseGLInput.trim() || liveGlucoseGL === null) {
      return;
    }
    setGlucoseGLInput(liveGlucoseGL.toFixed(2));
  }, [liveGlucoseGL, glucoseGLInput]);
  async function handleSaveSettings(event: React.FormEvent<HTMLFormElement>) {
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
      const message = error instanceof Error ? error.message : "Failed to save settings.";
      setConfigError(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveInsulinProfile(event: React.FormEvent<HTMLFormElement>) {
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
      setSyncMessage("Insulin profile saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save insulin profile.";
      setConfigError(message);
    } finally {
      setIsSaving(false);
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
      setSyncMessage("Integration settings saved.");
      setConfigError(null);
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
      setConfigError(error instanceof Error ? error.message : "Integrations sync failed.");
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
      setSyncMessage("Integration token removed.");
      setConfigError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to remove integration token.";
      setConfigError(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveToken() {
    try {
      const nextSettings = await window.nightscoutApi.removeReadToken();
      setSettings(nextSettings);
      setConfigError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove token.";
      setConfigError(message);
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
      ratioWindows: insulinProfileDraft.ratioWindows.filter(
        (window) => window.id !== windowId
      )
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

  const sourceLabel = dashboard?.source === "cache" ? "Cache" : "Live API";
  const advisorStatus = insulinAdvisorState.advice?.glucoseStatus ?? null;
  let advisorStatusLabel = "Awaiting input";
  let advisorStatusClass = "status-chip";

  if (advisorStatus === "high") {
    advisorStatusLabel = "Above target";
    advisorStatusClass = "status-chip status-chip--high";
  } else if (advisorStatus === "low") {
    advisorStatusLabel = "Below target";
    advisorStatusClass = "status-chip status-chip--low";
  } else if (advisorStatus === "in-range") {
    advisorStatusLabel = "In target range";
    advisorStatusClass = "status-chip status-chip--ok";
  }

  if (isWidgetMode) {
    return (
      <WidgetView
        dashboard={dashboard}
        dashboardError={dashboardError}
        units={activeUnits}
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
        isPinned={isWidgetPinned}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="hero-card reveal">
        <div>
          <p className="eyebrow">Nightscout Desktop</p>
          <h1>Glucose cockpit</h1>
          <p className="subtitle">
            Live glucose, trend, TIR, IOB/COB, and meal overlays from Nightscout + integrations.
          </p>
        </div>
        <div className="status-stack">
          <span className={`status-pill ${dashboard?.stale ? "status-pill--warn" : "status-pill--ok"}`}>
            {sourceLabel}
          </span>
          <span className="status-meta">Last refresh: {formatTimestamp(lastRefreshAt)}</span>
          <button type="button" className="secondary" onClick={handleOpenWidget}>
            Open widget
          </button>
        </div>
      </header>

      <section className="panel reveal reveal-delay-1">
        <h2>Connection settings</h2>
        <form className="settings-form" onSubmit={handleSaveSettings}>
          <label>
            Nightscout base URL
            <input
              type="url"
              value={baseUrlInput}
              onChange={(event) => setBaseUrlInput(event.target.value)}
              placeholder="https://your-service.up.railway.app"
              required
            />
          </label>

          <label>
            Read token (optional if already saved)
            <input
              type="password"
              value={readTokenInput}
              onChange={(event) => setReadTokenInput(event.target.value)}
              placeholder="Enter read-only token"
              autoComplete="off"
            />
          </label>

          <label>
            Display units
            <select
              value={unitsInput}
              onChange={(event) => setUnitsInput(event.target.value as DisplayUnits)}
            >
              <option value="mmol">mmol</option>
              <option value="mg/dL">mg/dL</option>
            </select>
          </label>

          <div className="settings-actions">
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save settings"}
            </button>
            <button type="button" className="secondary" onClick={handleRemoveToken}>
              Remove token
            </button>
            <button
              type="button"
              className="secondary"
              disabled={isRefreshing}
              onClick={() => {
                void refreshDashboard(true);
              }}
            >
              {isRefreshing ? "Refreshing..." : "Refresh now"}
            </button>
          </div>

          <p className="token-status">
            Read token status: {settings?.hasReadToken ? "stored in OS keychain" : "not configured"}
          </p>
        </form>

        {configError ? <p className="error-banner">{configError}</p> : null}
        {syncMessage ? <p className="warn-banner">{syncMessage}</p> : null}
        {dashboardError ? <p className="warn-banner">{dashboardError.message}</p> : null}
      </section>

      <section className="grid grid--stats reveal reveal-delay-2">
        <article className="metric-card">
          <p>Current</p>
          <h3>{formatGlucose(dashboard?.summary.current ?? null, activeUnits)}</h3>
        </article>
        <article className="metric-card">
          <p>Delta</p>
          <h3>{formatDelta(dashboard?.summary.delta ?? null, activeUnits)}</h3>
        </article>
        <article className="metric-card">
          <p>Trend</p>
          <h3>{mapTrend(dashboard?.summary.direction ?? null)}</h3>
        </article>
        <article className="metric-card">
          <p>Updated at</p>
          <h3>{formatTimestamp(dashboard?.summary.updatedAt ?? null)}</h3>
        </article>
        <article className="metric-card">
          <p>IOB</p>
          <h3>{iobCobSnapshot.iobUnits.toFixed(2)} U</h3>
        </article>
        <article className="metric-card">
          <p>COB</p>
          <h3>{iobCobSnapshot.cobGrams.toFixed(1)} g</h3>
        </article>
        <article className="metric-card">
          <p>Steps 24h</p>
          <h3>{dashboard?.healthConnect?.stepsLast24h ?? "--"}</h3>
        </article>
        <article className="metric-card">
          <p>Weight</p>
          <h3>
            {dashboard?.healthConnect?.weightKgLatest === null || dashboard?.healthConnect?.weightKgLatest === undefined
              ? "--"
              : `${dashboard.healthConnect.weightKgLatest} kg`}
          </h3>
        </article>
      </section>

      <section className="panel reveal reveal-delay-3">
        <h2>Insulin therapy profile (editable)</h2>
        {insulinProfileDraft ? (
          <form className="profile-form" onSubmit={handleSaveInsulinProfile}>
            <div className="ratio-table">
              <div className="ratio-head">Start</div>
              <div className="ratio-head">End</div>
              <div className="ratio-head">g / 1U</div>
              <div className="ratio-head">Action</div>
              {insulinProfileDraft.ratioWindows.map((window) => (
                <div className="ratio-row" key={window.id}>
                  <input
                    type="time"
                    value={window.startHHMM}
                    onChange={(event) => updateRatioWindow(window.id, "startHHMM", event.target.value)}
                  />
                  <input
                    type="time"
                    value={window.endHHMM}
                    onChange={(event) => updateRatioWindow(window.id, "endHHMM", event.target.value)}
                  />
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={window.gramsPerUnit}
                    onChange={(event) => updateRatioWindow(window.id, "gramsPerUnit", event.target.value)}
                  />
                  <button type="button" className="secondary" onClick={() => removeRatioWindow(window.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="profile-grid">
              <label>
                Correction factor (g/L dropped by 1U)
                <input
                  type="number"
                  min="0.1"
                  step="0.01"
                  value={insulinProfileDraft.correctionFactorDropGLPerUnit}
                  onChange={(event) =>
                    setInsulinProfileDraft({
                      ...insulinProfileDraft,
                      correctionFactorDropGLPerUnit: Number(event.target.value)
                    })
                  }
                />
              </label>
              <label>
                Target low (g/L)
                <input
                  type="number"
                  min="0.1"
                  step="0.01"
                  value={insulinProfileDraft.targetLowGL}
                  onChange={(event) =>
                    setInsulinProfileDraft({
                      ...insulinProfileDraft,
                      targetLowGL: Number(event.target.value)
                    })
                  }
                />
              </label>
              <label>
                Target high (g/L)
                <input
                  type="number"
                  min="0.1"
                  step="0.01"
                  value={insulinProfileDraft.targetHighGL}
                  onChange={(event) =>
                    setInsulinProfileDraft({
                      ...insulinProfileDraft,
                      targetHighGL: Number(event.target.value)
                    })
                  }
                />
              </label>
              <label>
                Insulin action (hours)
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={insulinProfileDraft.insulinActionHours}
                  onChange={(event) =>
                    setInsulinProfileDraft({
                      ...insulinProfileDraft,
                      insulinActionHours: Number(event.target.value)
                    })
                  }
                />
              </label>
              <label>
                Carb absorption (hours)
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={insulinProfileDraft.carbAbsorptionHours}
                  onChange={(event) =>
                    setInsulinProfileDraft({
                      ...insulinProfileDraft,
                      carbAbsorptionHours: Number(event.target.value)
                    })
                  }
                />
              </label>
            </div>

            <div className="settings-actions">
              <button type="button" className="secondary" onClick={addRatioWindow}>
                Add ratio window
              </button>
              <button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save profile"}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="panel insulin-panel reveal reveal-delay-4">
        <div className="insulin-head">
          <h2>Insulin advisor (estimate)</h2>
          <span className={advisorStatusClass}>{advisorStatusLabel}</span>
        </div>
        <p className="insulin-disclaimer">
          Advisor uses editable profile, IOB and COB. This remains an estimate, not a prescription.
        </p>

        <div className="insulin-form">
          <label>
            Carbs (g)
            <input
              type="text"
              inputMode="decimal"
              value={carbsInput}
              onChange={(event) => setCarbsInput(event.target.value)}
              placeholder="e.g. 45"
            />
          </label>

          <label>
            Current glucose (g/L)
            <input
              type="text"
              inputMode="decimal"
              value={glucoseGLInput}
              onChange={(event) => setGlucoseGLInput(event.target.value)}
              placeholder="e.g. 1.12"
            />
          </label>

          <label>
            Meal time
            <input
              type="time"
              value={mealTimeInput}
              onChange={(event) => setMealTimeInput(event.target.value)}
            />
          </label>
        </div>

        <div className="insulin-actions">
          <button
            type="button"
            className="secondary"
            disabled={liveGlucoseGL === null}
            onClick={() => {
              if (liveGlucoseGL !== null) {
                setGlucoseGLInput(liveGlucoseGL.toFixed(2));
              }
            }}
          >
            Use live glucose
          </button>
          <p className="insulin-live">
            Live glucose: {liveGlucoseGL === null ? "--" : `${liveGlucoseGL.toFixed(2)} g/L`} / IOB{" "}
            {iobCobSnapshot.iobUnits.toFixed(2)} U / COB {iobCobSnapshot.cobGrams.toFixed(1)} g
          </p>
        </div>

        {insulinAdvisorState.message ? <p className="warn-banner">{insulinAdvisorState.message}</p> : null}

        {insulinAdvisorState.advice ? (
          <>
            {insulinAdvisorState.advice.glucoseStatus === "low" ? (
              <p className="error-banner">
                Current glucose is below target. Treat low glucose first and confirm decisions with your clinical plan.
              </p>
            ) : null}

            <section className="grid grid--insulin">
              <article className="metric-card">
                <p>Carb ratio used</p>
                <h3>1 U / {insulinAdvisorState.advice.ratioGramsPerUnit} g</h3>
              </article>
              <article className="metric-card">
                <p>Meal bolus</p>
                <h3>{insulinAdvisorState.advice.carbBolusUnits} U</h3>
              </article>
              <article className="metric-card">
                <p>Correction bolus</p>
                <h3>{insulinAdvisorState.advice.correctionUnits} U</h3>
              </article>
              <article className="metric-card">
                <p>Adjusted total (IOB/COB)</p>
                <h3>{insulinAdvisorState.advice.adjustedTotalUnits} U</h3>
              </article>
              <article className="metric-card">
                <p>Rounded (0.5 U)</p>
                <h3>{insulinAdvisorState.advice.roundedHalfUnitDose} U</h3>
              </article>
            </section>

            <div className="insulin-notes">
              {insulinAdvisorState.advice.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="panel reveal reveal-delay-5">
        <h2>Time In Range</h2>
        {tirStats ? (
          <div className="grid grid--tir">
            {[tirStats.day, tirStats.week, tirStats.month].map((bucket) => (
              <article className="metric-card" key={bucket.label}>
                <p>{bucket.label.toUpperCase()}</p>
                <h3>{bucket.inRangePct}% in range</h3>
                <p>Low {bucket.lowPct}% / High {bucket.highPct}%</p>
                <p>Avg {bucket.avgGL === null ? "--" : `${bucket.avgGL.toFixed(2)} g/L`}</p>
                <p>{bucket.count} points</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">No TIR data available yet.</p>
        )}
      </section>

      <section className="panel reveal reveal-delay-6">
        <h2>Health Connect + MFP integration</h2>
        <div className="integration-grid">
          <label>
            Integrations API URL
            <input
              type="url"
              value={integrationApiUrlInput}
              onChange={(event) => setIntegrationApiUrlInput(event.target.value)}
              placeholder="https://your-integrations-api.up.railway.app"
            />
          </label>
          <label>
            Integrations read token
            <input
              type="password"
              value={integrationReadTokenInput}
              onChange={(event) => setIntegrationReadTokenInput(event.target.value)}
              placeholder="Enter integrations read token"
              autoComplete="off"
            />
          </label>
        </div>
        <div className="settings-actions">
          <button type="button" onClick={handleSaveIntegrationSettings} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save integration settings"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleRemoveIntegrationToken}
            disabled={isSaving}
          >
            Remove integrations token
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleSyncIntegrations}
            disabled={isSyncingIntegrations}
          >
            {isSyncingIntegrations ? "Syncing..." : "Sync integrations now"}
          </button>
        </div>
        <p className="token-status">
          Integrations token:{" "}
          {settings?.integrations.hasIntegrationReadToken ? "configured" : "missing"}
        </p>
      </section>

      <section className="grid grid--content reveal reveal-delay-7">
        <article className="panel chart-panel">
          <h2>Last 24 hours (meal overlay)</h2>
          {chartData.length === 0 ? (
            <p className="empty-state">No values available yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="4 8" stroke="#355b73" opacity={0.35} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tick={{ fill: "#cde8ff", fontSize: 12 }}
                  tickFormatter={(value) => formatDateTick(Number(value))}
                />
                <YAxis tick={{ fill: "#cde8ff", fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(value) => formatTimestamp(new Date(Number(value)).toISOString())}
                  formatter={(value) => [`${value}`, activeUnits]}
                  contentStyle={{
                    background: "#0f1c2a",
                    border: "1px solid #2f5572",
                    borderRadius: 10,
                    color: "#dbf3ff"
                  }}
                />
                {meals24h.map((meal) => (
                  <ReferenceLine
                    key={meal.id}
                    x={Date.parse(meal.eatenAt)}
                    stroke="#ffd36a"
                    strokeDasharray="4 4"
                    label={{
                      position: "insideTopLeft",
                      value: `${meal.name} (${meal.carbsGrams}g)`,
                      fill: "#ffd36a",
                      fontSize: 10
                    }}
                  />
                ))}
                <Line type="monotone" dataKey="sgv" stroke="#68e0ff" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </article>

        <article className="panel table-panel">
          <h2>Recent history</h2>
          {historyRows.length === 0 ? (
            <p className="empty-state">No history available yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Glucose</th>
                    <th>Direction</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((entry) => (
                    <tr key={`${entry.date}-${entry.sgv}`}>
                      <td>{formatTimestamp(entry.dateString)}</td>
                      <td>{formatGlucose(entry.sgv, activeUnits)}</td>
                      <td>{mapTrend(entry.direction ?? null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
