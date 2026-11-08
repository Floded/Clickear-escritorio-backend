import { rm } from "node:fs/promises";
import path from "node:path";

// Base limpia por corrida: las migraciones se aplican desde cero.
export default async function setup(): Promise<void> {
  const dbFile = path.resolve("prisma", "test-sqlite.db");
  await rm(dbFile, { force: true });
  await rm(`${dbFile}-journal`, { force: true });
  await rm(`${dbFile}-wal`, { force: true });
  await rm(`${dbFile}-shm`, { force: true });

  process.env.DATABASE_PROVIDER = "sqlite";
  process.env.DATABASE_URL = `file:${dbFile}?connection_limit=1`;

  const { migrateSqlite } = await import("../prisma/sqlite-migrate.js");
  const { prisma } = await import("../prisma/client.js");
  await migrateSqlite();
  await prisma.$disconnect();
}
