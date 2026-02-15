import Store from "electron-store";
import * as keytar from "keytar";
import type {
  DashboardPayload,
  DisplayUnits,
  InsulinTherapyProfile,
  IntegrationSettingsState,
  NightscoutDesktopSettings,
  SaveDesktopSettingsInput,
  SaveIntegrationSettingsInput
} from "@nightscout/shared-types";

const KEYCHAIN_SERVICE = "nightscout-desktop";
const KEYCHAIN_ACCOUNT = "nightscout-read-token";
const INTEGRATIONS_READ_TOKEN_ACCOUNT = "integrations-read-token";

const DEFAULT_INSULIN_PROFILE: InsulinTherapyProfile = {
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

interface LocalStoreShape {
  baseUrl: string;
  units: DisplayUnits;
  insulinProfile: InsulinTherapyProfile;
  integrationApiUrl: string;
  lastPayload?: DashboardPayload;
}

function normalizeBaseUrl(raw: string): string {
  const value = raw.trim();
  if (!value) {
    return "";
  }
  return value.replace(/\/+$/, "");
}

function normalizeIntegrationApiUrl(raw: string): string {
  const value = raw.trim();
  if (!value) {
    return "";
  }

  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    throw new Error("Integrations API URL must start with http:// or https://.");
  }

  return value.replace(/\/+$/, "");
}

function isValidTimeHHMM(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function validateInsulinProfile(profile: InsulinTherapyProfile): void {
  if (!Array.isArray(profile.ratioWindows) || profile.ratioWindows.length === 0) {
    throw new Error("At least one insulin ratio window is required.");
  }

  for (const window of profile.ratioWindows) {
    if (!isValidTimeHHMM(window.startHHMM) || !isValidTimeHHMM(window.endHHMM)) {
      throw new Error("Ratio window time must use HH:MM.");
    }
    if (!Number.isFinite(window.gramsPerUnit) || window.gramsPerUnit <= 0) {
      throw new Error("Ratio grams per unit must be positive.");
    }
  }

  if (
    !Number.isFinite(profile.correctionFactorDropGLPerUnit) ||
    profile.correctionFactorDropGLPerUnit <= 0
  ) {
    throw new Error("Correction factor must be positive.");
  }

  if (!Number.isFinite(profile.targetLowGL) || profile.targetLowGL <= 0) {
    throw new Error("Target low must be positive.");
  }

  if (
    !Number.isFinite(profile.targetHighGL) ||
    profile.targetHighGL <= profile.targetLowGL
  ) {
    throw new Error("Target high must be greater than target low.");
  }

  if (!Number.isFinite(profile.insulinActionHours) || profile.insulinActionHours <= 0) {
    throw new Error("Insulin action duration must be positive.");
  }

  if (!Number.isFinite(profile.carbAbsorptionHours) || profile.carbAbsorptionHours <= 0) {
    throw new Error("Carb absorption duration must be positive.");
  }
}

export class SettingsStore {
  private readonly store: Store<LocalStoreShape>;

  constructor() {
    this.store = new Store<LocalStoreShape>({
      name: "nightscout-desktop",
      defaults: {
        baseUrl: "",
        units: "mmol",
        insulinProfile: DEFAULT_INSULIN_PROFILE,
        integrationApiUrl: ""
      }
    });
  }

  getBaseUrl(): string {
    return this.store.get("baseUrl", "");
  }

  getUnits(): DisplayUnits {
    return this.store.get("units", "mmol");
  }

  getInsulinProfile(): InsulinTherapyProfile {
    return this.store.get("insulinProfile", DEFAULT_INSULIN_PROFILE);
  }

  saveInsulinProfile(profile: InsulinTherapyProfile): InsulinTherapyProfile {
    validateInsulinProfile(profile);
    this.store.set("insulinProfile", profile);
    return this.getInsulinProfile();
  }

  getIntegrationApiUrl(): string {
    return this.store.get("integrationApiUrl", "");
  }

  setIntegrationApiUrl(url: string): void {
    this.store.set("integrationApiUrl", normalizeIntegrationApiUrl(url));
  }

  async getReadToken(): Promise<string | null> {
    return keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  }

  async getIntegrationReadToken(): Promise<string | null> {
    return keytar.getPassword(KEYCHAIN_SERVICE, INTEGRATIONS_READ_TOKEN_ACCOUNT);
  }

  async getIntegrationSettings(): Promise<IntegrationSettingsState> {
    const integrationReadToken = await this.getIntegrationReadToken();

    return {
      integrationApiUrl: this.getIntegrationApiUrl(),
      hasIntegrationReadToken: Boolean(integrationReadToken)
    };
  }

  async saveIntegrationSettings(
    input: SaveIntegrationSettingsInput
  ): Promise<IntegrationSettingsState> {
    if (typeof input.integrationReadToken === "string") {
      const token = input.integrationReadToken.trim();
      if (token) {
        await keytar.setPassword(KEYCHAIN_SERVICE, INTEGRATIONS_READ_TOKEN_ACCOUNT, token);
      } else {
        await keytar.deletePassword(KEYCHAIN_SERVICE, INTEGRATIONS_READ_TOKEN_ACCOUNT);
      }
    }

    if (typeof input.integrationApiUrl === "string") {
      this.setIntegrationApiUrl(input.integrationApiUrl);
    }

    return this.getIntegrationSettings();
  }

  async getPublicSettings(): Promise<NightscoutDesktopSettings> {
    const token = await this.getReadToken();
    const integrations = await this.getIntegrationSettings();

    return {
      baseUrl: this.getBaseUrl(),
      hasReadToken: Boolean(token),
      units: this.getUnits(),
      insulinProfile: this.getInsulinProfile(),
      integrations
    };
  }

  async saveSettings(
    input: SaveDesktopSettingsInput
  ): Promise<NightscoutDesktopSettings> {
    const baseUrl = normalizeBaseUrl(input.baseUrl);

    if (!baseUrl) {
      throw new Error("Nightscout base URL is required.");
    }

    if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
      throw new Error("Nightscout base URL must start with http:// or https://.");
    }

    this.store.set("baseUrl", baseUrl);
    this.store.set("units", input.units);

    if (typeof input.readToken === "string") {
      const token = input.readToken.trim();
      if (token) {
        await keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, token);
      } else {
        await keytar.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
      }
    }

    return this.getPublicSettings();
  }

  async removeReadToken(): Promise<NightscoutDesktopSettings> {
    await keytar.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
    return this.getPublicSettings();
  }

  getCachedPayload(): DashboardPayload | undefined {
    return this.store.get("lastPayload");
  }

  setCachedPayload(payload: DashboardPayload): void {
    this.store.set("lastPayload", payload);
  }
}
