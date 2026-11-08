import { Router } from "express";
import { z } from "zod";

import { inventoryItemService } from "./inventory-item.service.js";
import {
  createInventoryItemSchema,
  listInventoryItemsQuerySchema,
  updateInventoryItemSchema,
} from "./inventory-item.dto.js";

export const inventoryItemRouter = Router();

inventoryItemRouter.get("/", async (req, res) => {
  const query = listInventoryItemsQuerySchema.parse(req.query);
  res.json(await inventoryItemService.list(query));
});

inventoryItemRouter.get("/:id", async (req, res) => {
  const id = listInventoryItemParamsSchema.parse(req.params).id;
  res.json(await inventoryItemService.getById(id));
});

inventoryItemRouter.post("/", async (req, res) => {
  const input = createInventoryItemSchema.parse(req.body);
  res.status(201).json(await inventoryItemService.create(input));
});

inventoryItemRouter.patch("/:id", async (req, res) => {
  const id = listInventoryItemParamsSchema.parse(req.params).id;
  const input = updateInventoryItemSchema.parse(req.body);
  res.json(await inventoryItemService.update(id, input));
});

// Ajuste de stock diferencial (carga inicial, mermas, correcciones):
// { "quantity": 5 } suma; { "quantity": -3 } resta, nunca por debajo de 0
inventoryItemRouter.patch("/:id/stock", async (req, res) => {
  const id = listInventoryItemParamsSchema.parse(req.params).id;
  const { quantity } = adjustStockSchema.parse(req.body);
  res.json(await inventoryItemService.adjustStock(id, quantity));
});

inventoryItemRouter.delete("/:id", async (req, res) => {
  const id = listInventoryItemParamsSchema.parse(req.params).id;
  await inventoryItemService.remove(id);
  res.status(204).send();
});

const listInventoryItemParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const adjustStockSchema = z.object({
  quantity: z.number().int(),
});
