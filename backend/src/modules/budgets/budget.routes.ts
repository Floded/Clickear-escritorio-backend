import { Router } from "express";
import { createBudgetSchema, updateBudgetSchema } from "./budget.dto.js";
import {
  createBudget,
  getBudget,
  listBudgets,
  removeBudget,
  updateBudget,
} from "./budget.service.js";

export const budgetRouter = Router();

function parseId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  return Number.isNaN(id) ? null : id;
}

budgetRouter.get("/", async (req, res) => {
  const budgets = await listBudgets({
    establishmentCue: req.query.establishmentCue as string | undefined,
  });
  res.json(budgets);
});

budgetRouter.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Id inválido" });
  res.json(await getBudget(id));
});

budgetRouter.post("/", async (req, res) => {
  const input = createBudgetSchema.parse(req.body);
  res.status(201).json(await createBudget(input));
});

budgetRouter.patch("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Id inválido" });
  const input = updateBudgetSchema.parse(req.body);
  res.json(await updateBudget(id, input));
});

budgetRouter.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Id inválido" });
  await removeBudget(id);
  res.status(204).send();
});
