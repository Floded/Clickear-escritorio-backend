import { z } from "zod";

import { paginationQuerySchema } from "../../shared/pagination.js";

export const createDispatchOrderSchema = z.object({
  dispatchCode: z.string().trim().min(1).max(50),
  dispatchTimestamp: z.coerce.date(),
  listStatus: z.string().trim().min(1).max(50),
  technicianIds: z.array(z.number().int().positive()).default([]),
  establishmentCues: z.array(z.string().trim().min(1)).default([]),
});

export const listDispatchOrdersQuerySchema = paginationQuerySchema.extend({
  listStatus: z.string().trim().optional(),
  dispatchCode: z.string().trim().optional(),
});

export type CreateDispatchOrderInput = z.infer<typeof createDispatchOrderSchema>;
export type ListDispatchOrdersQuery = z.infer<typeof listDispatchOrdersQuerySchema>;
