import type {
  InsulinAdviceInput,
  InsulinAdviceResult,
  InsulinRatioWindow,
  InsulinTherapyProfile,
  IobCobSnapshot,
  TreatmentEntry
} from "@nightscout/shared-types";

const HOURS_TO_MS = 60 * 60 * 1000;

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function roundToHalfUnit(value: number): number {
  return Math.round(value * 2) / 2;
}

function parseTimeToMinutes(valueHHMM: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(valueHHMM.trim());
  if (!match) {
    throw new Error("Time must use HH:MM format.");
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function clampToPositive(value: number): number {
  return value > 0 ? value : 0;
}

function sortRatioWindows(windows: InsulinRatioWindow[]): InsulinRatioWindow[] {
  return [...windows].sort(
    (a, b) => parseTimeToMinutes(a.startHHMM) - parseTimeToMinutes(b.startHHMM)
  );
}

function isTimeInsideWindow(
  targetMinutes: number,
  startMinutes: number,
  endMinutes: number
): boolean {
  if (startMinutes <= endMinutes) {
    return targetMinutes >= startMinutes && targetMinutes <= endMinutes;
  }

  // Overnight interval (e.g. 22:00 -> 03:00)
  return targetMinutes >= startMinutes || targetMinutes <= endMinutes;
}

export function getRatioForMealTime(
  profile: InsulinTherapyProfile,
  mealTimeHHMM: string
): number {
  const targetMinutes = parseTimeToMinutes(mealTimeHHMM);
  const windows = sortRatioWindows(profile.ratioWindows);

  for (const window of windows) {
    const start = parseTimeToMinutes(window.startHHMM);
    const end = parseTimeToMinutes(window.endHHMM);
    if (isTimeInsideWindow(targetMinutes, start, end)) {
      return window.gramsPerUnit;
    }
  }

  return windows[0]?.gramsPerUnit ?? 10;
}

export function glucoseFromMgdlToGL(valueMgdl: number): number {
  return round2(valueMgdl / 100);
}

function toTimestamp(input: string): number | null {
  const parsed = Date.parse(input);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

export function computeIobCobFromTreatments(
  treatments: TreatmentEntry[],
  profile: InsulinTherapyProfile,
  now = Date.now()
): IobCobSnapshot {
  const insulinActionMs = profile.insulinActionHours * HOURS_TO_MS;
  const carbAbsorptionMs = profile.carbAbsorptionHours * HOURS_TO_MS;

  let iobUnits = 0;
  let cobGrams = 0;

  for (const treatment of treatments) {
    const at = toTimestamp(treatment.created_at);
    if (at === null || at > now) {
      continue;
    }

    const elapsedMs = now - at;

    if (typeof treatment.insulin === "number" && treatment.insulin > 0) {
      const remainingFraction = clampToPositive(1 - elapsedMs / insulinActionMs);
      iobUnits += treatment.insulin * remainingFraction;
    }

    if (typeof treatment.carbs === "number" && treatment.carbs > 0) {
      const remainingFraction = clampToPositive(1 - elapsedMs / carbAbsorptionMs);
      cobGrams += treatment.carbs * remainingFraction;
    }
  }

  return {
    iobUnits: round2(iobUnits),
    cobGrams: round2(cobGrams)
  };
}

export function calculateInsulinAdvice(input: InsulinAdviceInput): InsulinAdviceResult {
  if (!Number.isFinite(input.carbsGrams) || input.carbsGrams < 0) {
    throw new Error("Carbs must be a positive number.");
  }

  if (!Number.isFinite(input.currentGlucoseGL) || input.currentGlucoseGL <= 0) {
    throw new Error("Current glucose must be a positive number.");
  }

  if (
    !Number.isFinite(input.profile.targetLowGL) ||
    !Number.isFinite(input.profile.targetHighGL) ||
    input.profile.targetLowGL <= 0 ||
    input.profile.targetHighGL <= input.profile.targetLowGL
  ) {
    throw new Error("Target glucose range is invalid.");
  }

  if (
    !Number.isFinite(input.profile.correctionFactorDropGLPerUnit) ||
    input.profile.correctionFactorDropGLPerUnit <= 0
  ) {
    throw new Error("Correction factor must be a positive number.");
  }

  const ratioGramsPerUnit = getRatioForMealTime(input.profile, input.mealTimeHHMM);
  if (!Number.isFinite(ratioGramsPerUnit) || ratioGramsPerUnit <= 0) {
    throw new Error("Carb ratio is invalid.");
  }

  const carbBolusUnits = input.carbsGrams / ratioGramsPerUnit;

  let glucoseStatus: InsulinAdviceResult["glucoseStatus"] = "in-range";
  let correctionUnits = 0;
  const notes: string[] = [];

  if (input.currentGlucoseGL < input.profile.targetLowGL) {
    glucoseStatus = "low";
    notes.push(
      "Current glucose is below target. Treat low glucose first before taking a correction dose."
    );
  } else if (input.currentGlucoseGL > input.profile.targetHighGL) {
    glucoseStatus = "high";
    correctionUnits =
      (input.currentGlucoseGL - input.profile.targetHighGL) /
      input.profile.correctionFactorDropGLPerUnit;
  }

  const iobUnits = clampToPositive(input.iobUnits ?? 0);
  const cobGrams = clampToPositive(input.cobGrams ?? 0);
  const cobAsUnits = cobGrams / ratioGramsPerUnit;

  const adjustedCorrectionUnits = clampToPositive(correctionUnits - iobUnits);
  const adjustedCarbBolusUnits = clampToPositive(carbBolusUnits - cobAsUnits);

  const totalUnits = carbBolusUnits + correctionUnits;
  const adjustedTotalUnits = adjustedCarbBolusUnits + adjustedCorrectionUnits;

  if (iobUnits > 0) {
    notes.push(`IOB applied: -${round2(iobUnits)} U on correction estimate.`);
  }
  if (cobGrams > 0) {
    notes.push(`COB applied: -${round2(cobGrams)} g on carb bolus estimate.`);
  }

  notes.push(
    "Estimate does not include activity, illness, stress, delayed digestion, or clinical exceptions."
  );
  notes.push("Confirm dose decisions with your clinician's treatment plan.");

  return {
    ratioGramsPerUnit: round2(ratioGramsPerUnit),
    carbBolusUnits: round2(carbBolusUnits),
    correctionUnits: round2(correctionUnits),
    adjustedCarbBolusUnits: round2(adjustedCarbBolusUnits),
    adjustedCorrectionUnits: round2(adjustedCorrectionUnits),
    totalUnits: round2(totalUnits),
    adjustedTotalUnits: round2(adjustedTotalUnits),
    roundedHalfUnitDose: round2(roundToHalfUnit(adjustedTotalUnits)),
    targetLowGL: round2(input.profile.targetLowGL),
    targetHighGL: round2(input.profile.targetHighGL),
    correctionFactorDropGLPerUnit: round2(
      input.profile.correctionFactorDropGLPerUnit
    ),
    glucoseStatus,
    notes
  };
}
