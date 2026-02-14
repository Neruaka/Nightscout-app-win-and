import Store from "electron-store";
import * as keytar from "keytar";
import type {
  DashboardPayload,
  DisplayUnits,
  NightscoutDesktopSettings,
  SaveDesktopSettingsInput
} from "@nightscout/shared-types";

const KEYCHAIN_SERVICE = "nightscout-desktop";
const KEYCHAIN_ACCOUNT = "nightscout-read-token";

interface LocalStoreShape {
  baseUrl: string;
  units: DisplayUnits;
  lastPayload?: DashboardPayload;
}

function normalizeBaseUrl(raw: string): string {
  const value = raw.trim();
  if (!value) {
    return "";
  }

  return value.replace(/\/+$/, "");
}

export class SettingsStore {
  private readonly store: Store<LocalStoreShape>;

  constructor() {
    this.store = new Store<LocalStoreShape>({
      name: "nightscout-desktop",
      defaults: {
        baseUrl: "",
        units: "mmol"
      }
    });
  }

  getBaseUrl(): string {
    return this.store.get("baseUrl", "");
  }

  getUnits(): DisplayUnits {
    return this.store.get("units", "mmol");
  }

  async getReadToken(): Promise<string | null> {
    return keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  }

  async getPublicSettings(): Promise<NightscoutDesktopSettings> {
    const token = await this.getReadToken();

    return {
      baseUrl: this.getBaseUrl(),
      hasReadToken: Boolean(token),
      units: this.getUnits()
    };
  }

  async saveSettings(input: SaveDesktopSettingsInput): Promise<NightscoutDesktopSettings> {
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
