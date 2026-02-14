export interface InsulinAdviceInput {
  carbsGrams: number;
  currentGlucoseGL: number;
  mealTimeHHMM: string;
}

export interface InsulinAdviceResult {
  ratioGramsPerUnit: number;
  carbBolusUnits: number;
  correctionUnits: number;
  totalUnits: number;
  roundedHalfUnitDose: number;
  targetLowGL: number;
  targetHighGL: number;
  correctionFactorDropGLPerUnit: number;
  glucoseStatus: "low" | "in-range" | "high";
  notes: string[];
}

const MORNING_START_MINUTES = 4 * 60;
const MORNING_END_MINUTES = 11 * 60 + 30;
const MORNING_RATIO_GRAMS_PER_UNIT = 5;
const DAY_RATIO_GRAMS_PER_UNIT = 7;
const TARGET_LOW_GL = 0.8;
const TARGET_HIGH_GL = 1.3;
const CORRECTION_FACTOR_DROP_GL_PER_UNIT = 0.5;

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function roundToHalfUnit(value: number): number {
  return Math.round(value * 2) / 2;
}

function parseTimeToMinutes(mealTimeHHMM: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(mealTimeHHMM.trim());
  if (!match) {
    throw new Error("Meal time must use HH:MM format.");
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

function getRatioForMealTime(mealTimeHHMM: string): number {
  const totalMinutes = parseTimeToMinutes(mealTimeHHMM);
  if (
    totalMinutes >= MORNING_START_MINUTES &&
    totalMinutes <= MORNING_END_MINUTES
  ) {
    return MORNING_RATIO_GRAMS_PER_UNIT;
  }

  return DAY_RATIO_GRAMS_PER_UNIT;
}

export function glucoseFromMgdlToGL(valueMgdl: number): number {
  return round2(valueMgdl / 100);
}

export function calculateInsulinAdvice(
  input: InsulinAdviceInput
): InsulinAdviceResult {
  if (!Number.isFinite(input.carbsGrams) || input.carbsGrams < 0) {
    throw new Error("Carbs must be a positive number.");
  }

  if (
    !Number.isFinite(input.currentGlucoseGL) ||
    input.currentGlucoseGL <= 0
  ) {
    throw new Error("Current glucose must be a positive number.");
  }

  const ratioGramsPerUnit = getRatioForMealTime(input.mealTimeHHMM);
  const carbBolusUnits = input.carbsGrams / ratioGramsPerUnit;

  let glucoseStatus: InsulinAdviceResult["glucoseStatus"] = "in-range";
  let correctionUnits = 0;
  const notes: string[] = [];

  if (input.currentGlucoseGL < TARGET_LOW_GL) {
    glucoseStatus = "low";
    notes.push(
      "Current glucose is below target. Treat low glucose first before taking a correction dose."
    );
  } else if (input.currentGlucoseGL > TARGET_HIGH_GL) {
    glucoseStatus = "high";
    correctionUnits =
      (input.currentGlucoseGL - TARGET_HIGH_GL) /
      CORRECTION_FACTOR_DROP_GL_PER_UNIT;
  }

  const totalUnits = carbBolusUnits + correctionUnits;

  notes.push(
    "Estimate does not include insulin-on-board, activity, illness, or delayed digestion."
  );
  notes.push(
    "Confirm any dose decision with your clinician's treatment plan."
  );

  return {
    ratioGramsPerUnit,
    carbBolusUnits: round2(carbBolusUnits),
    correctionUnits: round2(correctionUnits),
    totalUnits: round2(totalUnits),
    roundedHalfUnitDose: round2(roundToHalfUnit(totalUnits)),
    targetLowGL: TARGET_LOW_GL,
    targetHighGL: TARGET_HIGH_GL,
    correctionFactorDropGLPerUnit: CORRECTION_FACTOR_DROP_GL_PER_UNIT,
    glucoseStatus,
    notes
  };
}
