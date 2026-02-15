export type DisplayUnits = "mmol" | "mg/dL";
export type LanguageCode = "en" | "fr";
export type WidgetLayout = "minimal" | "compact" | "chart";

export interface GlucoseEntry {
  date: number;
  dateString: string;
  sgv: number;
  direction?: string;
  device?: string;
}

export interface TreatmentEntry {
  _id?: string;
  created_at: string;
  eventType?: string;
  insulin?: number;
  carbs?: number;
  notes?: string;
  enteredBy?: string;
}

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

export interface TrendSummary {
  current: number | null;
  delta: number | null;
  direction: string | null;
  updatedAt: string | null;
}

export interface DashboardPayload {
  entries: GlucoseEntry[];
  summary: TrendSummary;
  treatments: TreatmentEntry[];
  meals: MealEntry[];
  healthConnect: HealthConnectSummary | null;
  fetchedAt: string;
  source: "network" | "cache";
  stale: boolean;
}

export interface NightscoutClient {
  getLatest(count: number): Promise<GlucoseEntry[]>;
  getEntriesForDays(days: number): Promise<GlucoseEntry[]>;
  getSummary(): Promise<TrendSummary>;
  getTreatmentsForDays(days: number): Promise<TreatmentEntry[]>;
}

export interface InsulinRatioWindow {
  id: string;
  startHHMM: string;
  endHHMM: string;
  gramsPerUnit: number;
}

export interface TargetRangeWindow {
  id: string;
  startHHMM: string;
  endHHMM: string;
  lowGL: number;
  highGL: number;
}

export interface InsulinTherapyProfile {
  ratioWindows: InsulinRatioWindow[];
  targetWindows?: TargetRangeWindow[];
  correctionFactorDropGLPerUnit: number;
  targetLowGL: number;
  targetHighGL: number;
  insulinActionHours: number;
  carbAbsorptionHours: number;
}

export interface IntegrationSettingsState {
  integrationApiUrl: string;
  hasIntegrationReadToken: boolean;
}

export interface AppPreferences {
  language: LanguageCode;
  startWithWindows: boolean;
  widgetLayout: WidgetLayout;
}

export interface NightscoutDesktopSettings {
  baseUrl: string;
  hasReadToken: boolean;
  units: DisplayUnits;
  insulinProfile: InsulinTherapyProfile;
  integrations: IntegrationSettingsState;
  appPreferences: AppPreferences;
}

export interface SaveDesktopSettingsInput {
  baseUrl: string;
  readToken?: string;
  units: DisplayUnits;
}

export interface SaveIntegrationSettingsInput {
  integrationApiUrl?: string;
  integrationReadToken?: string;
}

export interface SaveAppPreferencesInput {
  language?: LanguageCode;
  startWithWindows?: boolean;
  widgetLayout?: WidgetLayout;
}

export interface DashboardError {
  message: string;
  canUseCachedData: boolean;
}

export interface DashboardIpcResponse {
  payload: DashboardPayload | null;
  error: DashboardError | null;
}

export interface SyncResponse {
  ok: boolean;
  message: string;
}

export interface TimeInRangeBucket {
  label: "day" | "week" | "month";
  from: string;
  to: string;
  count: number;
  inRangePct: number;
  lowPct: number;
  highPct: number;
  avgGL: number | null;
}

export interface TimeInRangeStats {
  day: TimeInRangeBucket;
  week: TimeInRangeBucket;
  month: TimeInRangeBucket;
}

export interface IobCobSnapshot {
  iobUnits: number;
  cobGrams: number;
}

export interface InsulinAdviceInput {
  carbsGrams: number;
  currentGlucoseGL: number;
  mealTimeHHMM: string;
  profile: InsulinTherapyProfile;
  iobUnits?: number;
  cobGrams?: number;
}

export interface InsulinAdviceResult {
  ratioGramsPerUnit: number;
  carbBolusUnits: number;
  correctionUnits: number;
  adjustedCarbBolusUnits: number;
  adjustedCorrectionUnits: number;
  totalUnits: number;
  adjustedTotalUnits: number;
  roundedHalfUnitDose: number;
  targetLowGL: number;
  targetHighGL: number;
  correctionFactorDropGLPerUnit: number;
  glucoseStatus: "low" | "in-range" | "high";
  notes: string[];
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
