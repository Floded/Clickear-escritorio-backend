import { z } from "zod";
import { paginationQuerySchema } from "../../shared/pagination.js";
export const createInventoryItemSchema = z.object({
    name: z.string().trim().min(1).max(255),
    description: z.string().trim().max(2000).optional(),
    supplierId: z.number().int().positive().optional(),
    availableQuantity: z.number().int().min(0).default(0),
});
export const updateInventoryItemSchema = createInventoryItemSchema.omit({
    availableQuantity: true,
});
export const listInventoryItemsQuerySchema = paginationQuerySchema.extend({
    search: z.string().trim().optional(),
    supplierId: z.coerce.number().int().positive().optional(),
    hasStock: z.enum(["true", "false"]).optional(),
});
//# sourceMappingURL=inventory-item.dto.js.map