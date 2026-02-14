import { contextBridge, ipcRenderer } from "electron";
import type {
  DashboardIpcResponse,
  NightscoutDesktopSettings,
  SaveDesktopSettingsInput
} from "@nightscout/shared-types";

const api = {
  getSettings: (): Promise<NightscoutDesktopSettings> =>
    ipcRenderer.invoke("desktop:get-settings"),
  saveSettings: (input: SaveDesktopSettingsInput): Promise<NightscoutDesktopSettings> =>
    ipcRenderer.invoke("desktop:save-settings", input),
  removeReadToken: (): Promise<NightscoutDesktopSettings> =>
    ipcRenderer.invoke("desktop:remove-read-token"),
  getDashboard: (): Promise<DashboardIpcResponse> =>
    ipcRenderer.invoke("desktop:get-dashboard")
};

contextBridge.exposeInMainWorld("nightscoutApi", api);
