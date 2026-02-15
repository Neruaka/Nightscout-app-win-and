import { describe, expect, it } from "vitest";
import type { InsulinTherapyProfile, TreatmentEntry } from "@nightscout/shared-types";
import {
  calculateInsulinAdvice,
  computeIobCobFromTreatments,
  getRatioForMealTime,
  glucoseFromMgdlToGL
} from "./insulinAdvisor";

const profile: InsulinTherapyProfile = {
  ratioWindows: [
    { id: "morning", startHHMM: "04:00", endHHMM: "11:30", gramsPerUnit: 5 },
    { id: "day", startHHMM: "11:31", endHHMM: "03:59", gramsPerUnit: 7 }
  ],
  correctionFactorDropGLPerUnit: 0.5,
  targetLowGL: 0.8,
  targetHighGL: 1.3,
  insulinActionHours: 4,
  carbAbsorptionHours: 3
};

describe("glucoseFromMgdlToGL", () => {
  it("converts mg/dL to g/L", () => {
    expect(glucoseFromMgdlToGL(110)).toBe(1.1);
    expect(glucoseFromMgdlToGL(83)).toBe(0.83);
  });
});

describe("getRatioForMealTime", () => {
  it("returns morning ratio in morning window", () => {
    expect(getRatioForMealTime(profile, "06:45")).toBe(5);
    expect(getRatioForMealTime(profile, "11:30")).toBe(5);
  });

  it("returns day ratio outside morning window", () => {
    expect(getRatioForMealTime(profile, "12:00")).toBe(7);
    expect(getRatioForMealTime(profile, "02:00")).toBe(7);
  });
});

describe("calculateInsulinAdvice", () => {
  it("applies correction when above range and adjusts with IOB/COB", () => {
    const result = calculateInsulinAdvice({
      carbsGrams: 50,
      currentGlucoseGL: 1.6,
      mealTimeHHMM: "06:45",
      profile,
      iobUnits: 0.5,
      cobGrams: 10
    });

    expect(result.carbBolusUnits).toBe(10);
    expect(result.correctionUnits).toBe(0.6);
    expect(result.adjustedCarbBolusUnits).toBe(8);
    expect(result.adjustedCorrectionUnits).toBe(0.1);
    expect(result.adjustedTotalUnits).toBe(8.1);
    expect(result.glucoseStatus).toBe("high");
  });

  it("flags low glucose and keeps correction at zero", () => {
    const result = calculateInsulinAdvice({
      carbsGrams: 28,
      currentGlucoseGL: 0.74,
      mealTimeHHMM: "09:30",
      profile
    });

    expect(result.glucoseStatus).toBe("low");
    expect(result.correctionUnits).toBe(0);
  });
});

describe("computeIobCobFromTreatments", () => {
  it("estimates active insulin and carbs from recent treatments", () => {
    const now = Date.parse("2026-02-15T12:00:00.000Z");
    const treatments: TreatmentEntry[] = [
      {
        created_at: "2026-02-15T10:00:00.000Z",
        insulin: 2
      },
      {
        created_at: "2026-02-15T11:00:00.000Z",
        carbs: 30
      }
    ];

    const snapshot = computeIobCobFromTreatments(treatments, profile, now);
    expect(snapshot.iobUnits).toBe(1);
    expect(snapshot.cobGrams).toBe(20);
  });
});
