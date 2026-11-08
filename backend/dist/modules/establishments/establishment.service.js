import { prisma } from "../../prisma/client.js";
import { NotFoundError } from "../../shared/http-error.js";
import { toPaginatedResult, } from "../../shared/pagination.js";
export const establishmentService = {
    async list(query) {
        const where = {
            dispatchOrderId: query.dispatchOrderId,
            department: query.department
                ? { equals: query.department, mode: "insensitive" }
                : undefined,
            locality: query.locality
                ? { equals: query.locality, mode: "insensitive" }
                : undefined,
            ...(query.search
                ? {
                    OR: [
                        { cue: { contains: query.search } },
                        { name: { contains: query.search, mode: "insensitive" } },
                    ],
                }
                : {}),
        };
        const [items, total] = await prisma.$transaction([
            prisma.establishment.findMany({
                where,
                skip: (query.page - 1) * query.limit,
                take: query.limit,
                orderBy: { name: "asc" },
                include: {
                    dispatchOrder: {
                        select: { id: true, dispatchCode: true, listStatus: true },
                    },
                },
            }),
            prisma.establishment.count({ where }),
        ]);
        return toPaginatedResult(items, total, query);
    },
    async getByCue(cue) {
        const establishment = await prisma.establishment.findUnique({
            where: { cue },
            include: {
                dispatchOrder: {
                    select: {
                        id: true,
                        dispatchCode: true,
                        listStatus: true,
                        dispatchTimestamp: true,
                        technicians: { select: { technician: { select: { id: true, fullName: true } } } },
                    },
                },
            },
        });
        if (!establishment) {
            throw new NotFoundError(`Establishment with cue '${cue}' not found`);
        }
        return establishment;
    },
    async create(input) {
        if (input.dispatchOrderId !== undefined) {
            await assertDispatchOrderExists(input.dispatchOrderId);
        }
        return prisma.establishment.create({ data: input });
    },
    async update(cue, input) {
        await assertEstablishmentExists(cue);
        if (input.dispatchOrderId !== undefined) {
            await assertDispatchOrderExists(input.dispatchOrderId);
        }
        return prisma.establishment.update({ where: { cue }, data: input });
    },
    async remove(cue) {
        await assertEstablishmentExists(cue);
        await prisma.establishment.delete({ where: { cue } });
    },
};
export async function assertEstablishmentExists(cue) {
    const found = await prisma.establishment.count({ where: { cue } });
    if (found === 0) {
        throw new NotFoundError(`Establishment with cue '${cue}' not found`);
    }
}
async function assertDispatchOrderExists(dispatchOrderId) {
    const found = await prisma.dispatchOrder.count({ where: { id: dispatchOrderId } });
    if (found === 0) {
        throw new NotFoundError(`Dispatch order ${dispatchOrderId} not found`);
    }
}
//# sourceMappingURL=establishment.service.js.map