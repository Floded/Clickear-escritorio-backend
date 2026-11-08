import { PrismaClient } from "@prisma/client";

import { PrismaClient as SqlitePrismaClient } from "../../generated/sqlite/index.js";

export type DatabaseProvider = "postgres" | "sqlite";

export const databaseProvider: DatabaseProvider =
  process.env.DATABASE_PROVIDER === "sqlite" ? "sqlite" : "postgres";

export const isSqlite = databaseProvider === "sqlite";

// Entidades sincronizables (PascalCase, como las reporta Prisma en extensions).
const SYNCED_ENTITIES = new Set([
  "Establishment",
  "Ticket",
  "Employee",
  "InventoryItem",
  "Supplier",
  "Technician",
  "Budget",
  "DispatchOrder",
  "ItemAssignment",
  "TicketAssignment",
  "BudgetLine",
  "Invoice",
]);

const DATE_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "dispatchTimestamp",
  "openingTimestamp",
  "assignedAt",
  "releasedAt",
  "deliveryDate",
  "returnDate",
  "issueDate",
  "validUntil",
  "caeExpirationDate",
  "timestamp",
]);

function toJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = toJsonValue(nested);
    }
    return out;
  }
  return value;
}

function entityName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

function idFieldFor(model: string): string {
  if (model === "Establishment") return "cue";
  if (model === "Ticket") return "ticketId";
  return "id";
}

// Registra un cambio en el outbox para que se sincronice cuando vuelva la red.
async function recordOutbox(
  baseClient: PrismaClient,
  model: string,
  operation: "create" | "update" | "delete" | "upsert",
  record: Record<string, unknown> | null,
): Promise<void> {
  if (process.env.SYNC_OUTBOX_ENABLED !== "true") return;
  if (!SYNCED_ENTITIES.has(model) || !record) return;

  const idField = idFieldFor(model);
  const rawId = record[idField];
  const entityId = rawId === null || rawId === undefined ? "" : String(rawId);
  const updatedAt =
    record.updatedAt instanceof Date ? record.updatedAt : new Date(record.updatedAt as string | number);

  try {
    await (baseClient as any).pendingSync.create({
      data: {
        entity: entityName(model),
        entityId,
        operation: operation === "upsert" ? "update" : operation,
        payload: toJsonValue(record) as any,
        updatedAt,
      },
    });
  } catch {
    // No bloquear la operación principal si falla el outbox
  }
}

const baseClient: PrismaClient = isSqlite
  ? (new SqlitePrismaClient() as unknown as PrismaClient)
  : new PrismaClient();

let client: PrismaClient = baseClient;

if (process.env.SYNC_OUTBOX_ENABLED === "true" && isSqlite) {
  client = baseClient.$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          const result = await query(args);
          void recordOutbox(baseClient, model, "create", result as Record<string, unknown>);
          return result;
        },
        async update({ model, args, query }) {
          const result = await query(args);
          void recordOutbox(baseClient, model, "update", result as Record<string, unknown>);
          return result;
        },
        async upsert({ model, args, query }) {
          const result = await query(args);
          void recordOutbox(baseClient, model, "upsert", result as Record<string, unknown>);
          return result;
        },
        async delete({ model, args, query }) {
          const result = await query(args);
          void recordOutbox(baseClient, model, "delete", result as Record<string, unknown>);
          return result;
        },
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma: PrismaClient = client;