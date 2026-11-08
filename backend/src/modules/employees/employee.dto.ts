import { z } from "zod";

import { paginationQuerySchema } from "../../shared/pagination.js";

export const createEmployeeSchema = z.object({
  fullName: z.string().trim().min(2).max(255),
  dniOrFileNumber: z.string().trim().min(1).max(50),
  phone: z.string().trim().max(50).optional(),
  isActive: z.boolean().default(true),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const listEmployeesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
