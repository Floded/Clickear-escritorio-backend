import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { createTestApp, authCookie, createTestUser, cleanTables, prisma } from "../../test/setup.js";
import supertest from "supertest";

let app: ReturnType<typeof createTestApp>;
let authHeader: string;

beforeEach(async () => {
  app = createTestApp();
  await cleanTables(["dispatch_orders", "dispatch_technicians", "technicians", "establishments"]);
  const user = await createTestUser({
    email: "dispatch@clickear.local",
    password: "DispatchPass123!",
  });
  authHeader = authCookie(user);
});

afterEach(async () => {
  await cleanTables(["dispatch_orders", "dispatch_technicians", "technicians", "establishments"]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const baseUrl = "/api/dispatch-orders";

const validDispatchOrder = {
  dispatchCode: "ORD-001",
  dispatchTimestamp: new Date().toISOString(),
  listStatus: "PENDIENTE",
  technicianIds: [],
  establishmentCues: [],
};

async function seedTechnician(fullName = "Tecnico Test") {
  return prisma.technician.create({ data: { fullName } });
}

async function seedEstablishment(cue = "CUE-DISPATCH-01") {
  return prisma.establishment.create({
    data: { cue, name: "Establecimiento Dispatch", department: "Capital", locality: "Centro" },
  });
}

describe("Dispatch Orders CRUD", () => {
  it("GET / → 200 con paginación", async () => {
    await prisma.dispatchOrder.create({
      data: {
        dispatchCode: "ORD-001",
        dispatchTimestamp: new Date(),
        listStatus: "PENDIENTE",
      },
    });
    await prisma.dispatchOrder.create({
      data: {
        dispatchCode: "ORD-002",
        dispatchTimestamp: new Date(),
        listStatus: "COMPLETADO",
      },
    });

    const res = await supertest(app).get(baseUrl).set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it("GET /:id existente → 200", async () => {
    const order = await prisma.dispatchOrder.create({
      data: {
        dispatchCode: "ORD-DETALLE",
        dispatchTimestamp: new Date(),
        listStatus: "PENDIENTE",
      },
    });

    const res = await supertest(app)
      .get(`${baseUrl}/${order.id}`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(order.id);
    expect(res.body.dispatchCode).toBe("ORD-DETALLE");
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
      .send(validDispatchOrder);

    expect(res.status).toBe(201);
    expect(res.body.dispatchCode).toBe(validDispatchOrder.dispatchCode);
    expect(res.body.listStatus).toBe(validDispatchOrder.listStatus);
  });

  it("POST / con técnicos y establecimientos → 201 y vincula", async () => {
    const tech = await seedTechnician();
    const est = await seedEstablishment();

    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({
        ...validDispatchOrder,
        dispatchCode: "ORD-CON-VINCULOS",
        technicianIds: [tech.id],
        establishmentCues: [est.cue],
      });

    expect(res.status).toBe(201);
    expect(res.body.technicians).toHaveLength(1);
    expect(res.body.technicians[0].technician.id).toBe(tech.id);
    expect(res.body.establishments).toHaveLength(1);
    expect(res.body.establishments[0].cue).toBe(est.cue);
  });

  it("POST / técnico inexistente → 404", async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({
        ...validDispatchOrder,
        dispatchCode: "ORD-TEC-NOEXISTE",
        technicianIds: [99999],
      });

    expect(res.status).toBe(404);
  });

  it("POST / establecimiento inexistente → 404", async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({
        ...validDispatchOrder,
        dispatchCode: "ORD-EST-NOEXISTE",
        establishmentCues: ["CUE-NOEXISTE"],
      });

    expect(res.status).toBe(404);
  });

  it("POST / body inválido (Zod) → 400 con detalles", async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({ dispatchCode: "", dispatchTimestamp: "no-es-fecha", listStatus: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Datos invalidos");
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("POST / sin auth → 401", async () => {
    const res = await supertest(app).post(baseUrl).send(validDispatchOrder);
    expect(res.status).toBe(401);
  });

  it("GET / con filtro listStatus → filtra", async () => {
    await prisma.dispatchOrder.create({
      data: { dispatchCode: "ORD-FILTRO-1", dispatchTimestamp: new Date(), listStatus: "PENDIENTE" },
    });
    await prisma.dispatchOrder.create({
      data: { dispatchCode: "ORD-FILTRO-2", dispatchTimestamp: new Date(), listStatus: "COMPLETADO" },
    });

    const res = await supertest(app)
      .get(`${baseUrl}?listStatus=PENDIENTE`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].listStatus).toBe("PENDIENTE");
  });

  it("GET / con filtro dispatchCode → filtra", async () => {
    await prisma.dispatchOrder.create({
      data: { dispatchCode: "ORD-UNICO", dispatchTimestamp: new Date(), listStatus: "PENDIENTE" },
    });

    const res = await supertest(app)
      .get(`${baseUrl}?dispatchCode=UNICO`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].dispatchCode).toContain("UNICO");
  });
});
