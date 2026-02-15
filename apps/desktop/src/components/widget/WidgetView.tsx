import {
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
  WidgetLayout
} from "@nightscout/shared-types";
import { formatDateTick, formatDelta, formatGlucose, formatTimestamp, mapTrend } from "../../lib/format";

interface WidgetPoint {
  ts: number;
  sgv: number;
}

interface WidgetViewProps {
  dashboard: DashboardPayload | null;
  dashboardError: DashboardError | null;
  units: DisplayUnits;
  layout: WidgetLayout;
  miniChartData: WidgetPoint[];
  lastRefreshAt: string | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  onCloseWidget: () => void;
  onTogglePinned: () => void;
  onCycleLayout: () => void;
  isPinned: boolean;
}

function nextLayoutLabel(layout: WidgetLayout): string {
  if (layout === "minimal") {
    return "compact";
  }
  if (layout === "compact") {
    return "chart";
  }
  return "minimal";
}

export function WidgetView(props: WidgetViewProps) {
  const sourceLabel = props.dashboard?.source === "cache" ? "Cache" : "Live";

  return (
    <div className="widget-shell">
      <div className="widget-topbar widget-drag-region">
        <span className="widget-title">Nightscout Widget</span>
        <div className="widget-actions widget-no-drag">
          <button
            type="button"
            className="widget-btn widget-no-drag"
            onClick={props.onCycleLayout}
            title="Cycle layout"
          >
            {nextLayoutLabel(props.layout)}
          </button>
          <button
            type="button"
            className="widget-btn widget-no-drag"
            onClick={props.onTogglePinned}
            title="Toggle always-on-top"
          >
            {props.isPinned ? "Unpin" : "Pin"}
          </button>
          <button
            type="button"
            className="widget-btn widget-no-drag"
            onClick={props.onCloseWidget}
            title="Close widget"
          >
            X
          </button>
        </div>
      </div>

      {props.layout === "minimal" ? (
        <div className="widget-main">
          <p className="widget-value">
            {formatGlucose(props.dashboard?.summary.current ?? null, props.units)}
          </p>
          <p className="widget-meta">
            {mapTrend(props.dashboard?.summary.direction ?? null)}
          </p>
        </div>
      ) : null}

      {props.layout === "compact" ? (
        <div className="widget-main">
          <p className="widget-value">
            {formatGlucose(props.dashboard?.summary.current ?? null, props.units)}
          </p>
          <p className="widget-meta">
            Trend {mapTrend(props.dashboard?.summary.direction ?? null)} / Delta{" "}
            {formatDelta(props.dashboard?.summary.delta ?? null, props.units)}
          </p>
          <p className="widget-meta">
            Updated {formatTimestamp(props.dashboard?.summary.updatedAt ?? null)}
          </p>
        </div>
      ) : null}

      {props.layout === "chart" ? (
        <div className="widget-main widget-main--chart">
          <p className="widget-value">
            {formatGlucose(props.dashboard?.summary.current ?? null, props.units)}
          </p>
          <div className="widget-mini-chart">
            {props.miniChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={78}>
                <LineChart data={props.miniChartData}>
                  <XAxis
                    dataKey="ts"
                    tick={false}
                    axisLine={false}
                    tickFormatter={(value) => formatDateTick(Number(value))}
                  />
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Tooltip
                    formatter={(value) => [`${value}`, props.units]}
                    labelFormatter={(value) =>
                      formatTimestamp(new Date(Number(value)).toISOString())
                    }
                    contentStyle={{
                      background: "#111725",
                      border: "1px solid #2a3244",
                      borderRadius: 10,
                      color: "#dce6f7"
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sgv"
                    stroke="#7eb6ff"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="widget-meta">No data</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="widget-footer">
        <span>{sourceLabel}</span>
        <button
          type="button"
          className="widget-btn widget-no-drag"
          onClick={props.onRefresh}
          disabled={props.isRefreshing}
        >
          {props.isRefreshing ? "..." : "Refresh"}
        </button>
      </div>

      {props.dashboardError ? <p className="widget-error">{props.dashboardError.message}</p> : null}
      <p className="widget-refresh">Last refresh {formatTimestamp(props.lastRefreshAt)}</p>
    </div>
  );
}
