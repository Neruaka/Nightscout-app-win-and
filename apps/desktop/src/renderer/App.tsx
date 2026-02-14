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

      <section className="grid grid--content reveal reveal-delay-3">
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
