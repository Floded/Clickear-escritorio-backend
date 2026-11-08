import { z } from "zod";
const budgetLineSchema = z.object({
    id: z.number().int().optional(),
    inventoryItemId: z.number().int().nullable().optional(),
    description: z.string().min(1, "Cada línea necesita una descripción"),
    quantity: z.number().int().positive("Cantidad debe ser positiva"),
    unitPrice: z.number().positive("Precio unitario debe ser positivo"),
});
export const createBudgetSchema = z.object({
    customerName: z.string().min(1, "Nombre del cliente es requerido"),
    establishmentCue: z.string().optional(),
    validUntil: z.string().optional(),
    notes: z.string().optional(),
    lines: z.array(budgetLineSchema).min(1, "Debe tener al menos una línea de presupuesto"),
});
export const updateBudgetSchema = createBudgetSchema.partial();
//# sourceMappingURL=budget.dto.js.map