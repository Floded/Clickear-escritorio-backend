import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { createTestApp, authCookie, createTestUser, cleanTables, prisma } from "../../test/setup.js";
import supertest from "supertest";

let app: ReturnType<typeof createTestApp>;
let authHeader: string;

beforeEach(async () => {
  app = createTestApp();
  await cleanTables(["suppliers"]);
  const user = await createTestUser({
    email: "supplier@clickear.local",
    password: "SupplierPass123!",
  });
  authHeader = authCookie(user);
});

afterEach(async () => {
  await cleanTables(["suppliers"]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const baseUrl = "/api/suppliers";

const validSupplier = {
  name: "Proveedor Test",
  contactPhone: "12345678",
  contactEmail: "proveedor@test.com",
  website: "https://proveedor.test.com",
};

describe("Suppliers CRUD", () => {
  it("GET / → 200 con paginación", async () => {
    await prisma.supplier.create({ data: { name: "Proveedor A" } });
    await prisma.supplier.create({ data: { name: "Proveedor B" } });

    const res = await supertest(app).get(baseUrl).set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it("GET /:id existente → 200", async () => {
    const supplier = await prisma.supplier.create({ data: { name: "Proveedor Detalle" } });

    const res = await supertest(app)
      .get(`${baseUrl}/${supplier.id}`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(supplier.id);
    expect(res.body.name).toBe("Proveedor Detalle");
  });

  it("GET /:id inexistente → 404", async () => {
    const res = await supertest(app)
      .get(`${baseUrl}/99999`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(404);
  });

  it("POST / válido → 201", async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send(validSupplier);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe(validSupplier.name);
    expect(res.body.contactEmail).toBe(validSupplier.contactEmail);
  });

  it("POST / body inválido (Zod) → 400 con detalles", async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({ name: "A", contactEmail: "no-es-email" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Datos invalidos");
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("POST / sin auth → 401", async () => {
    const res = await supertest(app).post(baseUrl).send(validSupplier);
    expect(res.status).toBe(401);
  });

  it("PATCH /:id válido → 200", async () => {
    const supplier = await prisma.supplier.create({ data: { name: "Proveedor Original" } });

    const res = await supertest(app)
      .patch(`${baseUrl}/${supplier.id}`)
      .set("Cookie", authHeader)
      .send({ name: "Nombre Actualizado" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Nombre Actualizado");
  });

  it("PATCH /:id inexistente → 404", async () => {
    const res = await supertest(app)
      .patch(`${baseUrl}/99999`)
      .set("Cookie", authHeader)
      .send({ name: "Nuevo Nombre" });

    expect(res.status).toBe(404);
  });

  it("DELETE /:id → 204", async () => {
    const supplier = await prisma.supplier.create({ data: { name: "Para Borrar" } });

    const res = await supertest(app)
      .delete(`${baseUrl}/${supplier.id}`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(204);
  });

  it("DELETE /:id inexistente → 404", async () => {
    const res = await supertest(app)
      .delete(`${baseUrl}/99999`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(404);
  });

  it("GET / con search → filtra por nombre", async () => {
    await prisma.supplier.create({ data: { name: "Alpha Proveedor" } });
    await prisma.supplier.create({ data: { name: "Beta Distribuidor" } });
    await prisma.supplier.create({ data: { name: "Gamma SRL" } });

    const res = await supertest(app)
      .get(`${baseUrl}?search=Alpha`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe("Alpha Proveedor");
  });
});
