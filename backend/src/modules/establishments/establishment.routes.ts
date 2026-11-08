import { Router } from "express";

import { establishmentService } from "./establishment.service.js";
import {
  createEstablishmentSchema,
  listEstablishmentsQuerySchema,
  updateEstablishmentSchema,
} from "./establishment.dto.js";

export const establishmentRouter = Router();

establishmentRouter.get("/", async (req, res) => {
  const query = listEstablishmentsQuerySchema.parse(req.query);
  res.json(await establishmentService.list(query));
});

establishmentRouter.get("/:cue", async (req, res) => {
  res.json(await establishmentService.getByCue(req.params.cue));
});

establishmentRouter.post("/", async (req, res) => {
  const input = createEstablishmentSchema.parse(req.body);
  const establishment = await establishmentService.create(input);
  res.status(201).json(establishment);
});

establishmentRouter.patch("/:cue", async (req, res) => {
  const input = updateEstablishmentSchema.parse(req.body);
  res.json(await establishmentService.update(req.params.cue, input));
});

establishmentRouter.delete("/:cue", async (req, res) => {
  await establishmentService.remove(req.params.cue);
  res.status(204).send();
});
