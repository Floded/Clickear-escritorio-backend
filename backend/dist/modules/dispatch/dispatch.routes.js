import { Router } from "express";
import { dispatchOrderService } from "./dispatch.service.js";
import { technicianService } from "./technician.service.js";
import { createDispatchOrderSchema, listDispatchOrdersQuerySchema, } from "./dispatch.dto.js";
import { createTechnicianSchema, listTechniciansQuerySchema, } from "./technician.dto.js";
export const dispatchOrderRouter = Router();
export const technicianRouter = Router();
dispatchOrderRouter.get("/", async (req, res) => {
    const query = listDispatchOrdersQuerySchema.parse(req.query);
    res.json(await dispatchOrderService.list(query));
});
dispatchOrderRouter.get("/:id", async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    res.json(await dispatchOrderService.getById(id));
});
dispatchOrderRouter.post("/", async (req, res) => {
    const input = createDispatchOrderSchema.parse(req.body);
    const order = await dispatchOrderService.create(input);
    res.status(201).json(order);
});
technicianRouter.get("/", async (req, res) => {
    const query = listTechniciansQuerySchema.parse(req.query);
    res.json(await technicianService.list(query));
});
technicianRouter.post("/", async (req, res) => {
    const input = createTechnicianSchema.parse(req.body);
    const technician = await technicianService.create(input);
    res.status(201).json(technician);
});
//# sourceMappingURL=dispatch.routes.js.map