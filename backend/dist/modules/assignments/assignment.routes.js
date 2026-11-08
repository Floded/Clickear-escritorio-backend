import { Router } from "express";
import { z } from "zod";
import { assignmentService } from "./assignment.service.js";
import { createAssignmentSchema, listAssignmentsQuerySchema, returnAssignmentSchema, } from "./assignment.dto.js";
export const assignmentRouter = Router();
assignmentRouter.get("/", async (req, res) => {
    const query = listAssignmentsQuerySchema.parse(req.query);
    res.json(await assignmentService.list(query));
});
// Entrega de stock a un empleado: valida disponible y descuenta en una transacción atómica
assignmentRouter.post("/", async (req, res) => {
    const input = createAssignmentSchema.parse(req.body);
    const assignment = await assignmentService.create(input);
    res.status(201).json(assignment);
});
// Devolución al depósito (total o parcial): re-suma stock y cierra la asignación
assignmentRouter.put("/:id/return", async (req, res) => {
    const id = assignmentIdParamsSchema.parse(req.params).id;
    const input = returnAssignmentSchema.parse(req.body);
    res.json(await assignmentService.return(id, input));
});
const assignmentIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});
//# sourceMappingURL=assignment.routes.js.map