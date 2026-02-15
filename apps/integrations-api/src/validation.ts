import type {
  IntegrationIngestPayload,
  IntegrationIngestMeal,
  MealEntry
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Expected a number or null.");
  }

  return value;
}

function parseIsoDate(value: unknown): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error("Expected an ISO datetime string.");
  }
  return new Date(value).toISOString();
}

function parseMeal(raw: unknown): IntegrationIngestMeal {
  if (!isRecord(raw)) {
    throw new Error("Meal must be an object.");
  }

  const id = raw.id;
  const name = raw.name;
  const carbsGrams = raw.carbsGrams;
  const eatenAt = raw.eatenAt;
  const calories = raw.calories;
  const source = raw.source;

  if (typeof id !== "string" || !id.trim()) {
    throw new Error("Meal id is required.");
  }

  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Meal name is required.");
  }

  if (typeof carbsGrams !== "number" || !Number.isFinite(carbsGrams) || carbsGrams < 0) {
    throw new Error("Meal carbsGrams must be a positive number.");
  }

  const normalized: IntegrationIngestMeal = {
    id: id.trim(),
    name: name.trim(),
    carbsGrams: Number(carbsGrams.toFixed(2)),
    eatenAt: parseIsoDate(eatenAt),
    source: source === "health-connect" ? "health-connect" : "myfitnesspal"
  };

  if (calories !== undefined) {
    if (typeof calories !== "number" || !Number.isFinite(calories) || calories < 0) {
      throw new Error("Meal calories must be a positive number.");
    }
    normalized.calories = Number(calories.toFixed(2));
  }

  return normalized;
}

export function parseIngestPayload(input: unknown): IntegrationIngestPayload {
  if (!isRecord(input)) {
    throw new Error("Payload must be an object.");
  }

  const deviceId = input.deviceId;
  const syncedAt = input.syncedAt;
  const summary = input.summary;
  const meals = input.meals;

  if (typeof deviceId !== "string" || !deviceId.trim()) {
    throw new Error("deviceId is required.");
  }

  if (!isRecord(summary)) {
    throw new Error("summary is required.");
  }

  const stepsLast24h = parseNullableNumber(summary.stepsLast24h);
  const weightKgLatest = parseNullableNumber(summary.weightKgLatest);
  const weightUpdatedAt =
    summary.weightUpdatedAt === null || summary.weightUpdatedAt === undefined
      ? null
      : parseIsoDate(summary.weightUpdatedAt);

  if (!Array.isArray(meals)) {
    throw new Error("meals must be an array.");
  }

  return {
    deviceId: deviceId.trim(),
    syncedAt: parseIsoDate(syncedAt),
    summary: {
      stepsLast24h,
      weightKgLatest,
      weightUpdatedAt
    },
    meals: meals.map((meal) => parseMeal(meal))
  };
}

function parseDateQueryParam(value: string | undefined, fallback: Date): Date {
  if (!value) {
    return fallback;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error("Invalid datetime query parameter.");
  }
  return new Date(parsed);
}

function parseLimit(value: string | undefined): number {
  if (!value) {
    return 500;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 5000) {
    throw new Error("limit must be an integer between 1 and 5000.");
  }
  return parsed;
}

export interface MealsQuery {
  from: Date;
  to: Date;
  limit: number;
}

export function parseMealsQuery(query: Record<string, string | undefined>): MealsQuery {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const from = parseDateQueryParam(query.from, monthAgo);
  const to = parseDateQueryParam(query.to, now);
  const limit = parseLimit(query.limit);

  if (from.getTime() > to.getTime()) {
    throw new Error("from must be earlier than to.");
  }

  return { from, to, limit };
}

export function normalizeMealForApi(
  meal: {
    mealId: string;
    name: string;
    carbsGrams: number;
    eatenAt: Date;
    source: MealEntry["source"];
    calories?: number;
  }
): MealEntry {
  return {
    id: meal.mealId,
    name: meal.name,
    carbsGrams: Number(meal.carbsGrams.toFixed(2)),
    eatenAt: meal.eatenAt.toISOString(),
    source: meal.source,
    calories:
      typeof meal.calories === "number" ? Number(meal.calories.toFixed(2)) : undefined
  };
}
