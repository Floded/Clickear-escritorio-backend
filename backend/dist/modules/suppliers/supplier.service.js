import { prisma } from "../../prisma/client.js";
import { NotFoundError } from "../../shared/http-error.js";
import { toPaginatedResult, } from "../../shared/pagination.js";
export const supplierService = {
    async list(query) {
        const where = query.search
            ? {
                OR: [
                    { name: { contains: query.search, mode: "insensitive" } },
                    { contactEmail: { contains: query.search, mode: "insensitive" } },
                ],
            }
            : {};
        const [items, total] = await prisma.$transaction([
            prisma.supplier.findMany({
                where,
                skip: (query.page - 1) * query.limit,
                take: query.limit,
                orderBy: { name: "asc" },
                include: { _count: { select: { inventoryItems: true } } },
            }),
            prisma.supplier.count({ where }),
        ]);
        return toPaginatedResult(items, total, query);
    },
    async getById(id) {
        const supplier = await prisma.supplier.findUnique({
            where: { id },
            include: { inventoryItems: true },
        });
        if (!supplier) {
            throw new NotFoundError(`Supplier ${id} not found`);
        }
        return supplier;
    },
    async create(input) {
        return prisma.supplier.create({ data: input });
    },
    async update(id, input) {
        await assertSupplierExists(id);
        return prisma.supplier.update({ where: { id }, data: input });
    },
    // On Delete SetNull: los ítems conservan su stock sin proveedor
    async remove(id) {
        await assertSupplierExists(id);
        await prisma.supplier.delete({ where: { id } });
    },
};
async function assertSupplierExists(id) {
    const found = await prisma.supplier.count({ where: { id } });
    if (found === 0) {
        throw new NotFoundError(`Supplier ${id} not found`);
    }
}
//# sourceMappingURL=supplier.service.js.map