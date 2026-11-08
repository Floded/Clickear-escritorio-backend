import { contextBridge, ipcRenderer } from "electron";

export interface DesktopApi {
  platform: NodeJS.Platform;
  getAppInfo: () => Promise<{
    version: string;
    platform: NodeJS.Platform;
    backendUrl?: string;
  }>;
}

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  getAppInfo: () => ipcRenderer.invoke("app:info"),
} satisfies DesktopApi);
