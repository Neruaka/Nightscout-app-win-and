import type {
  DashboardIpcResponse,
  InsulinTherapyProfile,
  NightscoutDesktopSettings,
  SaveAppPreferencesInput,
  SaveDesktopSettingsInput,
  SaveIntegrationSettingsInput,
  SyncResponse
} from "@nightscout/shared-types";

declare global {
  interface Window {
    nightscoutApi: {
      getSettings: () => Promise<NightscoutDesktopSettings>;
      saveSettings: (input: SaveDesktopSettingsInput) => Promise<NightscoutDesktopSettings>;
      saveInsulinProfile: (
        profile: InsulinTherapyProfile
      ) => Promise<NightscoutDesktopSettings>;
      saveIntegrationSettings: (
        input: SaveIntegrationSettingsInput
      ) => Promise<NightscoutDesktopSettings>;
      saveAppPreferences: (
        input: SaveAppPreferencesInput
      ) => Promise<NightscoutDesktopSettings>;
      removeReadToken: () => Promise<NightscoutDesktopSettings>;
      getDashboard: () => Promise<DashboardIpcResponse>;
      syncIntegrations: (input?: SaveIntegrationSettingsInput) => Promise<SyncResponse>;
      openWidget: () => Promise<boolean>;
      closeWidget: () => Promise<boolean>;
      setWidgetAlwaysOnTop: (isPinned: boolean) => Promise<boolean>;
    };
  }
}

export {};
