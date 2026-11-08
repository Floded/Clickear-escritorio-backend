import { Router } from "express";
import { employeeService } from "./employee.service.js";
import { assignmentService } from "../assignments/assignment.service.js";
import { createEmployeeSchema, listEmployeesQuerySchema, updateEmployeeSchema, } from "./employee.dto.js";
export const employeeRouter = Router();
employeeRouter.get("/", async (req, res) => {
    const query = listEmployeesQuerySchema.parse(req.query);
    res.json(await employeeService.list(query));
});
// Stock en custodia de un empleado (asignaciones activas, sin devolver)
employeeRouter.get("/:id/assignments", async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    res.json(await assignmentService.listByEmployee(id));
});
employeeRouter.get("/:id", async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    res.json(await employeeService.getById(id));
});
employeeRouter.post("/", async (req, res) => {
    const input = createEmployeeSchema.parse(req.body);
    res.status(201).json(await employeeService.create(input));
});
employeeRouter.patch("/:id", async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const input = updateEmployeeSchema.parse(req.body);
    res.json(await employeeService.update(id, input));
});
employeeRouter.delete("/:id", async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    await employeeService.remove(id);
    res.status(204).send();
});
//# sourceMappingURL=employee.routes.js.map