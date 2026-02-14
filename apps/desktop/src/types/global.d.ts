import type {
  DashboardIpcResponse,
  NightscoutDesktopSettings,
  SaveDesktopSettingsInput
} from "@nightscout/shared-types";

declare global {
  interface Window {
    nightscoutApi: {
      getSettings: () => Promise<NightscoutDesktopSettings>;
      saveSettings: (input: SaveDesktopSettingsInput) => Promise<NightscoutDesktopSettings>;
      removeReadToken: () => Promise<NightscoutDesktopSettings>;
      getDashboard: () => Promise<DashboardIpcResponse>;
    };
  }
}

export {};
