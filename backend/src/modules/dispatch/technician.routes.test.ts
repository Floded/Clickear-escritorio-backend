import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { createTestApp, authCookie, createTestUser, cleanTables, prisma } from "../../test/setup.js";
import supertest from "supertest";

let app: ReturnType<typeof createTestApp>;
let authHeader: string;

beforeEach(async () => {
  app = createTestApp();
  await cleanTables(["technicians"]);
  const user = await createTestUser({
    email: "technician@clickear.local",
    password: "TechnicianPass123!",
  });
  authHeader = authCookie(user);
});

afterEach(async () => {
  await cleanTables(["technicians"]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const baseUrl = "/api/technicians";

const validTechnician = {
  fullName: "Tecnico Test",
};

describe("Technicians CRUD", () => {
  it("GET / → 200 con paginación", async () => {
    await prisma.technician.create({ data: { fullName: "Tecnico A" } });
    await prisma.technician.create({ data: { fullName: "Tecnico B" } });

    const res = await supertest(app).get(baseUrl).set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it("POST / válido → 201", async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send(validTechnician);

    expect(res.status).toBe(201);
    expect(res.body.fullName).toBe(validTechnician.fullName);
    expect(res.body.id).toBeDefined();
  });

  it("POST / body inválido (Zod) → 400 con detalles", async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({ fullName: "AB" }); // mínimo 3 caracteres

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Datos invalidos");
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("POST / sin auth → 401", async () => {
    const res = await supertest(app).post(baseUrl).send(validTechnician);
    expect(res.status).toBe(401);
  });

  it("GET / con search → filtra por nombre", async () => {
    await prisma.technician.create({ data: { fullName: "Juan Tecnico" } });
    await prisma.technician.create({ data: { fullName: "Maria Tecnica" } });

    const res = await supertest(app)
      .get(`${baseUrl}?search=Juan`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].fullName).toBe("Juan Tecnico");
  });
});
