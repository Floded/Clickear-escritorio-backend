import { describe, it, expect, beforeEach, afterEach } from "vitest";
import supertest from "supertest";

import {
  authCookie,
  cleanTables,
  createTestApp,
  createTestUser,
  prisma,
} from "../../test/setup.js";

describe("sync", () => {
  let app: ReturnType<typeof createTestApp>;
  let authHeader: string;

  beforeEach(async () => {
    app = createTestApp();
    await cleanTables(["establishments"]);
    const user = await createTestUser({ email: "sync@clickear.local" });
    authHeader = authCookie(user);
  });

  afterEach(async () => {
    await cleanTables(["establishments"]);
  });

  it("push aplica un establecimiento y pull lo devuelve", async () => {
    const now = new Date().toISOString();
    const pushRes = await supertest(app)
      .post("/api/sync/push")
      .set("Cookie", authHeader)
      .send({
        changes: [
          {
            entity: "establishment",
            id: "CUE-SYNC-1",
            updatedAt: now,
            data: { cue: "CUE-SYNC-1", name: "Escuela Sync", isSecondaryBuilding: false },
            operation: "update",
          },
        ],
      });

    expect(pushRes.status).toBe(200);
    expect(pushRes.body.results[0].status).toBe("applied");

    const pullRes = await supertest(app)
      .get("/api/sync/pull")
      .set("Cookie", authHeader)
      .query({ since: new Date(0).toISOString() });

    expect(pullRes.status).toBe(200);
    expect(pullRes.body.data.establishment).toBeDefined();
    expect(pullRes.body.data.establishment[0].cue).toBe("CUE-SYNC-1");
  });

  it("reporta conflicto si el servidor tiene updatedAt mas reciente", async () => {
    const newer = new Date();
    await prisma.establishment.create({
      data: { cue: "CUE-CONFLICT", name: "Servidor", isSecondaryBuilding: false, updatedAt: newer },
    });

    const older = new Date(Date.now() - 60_000).toISOString();
    const res = await supertest(app)
      .post("/api/sync/push")
      .set("Cookie", authHeader)
      .send({
        changes: [
          {
            entity: "establishment",
            id: "CUE-CONFLICT",
            updatedAt: older,
            data: { cue: "CUE-CONFLICT", name: "Cliente", isSecondaryBuilding: false },
            operation: "update",
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.results[0].status).toBe("conflict");
  });

  it("rechaza entidades desconocidas", async () => {
    const res = await supertest(app)
      .post("/api/sync/push")
      .set("Cookie", authHeader)
      .send({
        changes: [{ entity: "foo", updatedAt: new Date().toISOString(), data: {}, operation: "update" }],
      });

    expect(res.status).toBe(200);
    expect(res.body.results[0].status).toBe("unknown_entity");
  });

  it("pull sin since usa epoch", async () => {
    const res = await supertest(app).get("/api/sync/pull").set("Cookie", authHeader);
    expect(res.status).toBe(200);
    expect(res.body.since).toBeDefined();
  });
});
