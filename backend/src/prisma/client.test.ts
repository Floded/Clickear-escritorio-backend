import "../env.js";

import { describe, expect, it } from "vitest";

import { databaseProvider, isSqlite, prisma } from "./client.js";

describe("prisma client", () => {
  it("expone el cliente del proveedor activo", async () => {
    const rows = await prisma.$queryRawUnsafe<{ ok: number }[]>("SELECT 1 AS ok");
    expect(Number(rows[0].ok)).toBe(1);
  });

  it("detecta el proveedor desde DATABASE_PROVIDER", () => {
    expect(databaseProvider).toBe(process.env.DATABASE_PROVIDER === "sqlite" ? "sqlite" : "postgres");
    expect(isSqlite).toBe(databaseProvider === "sqlite");
  });
});
