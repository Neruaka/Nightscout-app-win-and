import { describe, expect, it } from "vitest";
import { computeTrendSummary, normalizeEntry } from "./nightscoutClient";

describe("normalizeEntry", () => {
  it("returns null when mandatory fields are missing", () => {
    expect(normalizeEntry({})).toBeNull();
  });

  it("normalizes a valid nightscout payload", () => {
    const entry = normalizeEntry({
      date: 1_735_000_000_000,
      dateString: "2024-12-30T10:00:00.000Z",
      sgv: 121,
      direction: "Flat",
      device: "xDrip+"
    });

    expect(entry).not.toBeNull();
    expect(entry?.sgv).toBe(121);
    expect(entry?.direction).toBe("Flat");
  });
});

describe("computeTrendSummary", () => {
  it("computes current value and delta from the latest values", () => {
    const summary = computeTrendSummary([
      {
        date: 200,
        dateString: "2024-12-30T10:05:00.000Z",
        sgv: 120,
        direction: "Flat"
      },
      {
        date: 100,
        dateString: "2024-12-30T10:00:00.000Z",
        sgv: 110,
        direction: "FortyFiveUp"
      }
    ]);

    expect(summary.current).toBe(120);
    expect(summary.delta).toBe(10);
    expect(summary.direction).toBe("Flat");
  });

  it("returns empty summary when no entries", () => {
    const summary = computeTrendSummary([]);
    expect(summary.current).toBeNull();
    expect(summary.delta).toBeNull();
    expect(summary.updatedAt).toBeNull();
  });
});
