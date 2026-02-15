import type { DisplayUnits } from "@nightscout/shared-types";

export const DIRECTION_TO_ARROW: Record<string, string> = {
  DoubleUp: "↑↑",
  SingleUp: "↑",
  FortyFiveUp: "↗",
  Flat: "→",
  FortyFiveDown: "↘",
  SingleDown: "↓",
  DoubleDown: "↓↓",
  NONE: "?",
  NOT_COMPUTABLE: "?",
  RATE_OUT_OF_RANGE: "!"
};

export function toDisplayValue(rawMgdl: number, units: DisplayUnits): number {
  if (units === "mmol") {
    return Number((rawMgdl / 18).toFixed(1));
  }
  return Math.round(rawMgdl);
}

export function formatGlucose(rawMgdl: number | null, units: DisplayUnits): string {
  if (rawMgdl === null) {
    return "--";
  }
  return `${toDisplayValue(rawMgdl, units)} ${units}`;
}

export function formatDelta(rawMgdl: number | null, units: DisplayUnits): string {
  if (rawMgdl === null) {
    return "--";
  }
  const value = toDisplayValue(rawMgdl, units);
  const sign = value > 0 ? "+" : "";
  return `${sign}${value} ${units}`;
}

export function formatTimestamp(value: string | null): string {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleString();
}

export function mapTrend(direction: string | null): string {
  if (!direction) {
    return "?";
  }
  return DIRECTION_TO_ARROW[direction] ?? direction;
}

export function formatDateTick(value: number): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}
