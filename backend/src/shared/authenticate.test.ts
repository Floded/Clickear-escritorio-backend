import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { createTestApp, authCookie, createTestUser, cleanTables, prisma } from "../test/setup.js";
import supertest from "supertest";

let app: ReturnType<typeof createTestApp>;
let authHeader: string;

beforeEach(async () => {
  app = createTestApp();
  await cleanTables([]);
  const user = await createTestUser({
    email: "authmiddleware@clickear.local",
    password: "AuthMiddlewarePass123!",
  });
  authHeader = authCookie(user);
});

afterEach(async () => {
  await cleanTables([]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("authenticate middleware", () => {
  it("con cookie válida → pasa la petición (ruta protegida devuelve 200)", async () => {
    // GET /api/auth/me está protegido por authenticate y devuelve el usuario
    const res = await supertest(app)
      .get("/api/auth/me")
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("authmiddleware@clickear.local");
  });

  it("sin cookie → 401 Sesión no encontrada", async () => {
    const res = await supertest(app).get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Sesión no encontrada");
  });

  it("con token inválido → 401 Sesión inválida o expirada", async () => {
    const res = await supertest(app)
      .get("/api/auth/me")
      .set("Cookie", "auth_token=token.invalido.aquí");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Sesión inválida o expirada");
  });

  it("con token expirado → 401", async () => {
    const jwt = require("jsonwebtoken");
    const expiredToken = jwt.sign(
      { sub: "1", email: "exp@clickear.local", name: "Expirado" },
      process.env.JWT_SECRET ?? "secret",
      { expiresIn: -1 },
    );

    const res = await supertest(app)
      .get("/api/auth/me")
      .set("Cookie", `auth_token=${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Sesión inválida o expirada");
  });

  it("ruta sin auth (health) no requiere cookie → 200", async () => {
    const res = await supertest(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
