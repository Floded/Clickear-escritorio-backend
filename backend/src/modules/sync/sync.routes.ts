import { Router, type Request, type Response } from "express";
import { z } from "zod";

import { authenticate } from "../../shared/authenticate.js";
import { syncPullQuerySchema, syncPushSchema } from "./sync.dto.js";
import { syncService } from "./sync.service.js";

export const syncRouter = Router();

syncRouter.use(authenticate);

syncRouter.post("/push", async (req: Request, res: Response) => {
  const parsed = syncPushSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos invalidos", details: parsed.error.issues });
    return;
  }
  const results = await syncService.push(parsed.data.changes);
  res.json({ results });
});

syncRouter.get("/pull", async (req: Request, res: Response) => {
  const parsed = syncPullQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Parametros invalidos", details: parsed.error.issues });
    return;
  }
  const since = parsed.data.since ? new Date(parsed.data.since) : new Date(0);
  const data = await syncService.pull(since);
  res.json({ since: since.toISOString(), data });
});