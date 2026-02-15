import type {
  DisplayUnits,
  GlucoseEntry,
  InsulinTherapyProfile,
  TargetRangeWindow,
  TimeInRangeBucket,
  TimeInRangeStats
} from "@nightscout/shared-types";
import { toDisplayValue } from "./format";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function parseTimeToMinutes(valueHHMM: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(valueHHMM.trim());
  if (!match) {
    return 0;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function isTimeInsideWindow(
  targetMinutes: number,
  startMinutes: number,
  endMinutes: number
): boolean {
  if (startMinutes <= endMinutes) {
    return targetMinutes >= startMinutes && targetMinutes <= endMinutes;
  }
  return targetMinutes >= startMinutes || targetMinutes <= endMinutes;
}

function targetRangeForTimestamp(
  timestampMs: number,
  profile: InsulinTherapyProfile
): { lowGL: number; highGL: number } {
  const windows = profile.targetWindows;
  if (!Array.isArray(windows) || windows.length === 0) {
    return {
      lowGL: profile.targetLowGL,
      highGL: profile.targetHighGL
    };
  }

  const date = new Date(timestampMs);
  const targetMinutes = date.getHours() * 60 + date.getMinutes();
  const sortedWindows = [...windows].sort(
    (a: TargetRangeWindow, b: TargetRangeWindow) =>
      parseTimeToMinutes(a.startHHMM) - parseTimeToMinutes(b.startHHMM)
  );

  for (const window of sortedWindows) {
    const start = parseTimeToMinutes(window.startHHMM);
    const end = parseTimeToMinutes(window.endHHMM);
    if (isTimeInsideWindow(targetMinutes, start, end)) {
      return {
        lowGL: window.lowGL,
        highGL: window.highGL
      };
    }
  }

  return {
    lowGL: sortedWindows[0]?.lowGL ?? profile.targetLowGL,
    highGL: sortedWindows[0]?.highGL ?? profile.targetHighGL
  };
}

export function toChartData(entries: GlucoseEntry[], units: DisplayUnits) {
  return [...entries]
    .sort((a, b) => a.date - b.date)
    .map((entry) => ({
      ts: entry.date,
      sgv: toDisplayValue(entry.sgv, units),
      raw: entry.sgv
    }));
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
  profile: InsulinTherapyProfile,
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
    const target = targetRangeForTimestamp(entry.date, profile);
    totalGL += glucoseGL;

    if (glucoseGL < target.lowGL) {
      lowCount += 1;
    } else if (glucoseGL > target.highGL) {
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

export function calculateTimeInRange(
  entries: GlucoseEntry[],
  profile: InsulinTherapyProfile
): TimeInRangeStats {
  return {
    day: calculateTirBucket(entries, DAY_IN_MS, profile, "day"),
    week: calculateTirBucket(entries, 7 * DAY_IN_MS, profile, "week"),
    month: calculateTirBucket(entries, 30 * DAY_IN_MS, profile, "month")
  };
}
