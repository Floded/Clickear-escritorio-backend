import { contextBridge, ipcRenderer } from "electron";

export type AppMode = "online" | "offline";

export interface DesktopApi {
  platform: NodeJS.Platform;
  getAppInfo: () => Promise<{
    version: string;
    platform: NodeJS.Platform;
    backendUrl?: string;
    mode: AppMode;
    remoteUrl: string;
  }>;
  getMode: () => Promise<AppMode>;
  setMode: (mode: AppMode) => Promise<AppMode>;
}

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  getAppInfo: () => ipcRenderer.invoke("app:info"),
  getMode: () => ipcRenderer.invoke("app:mode:get"),
  setMode: (mode: AppMode) => ipcRenderer.invoke("app:mode:set", mode),
} satisfies DesktopApi);
