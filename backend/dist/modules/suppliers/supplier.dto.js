import { z } from "zod";
import { paginationQuerySchema } from "../../shared/pagination.js";
export const createSupplierSchema = z.object({
    name: z.string().trim().min(2).max(255),
    contactPhone: z.string().trim().max(50).optional(),
    contactEmail: z.string().trim().email().max(255).optional(),
    website: z.string().trim().url().max(255).optional(),
});
export const updateSupplierSchema = createSupplierSchema.partial();
export const listSuppliersQuerySchema = paginationQuerySchema.extend({
    search: z.string().trim().optional(),
});
//# sourceMappingURL=supplier.dto.js.map