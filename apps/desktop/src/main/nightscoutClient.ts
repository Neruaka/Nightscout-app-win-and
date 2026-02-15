import type {
  GlucoseEntry,
  NightscoutClient,
  TreatmentEntry,
  TrendSummary
} from "@nightscout/shared-types";

interface NightscoutHttpClientOptions {
  baseUrl: string;
  readToken: string;
  timeoutMs?: number;
}

interface RawNightscoutEntry {
  date?: number;
  dateString?: string;
  sgv?: number;
  direction?: string;
  device?: string;
}

interface RawTreatmentEntry {
  _id?: string;
  created_at?: string;
  eventType?: string;
  insulin?: number;
  carbs?: number;
  notes?: string;
  enteredBy?: string;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function ensureHttpsUrl(baseUrl: string, path: string, params?: URLSearchParams): URL {
  const normalized = baseUrl.replace(/\/+$/, "");
  const url = new URL(`${normalized}${path}`);
  if (params) {
    url.search = params.toString();
  }
  return url;
}

function buildHeaders(readToken: string): Headers {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${readToken}`);
  return headers;
}

function parseDate(raw: RawNightscoutEntry): number | null {
  if (typeof raw.date === "number" && Number.isFinite(raw.date)) {
    return raw.date;
  }

  if (typeof raw.dateString === "string") {
    const parsed = Date.parse(raw.dateString);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function normalizeEntry(raw: RawNightscoutEntry): GlucoseEntry | null {
  const date = parseDate(raw);
  const sgv = raw.sgv;

  if (!date || typeof sgv !== "number" || !Number.isFinite(sgv)) {
    return null;
  }

  return {
    date,
    dateString: raw.dateString ?? new Date(date).toISOString(),
    sgv,
    direction: raw.direction,
    device: raw.device
  };
}

function normalizeTreatment(raw: RawTreatmentEntry): TreatmentEntry | null {
  if (typeof raw.created_at !== "string") {
    return null;
  }

  if (Number.isNaN(Date.parse(raw.created_at))) {
    return null;
  }

  return {
    _id: raw._id,
    created_at: raw.created_at,
    eventType: raw.eventType,
    insulin: raw.insulin,
    carbs: raw.carbs,
    notes: raw.notes,
    enteredBy: raw.enteredBy
  };
}

function parseEntriesPayload(rawPayload: unknown): GlucoseEntry[] {
  if (!Array.isArray(rawPayload)) {
    throw new Error("Nightscout response payload is invalid.");
  }

  return rawPayload
    .map((item) => normalizeEntry(item as RawNightscoutEntry))
    .filter((item): item is GlucoseEntry => item !== null);
}

function parseTreatmentsPayload(rawPayload: unknown): TreatmentEntry[] {
  if (!Array.isArray(rawPayload)) {
    throw new Error("Nightscout treatment payload is invalid.");
  }

  return rawPayload
    .map((item) => normalizeTreatment(item as RawTreatmentEntry))
    .filter((item): item is TreatmentEntry => item !== null);
}

export function computeTrendSummary(entries: GlucoseEntry[]): TrendSummary {
  if (entries.length === 0) {
    return {
      current: null,
      delta: null,
      direction: null,
      updatedAt: null
    };
  }

  const sorted = [...entries].sort((a, b) => b.date - a.date);
  const latest = sorted[0];
  const previous = sorted[1];

  return {
    current: latest.sgv,
    delta: previous ? latest.sgv - previous.sgv : null,
    direction: latest.direction ?? null,
    updatedAt: latest.dateString
  };
}

export class NightscoutHttpClient implements NightscoutClient {
  private readonly baseUrl: string;
  private readonly readToken: string;
  private readonly timeoutMs: number;

  constructor(options: NightscoutHttpClientOptions) {
    this.baseUrl = options.baseUrl;
    this.readToken = options.readToken;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async getLatest(count: number): Promise<GlucoseEntry[]> {
    const params = new URLSearchParams();
    params.set("count", String(count));

    const entries = await this.requestEntries(params);
    return entries.sort((a, b) => b.date - a.date);
  }

  async getEntriesForDays(days: number): Promise<GlucoseEntry[]> {
    const maxEntries = Math.max(1, Math.ceil(days * 24 * 12));
    const entries = await this.getLatest(maxEntries);
    const cutoff = Date.now() - days * DAY_IN_MS;
    return entries.filter((entry) => entry.date >= cutoff).sort((a, b) => b.date - a.date);
  }

  async getSummary(): Promise<TrendSummary> {
    const entries = await this.getLatest(2);
    return computeTrendSummary(entries);
  }

  async getTreatmentsForDays(days: number): Promise<TreatmentEntry[]> {
    const maxTreatments = Math.max(50, Math.ceil(days * 24 * 6));
    const params = new URLSearchParams();
    params.set("count", String(maxTreatments));

    const treatments = await this.requestTreatments(params);
    const cutoff = Date.now() - days * DAY_IN_MS;

    return treatments
      .filter((treatment) => Date.parse(treatment.created_at) >= cutoff)
      .sort(
        (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
      );
  }

  private async requestEntries(params: URLSearchParams): Promise<GlucoseEntry[]> {
    const response = await this.requestWithTokenFallback("/api/v1/entries.json", params);
    const rawPayload: unknown = await response.json();
    return parseEntriesPayload(rawPayload);
  }

  private async requestTreatments(
    params: URLSearchParams
  ): Promise<TreatmentEntry[]> {
    const response = await this.requestWithTokenFallback(
      "/api/v1/treatments.json",
      params
    );
    const rawPayload: unknown = await response.json();
    return parseTreatmentsPayload(rawPayload);
  }

  private async requestWithTokenFallback(
    path: string,
    params: URLSearchParams
  ): Promise<Response> {
    const url = ensureHttpsUrl(this.baseUrl, path, params);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: buildHeaders(this.readToken),
        signal: controller.signal
      });

      if (response.ok) {
        return response;
      }

      if (response.status === 401 || response.status === 403) {
        const fallbackParams = new URLSearchParams(params);
        fallbackParams.set("token", this.readToken);
        const fallbackUrl = ensureHttpsUrl(this.baseUrl, path, fallbackParams);
        const fallbackResponse = await fetch(fallbackUrl, {
          method: "GET",
          headers: new Headers({ Accept: "application/json" }),
          signal: controller.signal
        });

        if (!fallbackResponse.ok) {
          throw new Error(`Nightscout request failed (${fallbackResponse.status}).`);
        }

        return fallbackResponse;
      }

      throw new Error(`Nightscout request failed (${response.status}).`);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Nightscout request timed out.");
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
