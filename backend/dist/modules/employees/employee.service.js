import { prisma } from "../../prisma/client.js";
import { ConflictError, NotFoundError } from "../../shared/http-error.js";
import { toPaginatedResult, } from "../../shared/pagination.js";
export const employeeService = {
    async list(query) {
        const where = {
            OR: query.search
                ? [
                    { fullName: { contains: query.search, mode: "insensitive" } },
                    { dniOrFileNumber: { contains: query.search, mode: "insensitive" } },
                ]
                : undefined,
            isActive: query.isActive === undefined ? undefined : query.isActive === "true",
        };
        const [items, total] = await prisma.$transaction([
            prisma.employee.findMany({
                where,
                skip: (query.page - 1) * query.limit,
                take: query.limit,
                orderBy: { fullName: "asc" },
                include: {
                    _count: { select: { assignments: { where: { returnDate: null } } } },
                },
            }),
            prisma.employee.count({ where }),
        ]);
        return toPaginatedResult(items, total, query);
    },
    async getById(id) {
        const employee = await prisma.employee.findUnique({
            where: { id },
            include: {
                assignments: { orderBy: { deliveryDate: "desc" }, take: 10 },
            },
        });
        if (!employee) {
            throw new NotFoundError(`Employee ${id} not found`);
        }
        return employee;
    },
    async create(input) {
        return prisma.employee.create({ data: input });
    },
    async update(id, input) {
        await assertEmployeeExists(id);
        if (input.dniOrFileNumber !== undefined) {
            await assertDniAvailable(input.dniOrFileNumber, id);
        }
        return prisma.employee.update({ where: { id }, data: input });
    },
    // FK Restrict: si tiene historial de asignaciones, se impide el borrado físico
    async remove(id) {
        await assertEmployeeExists(id);
        const assignments = await prisma.itemAssignment.count({ where: { employeeId: id } });
        if (assignments > 0) {
            throw new ConflictError(`El empleado ${id} tiene ${assignments} asignaciones registradas; use baja logica (isActive: false)`);
        }
        await prisma.employee.delete({ where: { id } });
    },
};
async function assertEmployeeExists(id) {
    const found = await prisma.employee.count({ where: { id } });
    if (found === 0) {
        throw new NotFoundError(`Employee ${id} not found`);
    }
}
async function assertDniAvailable(dni, employeeId) {
    const found = await prisma.employee.count({
        where: { dniOrFileNumber: dni, id: { not: employeeId } },
    });
    if (found > 0) {
        throw new ConflictError(`DNI o numero de legajo ya registrado: ${dni}`);
    }
}
//# sourceMappingURL=employee.service.js.map