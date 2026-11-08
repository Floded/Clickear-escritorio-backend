import { app, BrowserWindow, ipcMain } from "electron";
import { fork, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const isDev = !app.isPackaged;
const REMOTE_URL = process.env.CLICKEAR_REMOTE_URL ?? "https://clickear.onrender.com";

type AppMode = "online" | "offline";

function modeFile(): string {
  return path.join(app.getPath("userData"), "mode");
}

function loadMode(): AppMode {
  try {
    const value = fs.readFileSync(modeFile(), "utf8").trim();
    return value === "online" ? "online" : "offline";
  } catch {
    return "offline";
  }
}

function saveMode(mode: AppMode): void {
  fs.writeFileSync(modeFile(), mode, { mode: 0o600 });
}
const READY_TIMEOUT_MS = 15_000;

interface BackendHandle {
  process: ChildProcess;
  url: string;
}

const ROOT_DIR = path.join(__dirname, "..", "..");

function backendEntry(): string {
  return isDev
    ? path.join(ROOT_DIR, "backend", "dist-desktop", "main.cjs")
    : path.join(process.resourcesPath, "backend", "main.cjs");
}

function prismaEngine(): string {
  const dir = isDev
    ? path.join(ROOT_DIR, "backend", "generated", "sqlite")
    : path.join(process.resourcesPath, "prisma");
  const engine = fs
    .readdirSync(dir)
    .find((file) => file.startsWith("libquery_engine-") || file.startsWith("query_engine-"));
  if (!engine) throw new Error(`Engine de Prisma no encontrado en ${dir}`);
  return path.join(dir, engine);
}

function sqliteMigrationsDir(): string {
  return isDev
    ? path.join(ROOT_DIR, "backend", "prisma", "sqlite-migrations")
    : path.join(process.resourcesPath, "sqlite-migrations");
}

function frontendDist(): string {
  return isDev
    ? path.join(ROOT_DIR, "..", "Clickear", "Frontend", "dist")
    : path.join(process.resourcesPath, "frontend");
}

// Secreto local generado una vez y persistido con permisos de usuario (0600)
function loadJwtSecret(): string {
  const file = path.join(app.getPath("userData"), "jwt-secret");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();

  const secret = crypto.randomBytes(48).toString("hex");
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

function startBackend(): Promise<BackendHandle> {
  const entry = backendEntry();
  if (!fs.existsSync(entry)) {
    throw new Error(`Backend no compilado en ${entry}. Ejecutá "npm run backend:bundle".`);
  }

  const child = fork(entry, [], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      JWT_SECRET: loadJwtSecret(),
      DATABASE_PROVIDER: "sqlite",
      DATABASE_URL: `file:${path.join(app.getPath("userData"), "clickear.db")}?connection_limit=1`,
      PRISMA_QUERY_ENGINE_LIBRARY: prismaEngine(),
      SQLITE_MIGRATIONS_DIR: sqliteMigrationsDir(),
      FRONTEND_DIST: frontendDist(),
    },
  });

  return new Promise<BackendHandle>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("El backend no respondió a tiempo"));
    }, READY_TIMEOUT_MS);

    child.once("message", (message: { type?: string; url?: string }) => {
      if (message?.type !== "ready" || !message.url) return;
      clearTimeout(timer);
      resolve({ process: child, url: message.url });
    });

    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`El backend terminó inesperadamente (código ${code})`));
    });
  });
}

function createWindow(url: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.once("ready-to-show", () => window.show());
  window.webContents.once("did-finish-load", () => {
    console.log(`[electron] ventana lista en ${url}`);
  });
  window.webContents.on("did-fail-load", (_event, code, description) => {
    console.error(`[electron] fallo de carga (${code}): ${description}`);
  });
  void window.loadURL(url);

  return window;
}

let backend: BackendHandle | null = null;
let currentMode: AppMode = "offline";

app.whenReady().then(async () => {
  currentMode = loadMode();
  try {
    backend = await startBackend();
  } catch (error) {
    console.error("[electron] backend no disponible:", error);
    app.quit();
    return;
  }

  ipcMain.handle("app:info", () => ({
    version: app.getVersion(),
    platform: process.platform,
    backendUrl: backend?.url,
    mode: currentMode,
    remoteUrl: REMOTE_URL,
  }));

  ipcMain.handle("app:mode:get", () => currentMode);
  ipcMain.handle("app:mode:set", (_event, mode: unknown) => {
    if (mode !== "online" && mode !== "offline") {
      throw new Error("Modo invalido");
    }
    currentMode = mode;
    saveMode(mode);
    return currentMode;
  });

  createWindow(backend.url);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && backend) createWindow(backend.url);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  backend?.process.kill();
  backend = null;
});
