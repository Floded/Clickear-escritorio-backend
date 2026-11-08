import path from "node:path";

import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "./vitest.config";

const databaseFile = path.resolve("prisma", "test-sqlite.db");

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      env: {
        DATABASE_PROVIDER: "sqlite",
        // Ruta absoluta: Prisma resuelve los `file:` relativos al schema generado
        DATABASE_URL: `file:${databaseFile}?connection_limit=1`,
      },
      globalSetup: ["src/test/sqlite-global-setup.ts"],
    },
  }),
);
