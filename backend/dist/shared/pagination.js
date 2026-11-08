import { z } from "zod";
export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
export function toPaginatedResult(data, total, query) {
    return {
        data,
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
}
//# sourceMappingURL=pagination.js.map