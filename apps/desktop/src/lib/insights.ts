import type {
  GlucoseEntry,
  InsulinTherapyProfile,
  MealEntry,
  TreatmentEntry
} from "@nightscout/shared-types";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface InferredMealEvent {
  id: string;
  eatenAt: string;
  riseMgdl: number;
}

export interface SensitivityInsight {
  sampleCount: number;
  averageDropPerUnitGL: number | null;
  suggestedCorrectionFactorGL: number | null;
  confidence: "low" | "medium" | "high";
}

export interface HealthScoreCardData {
  overall: number;
  tirScore: number;
  variabilityScore: number;
  hypoScore: number;
  stabilityScore: number;
  inRangePct: number;
  lowPct: number;
  cvPct: number;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseTimeToMinutes(valueHHMM: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(valueHHMM.trim());
  if (!match) {
    return 0;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function isTimeInsideWindow(target: number, start: number, end: number): boolean {
  if (start <= end) {
    return target >= start && target <= end;
  }
  return target >= start || target <= end;
}

function targetForTimestamp(
  profile: InsulinTherapyProfile,
  timestampMs: number
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
  const sorted = [...windows].sort(
    (a, b) => parseTimeToMinutes(a.startHHMM) - parseTimeToMinutes(b.startHHMM)
  );

  for (const window of sorted) {
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
    lowGL: sorted[0]?.lowGL ?? profile.targetLowGL,
    highGL: sorted[0]?.highGL ?? profile.targetHighGL
  };
}

function nearestEntry(
  entries: GlucoseEntry[],
  timestamp: number,
  maxGapMs: number
): GlucoseEntry | null {
  let best: GlucoseEntry | null = null;
  let bestGap = Number.POSITIVE_INFINITY;

  for (const entry of entries) {
    const gap = Math.abs(entry.date - timestamp);
    if (gap <= maxGapMs && gap < bestGap) {
      best = entry;
      bestGap = gap;
    }
  }

  return best;
}

export function detectInferredMeals(
  entries: GlucoseEntry[],
  meals: MealEntry[]
): InferredMealEvent[] {
  const sorted = [...entries].sort((a, b) => a.date - b.date);
  if (sorted.length < 5) {
    return [];
  }

  const mealTimes = meals
    .map((meal) => Date.parse(meal.eatenAt))
    .filter((value) => Number.isFinite(value));

  const inferred: InferredMealEvent[] = [];

  for (let i = 4; i < sorted.length; i += 1) {
    const start = sorted[i - 4];
    const end = sorted[i];
    const delta = end.sgv - start.sgv;
    const minutes = (end.date - start.date) / MINUTE_MS;

    if (minutes < 15 || minutes > 35) {
      continue;
    }

    if (delta < 30) {
      continue;
    }

    const candidateTs = end.date;
    const nearLoggedMeal = mealTimes.some(
      (mealTs) => Math.abs(mealTs - candidateTs) <= 60 * MINUTE_MS
    );
    if (nearLoggedMeal) {
      continue;
    }

    const nearInferredMeal = inferred.some(
      (meal) => Math.abs(Date.parse(meal.eatenAt) - candidateTs) <= 90 * MINUTE_MS
    );
    if (nearInferredMeal) {
      continue;
    }

    inferred.push({
      id: `inferred-${candidateTs}`,
      eatenAt: new Date(candidateTs).toISOString(),
      riseMgdl: delta
    });
  }

  return inferred;
}

export function computeInsulinSensitivityInsight(
  entries: GlucoseEntry[],
  treatments: TreatmentEntry[],
  profile: InsulinTherapyProfile
): SensitivityInsight {
  const sortedEntries = [...entries].sort((a, b) => a.date - b.date);
  const corrections = treatments.filter(
    (item) =>
      typeof item.insulin === "number" &&
      item.insulin > 0 &&
      (item.carbs === undefined || item.carbs <= 5)
  );

  const factors: number[] = [];

  for (const treatment of corrections) {
    const at = Date.parse(treatment.created_at);
    if (!Number.isFinite(at)) {
      continue;
    }

    const before = nearestEntry(sortedEntries, at, 20 * MINUTE_MS);
    const after = nearestEntry(sortedEntries, at + 120 * MINUTE_MS, 45 * MINUTE_MS);

    if (!before || !after || !treatment.insulin) {
      continue;
    }

    const dropGL = (before.sgv - after.sgv) / 100;
    if (dropGL <= 0) {
      continue;
    }

    const factor = dropGL / treatment.insulin;
    if (Number.isFinite(factor) && factor > 0) {
      factors.push(factor);
    }
  }

  if (factors.length === 0) {
    return {
      sampleCount: 0,
      averageDropPerUnitGL: null,
      suggestedCorrectionFactorGL: null,
      confidence: "low"
    };
  }

  const avgFactor = factors.reduce((sum, value) => sum + value, 0) / factors.length;
  const suggested =
    profile.correctionFactorDropGLPerUnit * 0.6 + avgFactor * 0.4;

  return {
    sampleCount: factors.length,
    averageDropPerUnitGL: round2(avgFactor),
    suggestedCorrectionFactorGL: round2(suggested),
    confidence: factors.length >= 10 ? "high" : factors.length >= 4 ? "medium" : "low"
  };
}

export function computeHealthScore(
  entries: GlucoseEntry[],
  profile: InsulinTherapyProfile
): HealthScoreCardData | null {
  const now = Date.now();
  const from = now - 14 * DAY_MS;
  const scoped = entries
    .filter((entry) => entry.date >= from && entry.date <= now)
    .sort((a, b) => a.date - b.date);

  if (scoped.length < 12) {
    return null;
  }

  let lowCount = 0;
  let inRangeCount = 0;
  let sumGL = 0;
  const deltas: number[] = [];

  for (let index = 0; index < scoped.length; index += 1) {
    const entry = scoped[index];
    const valueGL = entry.sgv / 100;
    const target = targetForTimestamp(profile, entry.date);
    sumGL += valueGL;

    if (valueGL < target.lowGL) {
      lowCount += 1;
    } else if (valueGL <= target.highGL) {
      inRangeCount += 1;
    }

    if (index > 0) {
      deltas.push(Math.abs(scoped[index].sgv - scoped[index - 1].sgv));
    }
  }

  const count = scoped.length;
  const mean = sumGL / count;
  const variance =
    scoped.reduce((acc, entry) => {
      const value = entry.sgv / 100;
      return acc + (value - mean) * (value - mean);
    }, 0) / count;
  const sd = Math.sqrt(variance);
  const cvPct = mean > 0 ? (sd / mean) * 100 : 0;
  const inRangePct = (inRangeCount / count) * 100;
  const lowPct = (lowCount / count) * 100;
  const meanAbsDeltaMgdl =
    deltas.length > 0
      ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length
      : 0;

  const tirScore = clamp(inRangePct, 0, 100);
  const variabilityScore = clamp(100 - Math.max(0, cvPct - 20) * 3, 0, 100);
  const hypoScore = clamp(100 - lowPct * 4, 0, 100);
  const stabilityScore = clamp(100 - meanAbsDeltaMgdl * 2, 0, 100);
  const overall = round2(
    tirScore * 0.4 + variabilityScore * 0.2 + hypoScore * 0.25 + stabilityScore * 0.15
  );

  return {
    overall,
    tirScore: round2(tirScore),
    variabilityScore: round2(variabilityScore),
    hypoScore: round2(hypoScore),
    stabilityScore: round2(stabilityScore),
    inRangePct: round2(inRangePct),
    lowPct: round2(lowPct),
    cvPct: round2(cvPct)
  };
}
