import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { createTestApp, authCookie, createTestUser, cleanTables, prisma } from "./test/setup.js";
import supertest from "supertest";

let app: ReturnType<typeof createTestApp>;
let authHeader: string;

beforeEach(async () => {
  app = createTestApp();
  await cleanTables([]);
  const user = await createTestUser({
    email: "appserver@clickear.local",
    password: "AppServerPass123!",
  });
  authHeader = authCookie(user);
});

afterEach(async () => {
  await cleanTables([]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("App / Server middlewares globales", () => {
  it("GET / → 200 con { name: 'clickear-backend', status: 'ok' }", async () => {
    const res = await supertest(app).get("/");

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("clickear-backend");
    expect(res.body.status).toBe("ok");
  });

  it("GET /api/health → 200 sin auth", async () => {
    const res = await supertest(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /api/establishments sin cookie → 401 (authenticate protege)", async () => {
    const res = await supertest(app).get("/api/establishments");

    expect(res.status).toBe(401);
  });

  it("helmet headers de seguridad presentes", async () => {
    const res = await supertest(app).get("/");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("CORS con credentials en respuesta", async () => {
    const res = await supertest(app)
      .get("/")
      .set("Origin", "http://localhost:5173");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("rate limiting: muchas peticiones rápidas → 429", async () => {
    const promises = Array.from({ length: 150 }).map(() =>
      supertest(app).get("/api/health"),
    );
    const results = await Promise.all(promises);

    const has429 = results.some((r) => r.status === 429);
    expect(has429).toBe(true);
  });

  it("ruta inexistente → 404 vía error handler", async () => {
    const res = await supertest(app).get("/api/ruta-que-no-existe");

    expect(res.status).toBe(404);
  });

  it("JSON malformado en body → 400", async () => {
    const res = await supertest(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{ json malformado");

    expect(res.status).toBe(400);
  });
});
