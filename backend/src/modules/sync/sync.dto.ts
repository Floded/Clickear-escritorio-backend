import { z } from "zod";

export const syncChangeSchema = z.object({
  entity: z.string().min(1),
  id: z.union([z.string(), z.number(), z.bigint()]).optional(),
  updatedAt: z.string().datetime(),
  data: z.record(z.string(), z.unknown()),
  operation: z.enum(["create", "update", "delete"]).default("update"),
});

export const syncPushSchema = z.object({
  changes: z.array(syncChangeSchema).min(1).max(500),
});

export const syncPullQuerySchema = z.object({
  since: z.string().datetime().optional(),
});

export type SyncChange = z.infer<typeof syncChangeSchema>;
