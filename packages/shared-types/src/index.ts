export type DisplayUnits = "mmol" | "mg/dL";

export interface GlucoseEntry {
  date: number;
  dateString: string;
  sgv: number;
  direction?: string;
  device?: string;
}

export interface TrendSummary {
  current: number | null;
  delta: number | null;
  direction: string | null;
  updatedAt: string | null;
}

export interface DashboardPayload {
  entries: GlucoseEntry[];
  summary: TrendSummary;
  fetchedAt: string;
  source: "network" | "cache";
  stale: boolean;
}

export interface NightscoutClient {
  getLatest(count: number): Promise<GlucoseEntry[]>;
  get24hSeries(): Promise<GlucoseEntry[]>;
  getSummary(): Promise<TrendSummary>;
}

export interface NightscoutDesktopSettings {
  baseUrl: string;
  hasReadToken: boolean;
  units: DisplayUnits;
}

export interface SaveDesktopSettingsInput {
  baseUrl: string;
  readToken?: string;
  units: DisplayUnits;
}

export interface DashboardError {
  message: string;
  canUseCachedData: boolean;
}

export interface DashboardIpcResponse {
  payload: DashboardPayload | null;
  error: DashboardError | null;
}
