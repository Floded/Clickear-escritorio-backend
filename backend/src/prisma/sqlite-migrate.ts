import fs from "node:fs";
import path from "node:path";

import { prisma } from "./client.js";

const MIGRATIONS_TABLE = "_sqlite_migrations";
const MIGRATIONS_DIRS = [
  path.join(process.cwd(), "prisma", "sqlite-migrations"),
  path.join(process.cwd(), "backend", "prisma", "sqlite-migrations"),
];

function resolveMigrationsDir(): string {
  const candidates = [process.env.SQLITE_MIGRATIONS_DIR, ...MIGRATIONS_DIRS].filter(
    (dir): dir is string => Boolean(dir),
  );
  const found = candidates.find((dir) => fs.existsSync(dir));
  if (!found) {
    throw new Error(`Migraciones SQLite no encontradas. Rutas probadas: ${candidates.join(", ")}`);
  }
  return found;
}

// SQLite no ejecuta múltiples sentencias por llamada: se separan por ';'
// descartando los comentarios generados por `prisma migrate diff`.
function splitStatements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

/**
 * Aplica las migraciones SQLite pendientes.
 * Idempotente: cada carpeta de `sqlite-migrations/` se registra una sola vez.
 */
export async function migrateSqlite(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" ("id" TEXT NOT NULL PRIMARY KEY, "applied_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  );

  const applied = new Set(
    (await prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "${MIGRATIONS_TABLE}"`)).map(
      (row) => row.id,
    ),
  );

  const migrationsDir = resolveMigrationsDir();
  const migrations = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const id of migrations) {
    if (applied.has(id)) continue;

    const file = path.join(migrationsDir, id, "migration.sql");
    if (!fs.existsSync(file)) continue;

    // Atómico: si una sentencia falla no queda la migración a medias
    const statements = splitStatements(fs.readFileSync(file, "utf8"));
    await prisma.$transaction(async (tx) => {
      for (const statement of statements) {
        await tx.$executeRawUnsafe(statement);
      }
      await tx.$executeRawUnsafe(`INSERT INTO "${MIGRATIONS_TABLE}" ("id") VALUES (?)`, id);
    });
  }
}
