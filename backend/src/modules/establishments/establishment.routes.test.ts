import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { createTestApp, authCookie, createTestUser, cleanTables, prisma } from "../../test/setup.js";
import supertest from "supertest";

let app: ReturnType<typeof createTestApp>;
let authHeader: string;

beforeEach(async () => {
  app = createTestApp();
  await cleanTables(["establishments"]);
  const user = await createTestUser({
    email: "estab@clickear.local",
    password: "EstabPass123!",
  });
  authHeader = authCookie(user);
});

afterEach(async () => {
  await cleanTables(["establishments"]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const baseUrl = "/api/establishments";

const validEstablishment = {
  cue: "CUE-001",
  name: "Escuela Primaria",
  department: "Capital",
  locality: "Centro",
  address: "Calle Falsa 123",
  phone: "12345678",
  distanceKm: 5.5,
  directorName: "Juan Pérez",
  isSecondaryBuilding: false,
};

describe("Establishments CRUD", () => {
  it("GET / → 200 con paginación", async () => {
    await prisma.establishment.create({ data: { cue: "CUE-001", name: "Escuela A" } });
    await prisma.establishment.create({ data: { cue: "CUE-002", name: "Escuela B" } });

    const res = await supertest(app).get(baseUrl).set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it("GET /:cue existente → 200", async () => {
    await prisma.establishment.create({ data: validEstablishment });

    const res = await supertest(app)
      .get(`${baseUrl}/${validEstablishment.cue}`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.cue).toBe(validEstablishment.cue);
    expect(res.body.name).toBe(validEstablishment.name);
  });

  it("GET /:cue inexistente → 404", async () => {
    const res = await supertest(app)
      .get(`${baseUrl}/NOEXISTE`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(404);
  });

  it("POST / válido → 201", async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send(validEstablishment);

    expect(res.status).toBe(201);
    expect(res.body.cue).toBe(validEstablishment.cue);
    expect(res.body.name).toBe(validEstablishment.name);
  });

  it("POST / body inválido (Zod) → 400 con detalles", async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({ cue: "AB", name: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Datos invalidos");
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("POST / sin auth → 401", async () => {
    const res = await supertest(app).post(baseUrl).send(validEstablishment);
    expect(res.status).toBe(401);
  });

  it("POST / CUE duplicado → 409", async () => {
    await prisma.establishment.create({ data: validEstablishment });

    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send(validEstablishment);

    expect(res.status).toBe(409);
  });

  it("PATCH /:cue válido → 200", async () => {
    await prisma.establishment.create({ data: validEstablishment });

    const res = await supertest(app)
      .patch(`${baseUrl}/${validEstablishment.cue}`)
      .set("Cookie", authHeader)
      .send({ name: "Nombre Actualizado" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Nombre Actualizado");
  });

  it("PATCH /:cue inexistente → 404", async () => {
    const res = await supertest(app)
      .patch(`${baseUrl}/NOEXISTE`)
      .set("Cookie", authHeader)
      .send({ name: "Nuevo Nombre" });

    expect(res.status).toBe(404);
  });

  it("DELETE /:cue → 204", async () => {
    await prisma.establishment.create({ data: validEstablishment });

    const res = await supertest(app)
      .delete(`${baseUrl}/${validEstablishment.cue}`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(204);
  });

  it("DELETE /:cue inexistente → 404", async () => {
    const res = await supertest(app)
      .delete(`${baseUrl}/NOEXISTE`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(404);
  });
});
