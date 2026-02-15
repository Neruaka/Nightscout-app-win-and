import type {
  HealthConnectSummary,
  MealEntry
} from "@nightscout/shared-types";

interface IntegrationsHttpClientOptions {
  baseUrl: string;
  readToken: string;
  timeoutMs?: number;
}

interface RawSummaryResponse {
  stepsLast24h?: number | null;
  weightKgLatest?: number | null;
  weightUpdatedAt?: string | null;
  syncedAt?: string;
  source?: string;
}

interface RawMealResponse {
  id?: string;
  name?: string;
  carbsGrams?: number;
  eatenAt?: string;
  source?: string;
  calories?: number;
}

function ensureUrl(baseUrl: string, path: string): URL {
  const normalized = baseUrl.replace(/\/+$/, "");
  return new URL(`${normalized}${path}`);
}

function buildHeaders(readToken: string): Headers {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${readToken}`);
  return headers;
}

function normalizeSummary(raw: RawSummaryResponse): HealthConnectSummary | null {
  if (typeof raw.syncedAt !== "string" || Number.isNaN(Date.parse(raw.syncedAt))) {
    return null;
  }

  if (
    raw.weightUpdatedAt !== null &&
    raw.weightUpdatedAt !== undefined &&
    (typeof raw.weightUpdatedAt !== "string" || Number.isNaN(Date.parse(raw.weightUpdatedAt)))
  ) {
    return null;
  }

  const validSteps =
    raw.stepsLast24h === null ||
    (typeof raw.stepsLast24h === "number" && Number.isFinite(raw.stepsLast24h));
  const validWeight =
    raw.weightKgLatest === null ||
    (typeof raw.weightKgLatest === "number" && Number.isFinite(raw.weightKgLatest));

  if (!validSteps || !validWeight) {
    return null;
  }

  return {
    stepsLast24h: raw.stepsLast24h ?? null,
    weightKgLatest: raw.weightKgLatest ?? null,
    weightUpdatedAt: raw.weightUpdatedAt ?? null,
    syncedAt: raw.syncedAt,
    source: "health-connect"
  };
}

function normalizeMeal(raw: RawMealResponse): MealEntry | null {
  if (
    typeof raw.id !== "string" ||
    typeof raw.name !== "string" ||
    typeof raw.carbsGrams !== "number" ||
    !Number.isFinite(raw.carbsGrams) ||
    typeof raw.eatenAt !== "string" ||
    Number.isNaN(Date.parse(raw.eatenAt))
  ) {
    return null;
  }

  return {
    id: raw.id,
    name: raw.name,
    carbsGrams: Number(raw.carbsGrams.toFixed(2)),
    eatenAt: new Date(raw.eatenAt).toISOString(),
    source: raw.source === "health-connect" ? "health-connect" : "myfitnesspal",
    calories:
      typeof raw.calories === "number" && Number.isFinite(raw.calories)
        ? Number(raw.calories.toFixed(2))
        : undefined
  };
}

export class IntegrationsHttpClient {
  private readonly baseUrl: string;
  private readonly readToken: string;
  private readonly timeoutMs: number;

  constructor(options: IntegrationsHttpClientOptions) {
    this.baseUrl = options.baseUrl;
    this.readToken = options.readToken;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async getHealthSummary(): Promise<HealthConnectSummary | null> {
    const payload = await this.requestJson("/v1/summary");
    if (!payload || typeof payload !== "object") {
      return null;
    }

    return normalizeSummary(payload as RawSummaryResponse);
  }

  async getMeals(days: number): Promise<MealEntry[]> {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date().toISOString();
    const payload = await this.requestJson(
      `/v1/meals?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=1000`
    );

    if (!Array.isArray(payload)) {
      return [];
    }

    return payload
      .map((item) => normalizeMeal(item as RawMealResponse))
      .filter((item): item is MealEntry => item !== null)
      .sort((a, b) => Date.parse(b.eatenAt) - Date.parse(a.eatenAt));
  }

  private async requestJson(path: string): Promise<unknown> {
    const url = ensureUrl(this.baseUrl, path);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: buildHeaders(this.readToken),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Integrations API request failed (${response.status}).`);
      }

      return (await response.json()) as unknown;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Integrations API request timed out.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
