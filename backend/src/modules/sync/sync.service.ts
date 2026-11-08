import { prisma } from "../../prisma/client.js";

// Entidades sincronizables y su clave primaria. Mantener esta lista alineada
// con los modelos que tengan `updatedAt` en el schema.
const ENTITY_CONFIG: Record<string, { delegate: string; idField: string; bigintFields?: string[] }> = {
  establishment: { delegate: "establishment", idField: "cue" },
  ticket: { delegate: "ticket", idField: "ticketId", bigintFields: ["ticketId"] },
  employee: { delegate: "employee", idField: "id" },
  inventoryItem: { delegate: "inventoryItem", idField: "id" },
  supplier: { delegate: "supplier", idField: "id" },
  technician: { delegate: "technician", idField: "id" },
  budget: { delegate: "budget", idField: "id" },
  dispatchOrder: { delegate: "dispatchOrder", idField: "id" },
  itemAssignment: { delegate: "itemAssignment", idField: "id" },
  ticketAssignment: { delegate: "ticketAssignment", idField: "id" },
  budgetLine: { delegate: "budgetLine", idField: "id" },
  invoice: { delegate: "invoice", idField: "id" },
};

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

function normalizeValue(key: string, value: unknown, bigintFields: string[]): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" && DATE_FIELDS.has(key)) return new Date(value);
  if (bigintFields.includes(key) && typeof value === "number") return BigInt(value);
  if (Array.isArray(value)) return value.map((item) => normalizeValue(key, item, bigintFields));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      out[nestedKey] = normalizeValue(nestedKey, nestedValue, bigintFields);
    }
    return out;
  }
  return value;
}

function normalizeData(data: Record<string, unknown>, bigintFields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    out[key] = normalizeValue(key, value, bigintFields);
  }
  return out;
}

function coerceId(config: { idField: string; bigintFields?: string[] }, data: Record<string, unknown>, fallback?: unknown): unknown {
  const raw = data[config.idField] ?? fallback;
  if (config.bigintFields?.includes(config.idField) && typeof raw === "number") return BigInt(raw);
  if (config.bigintFields?.includes(config.idField) && typeof raw === "string") return BigInt(raw);
  return raw;
}

export const syncService = {
  async push(changes: Array<{ entity: string; id?: unknown; updatedAt: string; data: Record<string, unknown>; operation: string }>) {
    const results: Array<Record<string, unknown>> = [];

    for (const change of changes) {
      const config = ENTITY_CONFIG[change.entity];
      if (!config) {
        results.push({ entity: change.entity, status: "unknown_entity" });
        continue;
      }

      const delegate = (prisma as unknown as Record<string, any>)[config.delegate];
      const idValue = coerceId(config, change.data, change.id) as any;
      const data = normalizeData(change.data, config.bigintFields ?? []);
      const incomingUpdatedAt = new Date(change.updatedAt);

      const existing = await delegate.findUnique({ where: { [config.idField]: idValue } });

      if (existing && new Date(existing.updatedAt) >= incomingUpdatedAt) {
        results.push({ entity: change.entity, id: idValue.toString(), status: "conflict", server: existing });
        continue;
      }

      if (change.operation === "delete") {
        if (existing) await delegate.delete({ where: { [config.idField]: idValue } });
        results.push({ entity: change.entity, id: idValue.toString(), status: "deleted" });
        continue;
      }

      const record = await delegate.upsert({
        where: { [config.idField]: idValue },
        create: data,
        update: data,
      });

      results.push({ entity: change.entity, id: idValue.toString(), status: "applied", record });
    }

    return results;
  },

  async pull(since: Date) {
    const out: Record<string, unknown[]> = {};

    for (const [entity, config] of Object.entries(ENTITY_CONFIG)) {
      const delegate = (prisma as unknown as Record<string, any>)[config.delegate];
      const rows = await delegate.findMany({ where: { updatedAt: { gt: since } } });
      if (rows.length > 0) out[entity] = rows;
    }

    return out;
  },

  async pending() {
    return (prisma as any).pendingSync.findMany({
      where: { synced: false },
      orderBy: { id: "asc" },
    });
  },

  async ack(ids: number[]) {
    if (ids.length === 0) return;
    await (prisma as any).pendingSync.updateMany({
      where: { id: { in: ids } },
      data: { synced: true },
    });
  },
};
