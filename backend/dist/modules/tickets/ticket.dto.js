import { z } from "zod";
import { paginationQuerySchema } from "../../shared/pagination.js";
import { establishmentFieldsSchema } from "../establishments/establishment.dto.js";
// Campos de establecimiento que un ticket puede aportar; el vínculo con una
// orden de despacho y la marca de anexo no se gestionan desde este módulo.
// El nombre es opcional aquí: es obligatorio solo al crear un establecimiento nuevo
const ticketEstablishmentSchema = establishmentFieldsSchema
    .omit({ dispatchOrderId: true, isSecondaryBuilding: true })
    .extend({ name: z.string().trim().min(2).max(255).optional() });
export const TICKET_STATUSES = ["ABIERTO", "EN PROGRESO", "TERMINADO"];
export const ticketStatusSchema = z.enum(TICKET_STATUSES);
export const createTicketSchema = z.object({
    ticketId: z.coerce.bigint().positive(),
    establishmentCue: z.string().trim().max(20).optional(),
    establishment: ticketEstablishmentSchema.optional(),
    title: z.string().trim().min(1),
    glpiClosedTicket: z.string().trim().max(100).optional(),
    openingTimestamp: z.coerce.date().optional(),
    status: ticketStatusSchema.optional(),
});
export const listTicketsQuerySchema = paginationQuerySchema.extend({
    status: ticketStatusSchema.optional(),
    establishment: z.string().trim().max(20).optional(),
    technicianId: z.coerce.number().int().positive().optional(),
    // "none" = tickets sin asignar
    employeeId: z
        .union([z.coerce.number().int().positive(), z.literal("none")])
        .optional(),
    search: z.string().trim().optional(),
});
export const updateTicketStatusSchema = z.object({
    status: ticketStatusSchema,
});
// employeeId null = liberar el ticket (desasignar)
export const assignTicketSchema = z.object({
    employeeId: z.coerce.number().int().positive().nullable(),
});
export const ticketIdParamsSchema = z.object({
    id: z.coerce.bigint(),
});
//# sourceMappingURL=ticket.dto.js.map