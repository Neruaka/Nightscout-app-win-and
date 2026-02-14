import { describe, expect, it } from "vitest";
import {
  calculateInsulinAdvice,
  glucoseFromMgdlToGL
} from "./insulinAdvisor";

describe("glucoseFromMgdlToGL", () => {
  it("converts mg/dL to g/L", () => {
    expect(glucoseFromMgdlToGL(110)).toBe(1.1);
    expect(glucoseFromMgdlToGL(83)).toBe(0.83);
  });
});

describe("calculateInsulinAdvice", () => {
  it("uses morning ratio between 04:00 and 11:30", () => {
    const result = calculateInsulinAdvice({
      carbsGrams: 50,
      currentGlucoseGL: 1.6,
      mealTimeHHMM: "06:45"
    });

    expect(result.ratioGramsPerUnit).toBe(5);
    expect(result.carbBolusUnits).toBe(10);
    expect(result.correctionUnits).toBe(0.6);
    expect(result.totalUnits).toBe(10.6);
    expect(result.glucoseStatus).toBe("high");
  });

  it("switches to day ratio after 11:30", () => {
    const result = calculateInsulinAdvice({
      carbsGrams: 70,
      currentGlucoseGL: 1.0,
      mealTimeHHMM: "12:00"
    });

    expect(result.ratioGramsPerUnit).toBe(7);
    expect(result.carbBolusUnits).toBe(10);
    expect(result.correctionUnits).toBe(0);
    expect(result.totalUnits).toBe(10);
    expect(result.glucoseStatus).toBe("in-range");
  });

  it("flags low glucose and skips correction dose", () => {
    const result = calculateInsulinAdvice({
      carbsGrams: 28,
      currentGlucoseGL: 0.74,
      mealTimeHHMM: "09:30"
    });

    expect(result.glucoseStatus).toBe("low");
    expect(result.correctionUnits).toBe(0);
    expect(result.notes[0]).toContain("below target");
  });

  it("includes 11:30 in morning ratio window", () => {
    const result = calculateInsulinAdvice({
      carbsGrams: 25,
      currentGlucoseGL: 1.1,
      mealTimeHHMM: "11:30"
    });

    expect(result.ratioGramsPerUnit).toBe(5);
  });
});
