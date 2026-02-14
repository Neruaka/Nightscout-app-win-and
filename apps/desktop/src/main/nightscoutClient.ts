import type { GlucoseEntry, NightscoutClient, TrendSummary } from "@nightscout/shared-types";

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

function parseEntriesPayload(rawPayload: unknown): GlucoseEntry[] {
  if (!Array.isArray(rawPayload)) {
    throw new Error("Nightscout response payload is invalid.");
  }

  return rawPayload
    .map((item) => normalizeEntry(item as RawNightscoutEntry))
    .filter((item): item is GlucoseEntry => item !== null);
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

  async get24hSeries(): Promise<GlucoseEntry[]> {
    const entries = await this.getLatest(288);
    const cutoff = Date.now() - DAY_IN_MS;
    return entries.filter((entry) => entry.date >= cutoff).sort((a, b) => b.date - a.date);
  }

  async getSummary(): Promise<TrendSummary> {
    const entries = await this.getLatest(2);
    return computeTrendSummary(entries);
  }

  private async requestEntries(params: URLSearchParams): Promise<GlucoseEntry[]> {
    const url = ensureHttpsUrl(this.baseUrl, "/api/v1/entries.json", params);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: buildHeaders(this.readToken),
        signal: controller.signal
      });

      if (response.ok) {
        const rawPayload: unknown = await response.json();
        return parseEntriesPayload(rawPayload);
      }

      if (response.status === 401 || response.status === 403) {
        const fallbackParams = new URLSearchParams(params);
        fallbackParams.set("token", this.readToken);

        const fallbackUrl = ensureHttpsUrl(
          this.baseUrl,
          "/api/v1/entries.json",
          fallbackParams
        );
        const fallbackResponse = await fetch(fallbackUrl, {
          method: "GET",
          headers: new Headers({ Accept: "application/json" }),
          signal: controller.signal
        });

        if (!fallbackResponse.ok) {
          throw new Error(`Nightscout request failed (${fallbackResponse.status}).`);
        }

        const rawPayload: unknown = await fallbackResponse.json();
        return parseEntriesPayload(rawPayload);
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
