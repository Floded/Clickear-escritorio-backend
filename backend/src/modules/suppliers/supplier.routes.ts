import { Router } from "express";

import { supplierService } from "./supplier.service.js";
import {
  createSupplierSchema,
  listSuppliersQuerySchema,
  updateSupplierSchema,
} from "./supplier.dto.js";

export const supplierRouter = Router();

supplierRouter.get("/", async (req, res) => {
  const query = listSuppliersQuerySchema.parse(req.query);
  res.json(await supplierService.list(query));
});

supplierRouter.get("/:id", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  res.json(await supplierService.getById(id));
});

supplierRouter.post("/", async (req, res) => {
  const input = createSupplierSchema.parse(req.body);
  res.status(201).json(await supplierService.create(input));
});

supplierRouter.patch("/:id", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const input = updateSupplierSchema.parse(req.body);
  res.json(await supplierService.update(id, input));
});

supplierRouter.delete("/:id", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  await supplierService.remove(id);
  res.status(204).send();
});
