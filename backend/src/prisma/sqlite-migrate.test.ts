import "../env.js";

import { describe, expect, it } from "vitest";

import { isSqlite, prisma } from "./client.js";
import { migrateSqlite } from "./sqlite-migrate.js";

describe.skipIf(!isSqlite)("migrateSqlite", () => {
  it("aplica las migraciones pendientes una sola vez", async () => {
    await migrateSqlite();
    await migrateSqlite();

    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT "id" FROM "_sqlite_migrations" ORDER BY "id"`,
    );
    const ids = rows.map((row) => row.id);

    expect(ids).toContain("0001_init");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("crea las tablas del esquema", async () => {
    const tables = await prisma.$queryRawUnsafe<{ name: string }[]>(
      `SELECT "name" FROM "sqlite_master" WHERE "type" = 'table' AND "name" IN ('tickets', 'users')`,
    );
    expect(tables.map((table) => table.name).sort()).toEqual(["tickets", "users"]);
  });
});
