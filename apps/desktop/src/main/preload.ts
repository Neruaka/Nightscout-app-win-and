import { contextBridge, ipcRenderer } from "electron";
import type {
  DashboardIpcResponse,
  InsulinTherapyProfile,
  NightscoutDesktopSettings,
  SaveAppPreferencesInput,
  SaveDesktopSettingsInput,
  SaveIntegrationSettingsInput,
  SyncResponse
} from "@nightscout/shared-types";

const api = {
  getSettings: (): Promise<NightscoutDesktopSettings> =>
    ipcRenderer.invoke("desktop:get-settings"),
  saveSettings: (input: SaveDesktopSettingsInput): Promise<NightscoutDesktopSettings> =>
    ipcRenderer.invoke("desktop:save-settings", input),
  saveInsulinProfile: (profile: InsulinTherapyProfile): Promise<NightscoutDesktopSettings> =>
    ipcRenderer.invoke("desktop:save-insulin-profile", profile),
  saveIntegrationSettings: (
    input: SaveIntegrationSettingsInput
  ): Promise<NightscoutDesktopSettings> =>
    ipcRenderer.invoke("desktop:save-integration-settings", input),
  saveAppPreferences: (
    input: SaveAppPreferencesInput
  ): Promise<NightscoutDesktopSettings> =>
    ipcRenderer.invoke("desktop:save-app-preferences", input),
  removeReadToken: (): Promise<NightscoutDesktopSettings> =>
    ipcRenderer.invoke("desktop:remove-read-token"),
  getDashboard: (): Promise<DashboardIpcResponse> =>
    ipcRenderer.invoke("desktop:get-dashboard"),
  syncIntegrations: (input?: SaveIntegrationSettingsInput): Promise<SyncResponse> =>
    ipcRenderer.invoke("desktop:sync-integrations", input),
  openWidget: (): Promise<boolean> => ipcRenderer.invoke("desktop:widget-open"),
  closeWidget: (): Promise<boolean> => ipcRenderer.invoke("desktop:widget-close"),
  setWidgetAlwaysOnTop: (isPinned: boolean): Promise<boolean> =>
    ipcRenderer.invoke("desktop:widget-set-always-on-top", isPinned)
};

contextBridge.exposeInMainWorld("nightscoutApi", api);
