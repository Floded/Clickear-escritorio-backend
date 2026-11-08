import { z } from "zod";
import { paginationQuerySchema } from "../../shared/pagination.js";
export const establishmentFieldsSchema = z.object({
    dispatchOrderId: z.number().int().positive().optional(),
    name: z.string().trim().min(2).max(255),
    department: z.string().trim().max(100).optional(),
    locality: z.string().trim().max(100).optional(),
    address: z.string().trim().max(255).optional(),
    phone: z.string().trim().max(50).optional(),
    distanceKm: z.number().nonnegative().optional(),
    directorName: z.string().trim().max(255).optional(),
    isSecondaryBuilding: z.boolean().optional(),
});
export const createEstablishmentSchema = establishmentFieldsSchema.extend({
    cue: z.string().trim().min(3).max(20),
});
export const updateEstablishmentSchema = establishmentFieldsSchema.partial();
export const listEstablishmentsQuerySchema = paginationQuerySchema.extend({
    search: z.string().trim().optional(),
    department: z.string().trim().optional(),
    locality: z.string().trim().optional(),
    dispatchOrderId: z.coerce.number().int().positive().optional(),
});
//# sourceMappingURL=establishment.dto.js.map