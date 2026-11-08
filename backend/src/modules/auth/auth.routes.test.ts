import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { createTestApp, authCookie, createTestUser, cleanDb, prisma } from "../../test/setup.js";
import supertest from "supertest";

let app: ReturnType<typeof createTestApp>;

beforeEach(async () => {
  app = createTestApp();
  await cleanDb();
});

afterEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/auth/login", () => {
  it("con credenciales válidas → 200, cookie seteada y usuario en body", async () => {
    await createTestUser({ email: "admin@clickear.local", password: "Admin123!" });

    const res = await supertest(app).post("/api/auth/login").send({
      email: "admin@clickear.local",
      password: "Admin123!",
    });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("admin@clickear.local");
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.headers["set-cookie"][0]).toContain("auth_token=");
  });

  it("con credenciales inválidas → 401", async () => {
    await createTestUser({ email: "admin@clickear.local", password: "Admin123!" });

    const res = await supertest(app).post("/api/auth/login").send({
      email: "admin@clickear.local",
      password: "WrongPass123!",
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Credenciales incorrectas");
  });

  it("con email inexistente → 401", async () => {
    const res = await supertest(app).post("/api/auth/login").send({
      email: "noexiste@clickear.local",
      password: "Admin123!",
    });

    expect(res.status).toBe(401);
  });

  it("con body inválido (Zod) → 400 con detalles de validación", async () => {
    const res = await supertest(app).post("/api/auth/login").send({
      email: "no-es-un-email",
      password: "corta",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Datos invalidos");
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });
});

describe("POST /api/auth/logout", () => {
  it("→ 200 y cookie limpiada", async () => {
    const res = await supertest(app).post("/api/auth/logout");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.headers["set-cookie"][0]).toContain("auth_token=");
    // La cookie se limpia expiándola en el pasado
    expect(res.headers["set-cookie"][0]).toContain("Expires=Thu, 01 Jan 1970");
  });
});

describe("GET /api/auth/me", () => {
  it("con cookie válida → 200 y usuario", async () => {
    const user = await createTestUser({
      email: "me@clickear.local",
      password: "MePass123!",
    });

    const res = await supertest(app)
      .get("/api/auth/me")
      .set("Cookie", authCookie(user));

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.name).toBe(user.name);
  });

  it("sin cookie → 401", async () => {
    const res = await supertest(app).get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Sesión no encontrada");
  });
});
