export type MealSource = "myfitnesspal" | "health-connect";

export interface MealEntry {
  id: string;
  name: string;
  carbsGrams: number;
  eatenAt: string;
  source: MealSource;
  calories?: number;
}

export interface HealthConnectSummary {
  stepsLast24h: number | null;
  weightKgLatest: number | null;
  weightUpdatedAt: string | null;
  syncedAt: string;
  source: "health-connect";
}

export interface IntegrationIngestSummary {
  stepsLast24h: number | null;
  weightKgLatest: number | null;
  weightUpdatedAt: string | null;
}

export interface IntegrationIngestMeal {
  id: string;
  name: string;
  carbsGrams: number;
  eatenAt: string;
  calories?: number;
  source?: MealSource;
}

export interface IntegrationIngestPayload {
  deviceId: string;
  syncedAt: string;
  summary: IntegrationIngestSummary;
  meals: IntegrationIngestMeal[];
}
