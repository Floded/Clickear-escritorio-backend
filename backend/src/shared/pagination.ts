import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function toPaginatedResult<T>(
  data: T[],
  total: number,
  query: { page: number; limit: number },
): PaginatedResult<T> {
  return {
    data,
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}
