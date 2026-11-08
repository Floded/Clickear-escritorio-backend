import { prisma } from "../../prisma/client.js";
import { BadRequestError, NotFoundError } from "../../shared/http-error.js";
function serializeBudget(budget) {
    return {
        id: budget.id,
        code: budget.code,
        customerName: budget.customerName,
        establishmentCue: budget.establishmentCue,
        issueDate: budget.issueDate.toISOString(),
        validUntil: budget.validUntil ? budget.validUntil.toISOString() : null,
        status: budget.status,
        notes: budget.notes,
        total: Number(budget.total),
        createdAt: budget.createdAt.toISOString(),
        updatedAt: budget.updatedAt.toISOString(),
        lines: budget.lines.map((line) => ({
            id: line.id,
            inventoryItemId: line.inventoryItemId,
            description: line.description,
            quantity: line.quantity,
            unitPrice: Number(line.unitPrice),
            subtotal: Number(line.subtotal),
        })),
    };
}
const budgetInclude = {
    establishment: true,
    lines: true,
};
export async function listBudgets(query) {
    const where = query.establishmentCue ? { establishmentCue: query.establishmentCue } : {};
    const budgets = await prisma.budget.findMany({
        where,
        include: budgetInclude,
        orderBy: { createdAt: "desc" },
    });
    return budgets.map(serializeBudget);
}
export async function getBudget(id) {
    const budget = await prisma.budget.findUnique({
        where: { id },
        include: budgetInclude,
    });
    if (!budget) {
        throw new NotFoundError(`Presupuesto ${id} no encontrado`);
    }
    return serializeBudget(budget);
}
function calculateTotal(lines) {
    return lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
}
async function assertEstablishmentExists(cue) {
    const exists = await prisma.establishment.findUnique({ where: { cue } });
    if (!exists) {
        throw new BadRequestError(`El CUE '${cue}' no corresponde a ningún establecimiento registrado`);
    }
}
export async function createBudget(input) {
    if (input.establishmentCue) {
        await assertEstablishmentExists(input.establishmentCue);
    }
    const total = calculateTotal(input.lines);
    const budget = await prisma.budget.create({
        data: {
            code: `BUD-${Date.now()}`,
            customerName: input.customerName,
            establishmentCue: input.establishmentCue || undefined,
            validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
            notes: input.notes,
            status: "DRAFT",
            total,
            lines: {
                create: input.lines.map((line) => ({
                    inventoryItemId: line.inventoryItemId ?? null,
                    description: line.description,
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                    subtotal: line.quantity * line.unitPrice,
                })),
            },
        },
        include: budgetInclude,
    });
    return serializeBudget(budget);
}
export async function updateBudget(id, input) {
    const existing = await prisma.budget.findUnique({ where: { id } });
    if (!existing) {
        throw new NotFoundError(`Presupuesto ${id} no encontrado`);
    }
    const data = {};
    if (input.customerName !== undefined)
        data.customerName = input.customerName;
    // "" limpia el CUE; undefined (no enviado) lo deja como está
    if (input.establishmentCue !== undefined) {
        if (input.establishmentCue) {
            await assertEstablishmentExists(input.establishmentCue);
        }
        data.establishmentCue = input.establishmentCue || null;
    }
    if (input.validUntil !== undefined)
        data.validUntil = input.validUntil ? new Date(input.validUntil) : null;
    if (input.notes !== undefined)
        data.notes = input.notes;
    // Si vienen líneas, se reemplazan por completo y se recalcula el total
    if (input.lines !== undefined) {
        if (input.lines.length === 0) {
            throw new BadRequestError("El presupuesto necesita al menos una línea");
        }
        data.total = calculateTotal(input.lines);
        await prisma.budgetLine.deleteMany({ where: { budgetId: id } });
        await prisma.budgetLine.createMany({
            data: input.lines.map((line) => ({
                budgetId: id,
                inventoryItemId: line.inventoryItemId ?? null,
                description: line.description,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                subtotal: line.quantity * line.unitPrice,
            })),
        });
    }
    const budget = await prisma.budget.update({
        where: { id },
        data,
        include: budgetInclude,
    });
    return serializeBudget(budget);
}
export async function removeBudget(id) {
    const budget = await prisma.budget.findUnique({ where: { id } });
    if (!budget) {
        throw new NotFoundError(`Presupuesto ${id} no encontrado`);
    }
    await prisma.budget.delete({ where: { id } });
}
//# sourceMappingURL=budget.service.js.map