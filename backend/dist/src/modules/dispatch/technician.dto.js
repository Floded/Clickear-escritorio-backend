import { z } from "zod";
import { paginationQuerySchema } from "../../shared/pagination.js";
export const createTechnicianSchema = z.object({
    fullName: z.string().trim().min(3).max(255),
});
export const listTechniciansQuerySchema = paginationQuerySchema.extend({
    search: z.string().trim().optional(),
});
//# sourceMappingURL=technician.dto.js.map