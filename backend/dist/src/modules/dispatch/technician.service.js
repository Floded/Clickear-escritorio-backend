import { prisma } from "../../prisma/client.js";
import { toPaginatedResult, } from "../../shared/pagination.js";
export const technicianService = {
    async list(query) {
        const where = query.search
            ? { fullName: { contains: query.search, mode: "insensitive" } }
            : {};
        const [items, total] = await prisma.$transaction([
            prisma.technician.findMany({
                where,
                skip: (query.page - 1) * query.limit,
                take: query.limit,
                orderBy: { fullName: "asc" },
            }),
            prisma.technician.count({ where }),
        ]);
        return toPaginatedResult(items, total, query);
    },
    async create(input) {
        return prisma.technician.create({ data: input });
    },
};
//# sourceMappingURL=technician.service.js.map