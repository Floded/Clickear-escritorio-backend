// Entrypoint del backend embebido en Electron.
// Corre como proceso hijo y reporta la URL asignada por IPC; si se ejecuta
// standalone, imprime la URL en stdout.
import type { AddressInfo } from "node:net";

import { createApp } from "./app.js";

export interface DesktopBackend {
  url: string;
  close: () => Promise<void>;
}

export interface DesktopBackendOptions {
  /** Directorio del build de React. Si no existe, solo se sirve el API. */
  frontendDist?: string;
  /** 0 = puerto libre asignado por el SO (comportamiento de producción). */
  port?: number;
}

export function startDesktopBackend(options: DesktopBackendOptions = {}): Promise<DesktopBackend> {
  return new Promise((resolve, reject) => {
    const app = createApp({ mode: "desktop", frontendDist: options.frontendDist });

    const server = app.listen(options.port ?? 0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((done, fail) =>
            server.close((error) => (error ? fail(error) : done()))
          ),
      });
    });

    server.on("error", reject);
  });
}

async function run(): Promise<void> {
  const backend = await startDesktopBackend({
    frontendDist: process.env.FRONTEND_DIST,
    port: Number(process.env.PORT) || 0,
  });

  if (process.send) {
    process.send({ type: "ready", url: backend.url });
  } else {
    console.log(`[desktop] backend en ${backend.url}`);
  }

  const shutdown = () => {
    void backend.close().then(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

void run().catch((error) => {
  console.error("[desktop] no se pudo iniciar el backend:", error);
  process.exit(1);
});
