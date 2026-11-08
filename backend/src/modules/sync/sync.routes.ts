import { Router, type Request, type Response } from "express";

import { syncPullQuerySchema, syncPushSchema } from "./sync.dto.js";
import { syncService } from "./sync.service.js";

export const syncRouter = Router();

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

syncRouter.get("/pending", async (_req: Request, res: Response) => {
  const rows = await syncService.pending();
  res.json({ rows });
});

syncRouter.post("/ack", async (req: Request, res: Response) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];
  await syncService.ack(ids);
  res.json({ ok: true });
});