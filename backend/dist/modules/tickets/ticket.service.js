import { prisma } from "../../prisma/client.js";
import { ConflictError, NotFoundError } from "../../shared/http-error.js";
import { toPaginatedResult, } from "../../shared/pagination.js";
// Estado de la asignación vigente, para no repetir el include en list y detail
const assignedEmployeeSelect = {
    select: { id: true, fullName: true, isActive: true },
};
export const ticketService = {
    async list(query) {
        const where = {
            status: query.status,
            establishmentCue: query.establishment || undefined,
            assignedEmployeeId: query.employeeId === "none"
                ? null
                : typeof query.employeeId === "number"
                    ? query.employeeId
                    : undefined,
            title: query.search
                ? { contains: query.search, mode: "insensitive" }
                : undefined,
            establishment: query.technicianId
                ? {
                    dispatchOrder: {
                        technicians: { some: { technicianId: query.technicianId } },
                    },
                }
                : undefined,
        };
        const [items, total] = await prisma.$transaction([
            prisma.ticket.findMany({
                where,
                skip: (query.page - 1) * query.limit,
                take: query.limit,
                orderBy: { openingTimestamp: { sort: "desc", nulls: "last" } },
                include: {
                    assignedEmployee: assignedEmployeeSelect,
                    establishment: {
                        select: {
                            cue: true,
                            name: true,
                            department: true,
                            locality: true,
                            isSecondaryBuilding: true,
                        },
                    },
                },
            }),
            prisma.ticket.count({ where }),
        ]);
        return toPaginatedResult(items, total, query);
    },
    // Detalle completo: establecimiento, orden de despacho, asignaciones y facturas
    async getById(ticketId) {
        const ticket = await prisma.ticket.findUnique({
            where: { ticketId },
            include: {
                assignedEmployee: assignedEmployeeSelect,
                establishment: {
                    include: {
                        dispatchOrder: {
                            include: {
                                technicians: {
                                    select: { technician: { select: { id: true, fullName: true } } },
                                },
                            },
                        },
                    },
                },
                // Historial completo de asignaciones (la vigente es la sin releasedAt)
                assignments: {
                    orderBy: { assignedAt: "desc" },
                    include: { employee: { select: { id: true, fullName: true } } },
                },
                invoices: {
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true,
                        voucherType: true,
                        amount: true,
                        status: true,
                        cae: true,
                        errorMessage: true,
                        createdAt: true,
                    },
                },
            },
        });
        if (!ticket) {
            throw new NotFoundError(`Ticket ${ticketId} not found`);
        }
        return ticket;
    },
    async create(input) {
        // Crea o completa el establecimiento junto con el ticket
        return prisma.$transaction(async (tx) => {
            if (input.establishmentCue !== undefined) {
                await persistEstablishment(tx, input.establishmentCue, input.establishment);
            }
            return tx.ticket.create({
                data: {
                    ticketId: input.ticketId,
                    establishmentCue: input.establishmentCue,
                    title: input.title,
                    glpiClosedTicket: input.glpiClosedTicket,
                    openingTimestamp: input.openingTimestamp,
                    status: input.status,
                },
            });
        });
    },
    async updateStatus(ticketId, status) {
        await assertTicketExists(ticketId);
        return prisma.ticket.update({ where: { ticketId }, data: { status } });
    },
    /**
     * Asigna, reasigna o libera un ticket (transacción atómica):
     *  1. Valida empleado existente y activo.
     *  2. Cierra la asignación vigente si la hay (released_at = now).
     *  3. Si hay nuevo empleado, crea la fila de historial y actualiza el denormalizado.
     * El estado del ticket no se toca nunca (queda a cargo del usuario).
     */
    async assign(ticketId, input) {
        return prisma.$transaction(async (tx) => {
            const ticket = await tx.ticket.findUnique({
                where: { ticketId },
                select: { ticketId: true, assignedEmployeeId: true },
            });
            if (!ticket) {
                throw new NotFoundError(`Ticket ${ticketId} not found`);
            }
            // Liberar: cierra la vigente y limpia el denormalizado
            if (input.employeeId === null) {
                await tx.ticketAssignment.updateMany({
                    where: { ticketId, releasedAt: null },
                    data: { releasedAt: new Date() },
                });
                if (ticket.assignedEmployeeId !== null) {
                    await tx.ticket.update({
                        where: { ticketId },
                        data: { assignedEmployeeId: null },
                    });
                }
                return tx.ticket.findUniqueOrThrow({
                    where: { ticketId },
                    include: { assignedEmployee: assignedEmployeeSelect },
                });
            }
            // Reasignar al mismo empleado: no-op para no duplicar historial
            if (ticket.assignedEmployeeId === input.employeeId) {
                return tx.ticket.findUniqueOrThrow({
                    where: { ticketId },
                    include: { assignedEmployee: assignedEmployeeSelect },
                });
            }
            const employee = await tx.employee.findUnique({
                where: { id: input.employeeId },
                select: { id: true, fullName: true, isActive: true },
            });
            if (!employee) {
                throw new NotFoundError(`Employee ${input.employeeId} not found`);
            }
            if (!employee.isActive) {
                throw new ConflictError(`Empleado '${employee.fullName}' esta inactivo`);
            }
            // Cierra la vigente (si la hay) y abre la nueva
            await tx.ticketAssignment.updateMany({
                where: { ticketId, releasedAt: null },
                data: { releasedAt: new Date() },
            });
            await tx.ticketAssignment.create({
                data: { ticketId, employeeId: input.employeeId },
            });
            await tx.ticket.update({
                where: { ticketId },
                data: { assignedEmployeeId: input.employeeId },
            });
            return tx.ticket.findUniqueOrThrow({
                where: { ticketId },
                include: { assignedEmployee: assignedEmployeeSelect },
            });
        });
    },
};
async function assertTicketExists(ticketId) {
    const found = await prisma.ticket.count({ where: { ticketId } });
    if (found === 0) {
        throw new NotFoundError(`Ticket ${ticketId} not found`);
    }
}
// Campos de texto que solo se completan si están vacíos (nunca se pisan)
const TEXT_FILLABLE_FIELDS = [
    "department",
    "locality",
    "address",
    "phone",
    "directorName",
];
// Crea el establecimiento si el CUE es nuevo; si ya existe, completa únicamente
// los campos vacíos de la base con lo que envíe el ticket
async function persistEstablishment(tx, cue, data) {
    const existing = await tx.establishment.findUnique({ where: { cue } });
    if (!existing) {
        const name = data?.name;
        if (!name) {
            throw new NotFoundError(`Establecimiento con CUE '${cue}' no encontrado; envíe sus datos para crearlo`);
        }
        await tx.establishment.create({ data: { ...data, name, cue } });
        return;
    }
    const fillMissing = {};
    for (const field of TEXT_FILLABLE_FIELDS) {
        const value = data?.[field];
        if (value !== undefined && existing[field] === null) {
            fillMissing[field] = value;
        }
    }
    if (data?.distanceKm !== undefined && existing.distanceKm === null) {
        fillMissing.distanceKm = data.distanceKm;
    }
    if (Object.keys(fillMissing).length > 0) {
        await tx.establishment.update({ where: { cue }, data: fillMissing });
    }
}
//# sourceMappingURL=ticket.service.js.map