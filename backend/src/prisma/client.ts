import { PrismaClient } from "@prisma/client";

import { PrismaClient as SqlitePrismaClient } from "../../generated/sqlite/index.js";

export type DatabaseProvider = "postgres" | "sqlite";

export const databaseProvider: DatabaseProvider =
  process.env.DATABASE_PROVIDER === "sqlite" ? "sqlite" : "postgres";

export const isSqlite = databaseProvider === "sqlite";

// Ambos clientes comparten el esquema lógico: se expone el tipo de Prisma para
// que los servicios no dependan del proveedor activo en runtime.
export const prisma: PrismaClient = isSqlite
  ? (new SqlitePrismaClient() as unknown as PrismaClient)
  : new PrismaClient();
