import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
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
  NightscoutDesktopSettings
} from "@nightscout/shared-types";
import { calculateInsulinAdvice, glucoseFromMgdlToGL } from "./insulinAdvisor";

const REFRESH_INTERVAL_MS = 60_000;

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

function toChartData(entries: GlucoseEntry[], units: DisplayUnits) {
  return [...entries]
    .sort((a, b) => a.date - b.date)
    .map((entry) => ({
      time: new Date(entry.date).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      }),
      sgv: toDisplayValue(entry.sgv, units)
    }));
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

async function loadSettingsIntoState(
  setSettings: (value: NightscoutDesktopSettings) => void,
  setBaseUrl: (value: string) => void,
  setUnits: (value: DisplayUnits) => void,
  setConfigError: (value: string | null) => void
): Promise<void> {
  try {
    const nextSettings = await window.nightscoutApi.getSettings();
    setSettings(nextSettings);
    setBaseUrl(nextSettings.baseUrl);
    setUnits(nextSettings.units);
    setConfigError(null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load settings.";
    setConfigError(message);
  }
}

export function App() {
  const [settings, setSettings] = useState<NightscoutDesktopSettings | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [dashboardError, setDashboardError] = useState<DashboardError | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [baseUrlInput, setBaseUrlInput] = useState("");
  const [readTokenInput, setReadTokenInput] = useState("");
  const [unitsInput, setUnitsInput] = useState<DisplayUnits>("mmol");
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [carbsInput, setCarbsInput] = useState("");
  const [glucoseGLInput, setGlucoseGLInput] = useState("");
  const [mealTimeInput, setMealTimeInput] = useState(getCurrentLocalTimeHHMM());

  const activeUnits = settings?.units ?? unitsInput;

  const chartData = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return toChartData(dashboard.entries, activeUnits);
  }, [dashboard, activeUnits]);

  const historyRows = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return dashboard.entries.slice(0, 36);
  }, [dashboard]);

  const liveGlucoseGL = useMemo(() => {
    if (dashboard?.summary.current === null || dashboard?.summary.current === undefined) {
      return null;
    }

    return glucoseFromMgdlToGL(dashboard.summary.current);
  }, [dashboard?.summary.current]);

  const insulinAdvisorState = useMemo(() => {
    const carbs = parseNumericInput(carbsInput);
    const currentGlucoseGL = parseNumericInput(glucoseGLInput);

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
        mealTimeHHMM: mealTimeInput
      });

      return {
        advice,
        message: null
      };
    } catch (error) {
      return {
        advice: null,
        message:
          error instanceof Error ? error.message : "Unable to calculate insulin estimate."
      };
    }
  }, [carbsInput, glucoseGLInput, mealTimeInput]);

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
      setDashboardError({
        message,
        canUseCachedData: false
      });
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

      await loadSettingsIntoState(setSettings, setBaseUrlInput, setUnitsInput, setConfigError);
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

  return (
    <div className="app-shell">
      <header className="hero-card reveal">
        <div>
          <p className="eyebrow">Nightscout Desktop</p>
          <h1>Glucose cockpit</h1>
          <p className="subtitle">
            Live glucose, trend, and 24-hour history from your secured Nightscout instance.
          </p>
        </div>
        <div className="status-stack">
          <span className={`status-pill ${dashboard?.stale ? "status-pill--warn" : "status-pill--ok"}`}>
            {sourceLabel}
          </span>
          <span className="status-meta">Last refresh: {formatTimestamp(lastRefreshAt)}</span>
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
      </section>

      <section className="panel insulin-panel reveal reveal-delay-3">
        <div className="insulin-head">
          <h2>Insulin advisor (estimate)</h2>
          <span className={advisorStatusClass}>{advisorStatusLabel}</span>
        </div>
        <p className="insulin-disclaimer">
          Uses your personal factors: 1U/5g from 04:00 to 11:30, then 1U/7g;
          correction 1U lowers 0.5 g/L; target 0.80 to 1.30 g/L. This estimate
          is not a medical prescription.
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
            Live glucose:{" "}
            {liveGlucoseGL === null ? "--" : `${liveGlucoseGL.toFixed(2)} g/L`}
          </p>
        </div>

        {insulinAdvisorState.message ? (
          <p className="warn-banner">{insulinAdvisorState.message}</p>
        ) : null}

        {insulinAdvisorState.advice ? (
          <>
            {insulinAdvisorState.advice.glucoseStatus === "low" ? (
              <p className="error-banner">
                Current glucose is below target. Treat low glucose first and
                verify with your clinical plan before dosing.
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
                <p>Total estimate</p>
                <h3>{insulinAdvisorState.advice.totalUnits} U</h3>
              </article>
              <article className="metric-card">
                <p>Rounded (0.5 U)</p>
                <h3>{insulinAdvisorState.advice.roundedHalfUnitDose} U</h3>
              </article>
            </section>

            <p className="token-status">
              Target range: {insulinAdvisorState.advice.targetLowGL.toFixed(2)}
              {" - "}
              {insulinAdvisorState.advice.targetHighGL.toFixed(2)} g/L. Factor:
              1 U = -{insulinAdvisorState.advice.correctionFactorDropGLPerUnit}{" "}
              g/L.
            </p>

            <div className="insulin-notes">
              {insulinAdvisorState.advice.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="grid grid--content reveal reveal-delay-4">
        <article className="panel chart-panel">
          <h2>Last 24 hours</h2>
          {chartData.length === 0 ? (
            <p className="empty-state">No values available yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="4 8" stroke="#355b73" opacity={0.35} />
                <XAxis dataKey="time" tick={{ fill: "#cde8ff", fontSize: 12 }} minTickGap={24} />
                <YAxis tick={{ fill: "#cde8ff", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "#0f1c2a",
                    border: "1px solid #2f5572",
                    borderRadius: 10,
                    color: "#dbf3ff"
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="sgv"
                  stroke="#68e0ff"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
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
