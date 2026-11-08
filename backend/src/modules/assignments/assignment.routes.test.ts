import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { createTestApp, authCookie, createTestUser, cleanTables, prisma } from "../../test/setup.js";
import supertest from "supertest";

let app: ReturnType<typeof createTestApp>;
let authHeader: string;

beforeEach(async () => {
  app = createTestApp();
  await cleanTables(["item_assignments", "inventory_items", "employees"]);
  const user = await createTestUser({
    email: "assignment@clickear.local",
    password: "AssignmentPass123!",
  });
  authHeader = authCookie(user);
});

afterEach(async () => {
  await cleanTables(["item_assignments", "inventory_items", "employees"]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const baseUrl = "/api/assignments";

async function seedItem(name = "Item Asignacion", quantity = 10) {
  return prisma.inventoryItem.create({
    data: { name, availableQuantity: quantity },
  });
}

async function seedEmployee(overrides?: { fullName?: string; isActive?: boolean }) {
  return prisma.employee.create({
    data: {
      fullName: overrides?.fullName ?? "Empleado Asignacion",
      dniOrFileNumber: `DNI-ASSIGN-${Math.floor(Math.random() * 1000000)}`,
      isActive: overrides?.isActive ?? true,
    },
  });
}

const validAssignment = {
  inventoryItemId: 1, // se sobrescribe en cada test que lo necesite
  employeeId: 1,
  quantityAssigned: 3,
  deliveryDate: new Date().toISOString(),
};

describe("Assignments CRUD", () => {
  it("GET / → 200 con paginación", async () => {
    const item = await seedItem();
    const employee = await seedEmployee();
    await prisma.itemAssignment.create({
      data: {
        inventoryItemId: item.id,
        employeeId: employee.id,
        quantityAssigned: 2,
        deliveryDate: new Date(),
      },
    });
    await prisma.itemAssignment.create({
      data: {
        inventoryItemId: item.id,
        employeeId: employee.id,
        quantityAssigned: 1,
        deliveryDate: new Date(),
        returnDate: new Date(),
      },
    });

    const res = await supertest(app).get(baseUrl).set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it("POST / válido → 201 y descuenta stock", async () => {
    const item = await seedItem("Item Disponible", 10);
    const employee = await seedEmployee();

    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({
        inventoryItemId: item.id,
        employeeId: employee.id,
        quantityAssigned: 3,
        deliveryDate: new Date().toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.quantityAssigned).toBe(3);
    expect(res.body.inventoryItemId).toBe(item.id);
    expect(res.body.employeeId).toBe(employee.id);

    // Verifica que el stock se descontó
    const updated = await prisma.inventoryItem.findUnique({ where: { id: item.id } });
    expect(updated?.availableQuantity).toBe(7);
  });

  it("POST / sin auth → 401", async () => {
    const res = await supertest(app).post(baseUrl).send(validAssignment);
    expect(res.status).toBe(401);
  });

  it("POST / body inválido (Zod) → 400 con detalles", async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({ inventoryItemId: 0, employeeId: 0, quantityAssigned: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Datos invalidos");
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("POST / item inexistente → 404", async () => {
    const employee = await seedEmployee();

    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({
        inventoryItemId: 99999,
        employeeId: employee.id,
        quantityAssigned: 1,
        deliveryDate: new Date().toISOString(),
      });

    expect(res.status).toBe(404);
  });

  it("POST / employee inexistente → 404", async () => {
    const item = await seedItem();

    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({
        inventoryItemId: item.id,
        employeeId: 99999,
        quantityAssigned: 1,
        deliveryDate: new Date().toISOString(),
      });

    expect(res.status).toBe(404);
  });

  it("POST / employee inactivo → 409", async () => {
    const item = await seedItem();
    const employee = await seedEmployee({ isActive: false });

    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({
        inventoryItemId: item.id,
        employeeId: employee.id,
        quantityAssigned: 1,
        deliveryDate: new Date().toISOString(),
      });

    expect(res.status).toBe(409);
  });

  it("POST / stock insuficiente → 409", async () => {
    const item = await seedItem("Stock Bajo", 2);
    const employee = await seedEmployee();

    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({
        inventoryItemId: item.id,
        employeeId: employee.id,
        quantityAssigned: 5,
        deliveryDate: new Date().toISOString(),
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("Stock insuficiente");
  });
});

describe("Assignments devolución", () => {
  it("PUT /:id/return total → 200 y re-suma stock", async () => {
    const item = await seedItem("Item Devolucion", 10);
    const employee = await seedEmployee();

    const createRes = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({
        inventoryItemId: item.id,
        employeeId: employee.id,
        quantityAssigned: 4,
        deliveryDate: new Date().toISOString(),
      });
    expect(createRes.status).toBe(201);
    const assignmentId = createRes.body.id;

    // Stock debería ser 6 (10 - 4)
    let updated = await prisma.inventoryItem.findUnique({ where: { id: item.id } });
    expect(updated?.availableQuantity).toBe(6);

    const res = await supertest(app)
      .put(`${baseUrl}/${assignmentId}/return`)
      .set("Cookie", authHeader)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.returnDate).not.toBeNull();

    updated = await prisma.inventoryItem.findUnique({ where: { id: item.id } });
    expect(updated?.availableQuantity).toBe(10); // se devolvieron las 4 unidades
  });

  it("PUT /:id/return parcial → 200, queda parte en custodia y re-suma", async () => {
    const item = await seedItem("Item Parcial", 10);
    const employee = await seedEmployee();

    const createRes = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({
        inventoryItemId: item.id,
        employeeId: employee.id,
        quantityAssigned: 10,
        deliveryDate: new Date().toISOString(),
      });
    expect(createRes.status).toBe(201);
    const assignmentId = createRes.body.id;

    // Stock debería ser 0 (10 - 10)
    let updated = await prisma.inventoryItem.findUnique({ where: { id: item.id } });
    expect(updated?.availableQuantity).toBe(0);

    const res = await supertest(app)
      .put(`${baseUrl}/${assignmentId}/return`)
      .set("Cookie", authHeader)
      .send({ quantity: 3 });

    expect(res.status).toBe(200);

    // El stock debería ser 3 (0 + 3)
    updated = await prisma.inventoryItem.findUnique({ where: { id: item.id } });
    expect(updated?.availableQuantity).toBe(3);

    // La asignación original queda con 7 en custodia
    const remaining = await prisma.itemAssignment.findUnique({ where: { id: assignmentId } });
    expect(remaining?.quantityAssigned).toBe(7);
    expect(remaining?.returnDate).toBeNull();

    // Se creó una nueva fila para las 3 devueltas
    const returned = await prisma.itemAssignment.findFirst({
      where: { employeeId: employee.id, returnDate: { not: null } },
    });
    expect(returned?.quantityAssigned).toBe(3);
  });

  it("PUT /:id/return ya devuelta → 409", async () => {
    const item = await seedItem();
    const employee = await seedEmployee();
    const assignment = await prisma.itemAssignment.create({
      data: {
        inventoryItemId: item.id,
        employeeId: employee.id,
        quantityAssigned: 2,
        deliveryDate: new Date(),
        returnDate: new Date(),
      },
    });

    const res = await supertest(app)
      .put(`${baseUrl}/${assignment.id}/return`)
      .set("Cookie", authHeader)
      .send({});

    expect(res.status).toBe(409);
  });

  it("PUT /:id/return más de lo asignado → 409", async () => {
    const item = await seedItem();
    const employee = await seedEmployee();
    const assignment = await prisma.itemAssignment.create({
      data: {
        inventoryItemId: item.id,
        employeeId: employee.id,
        quantityAssigned: 2,
        deliveryDate: new Date(),
      },
    });

    const res = await supertest(app)
      .put(`${baseUrl}/${assignment.id}/return`)
      .set("Cookie", authHeader)
      .send({ quantity: 5 });

    expect(res.status).toBe(409);
  });

  it("PUT /:id/return asignación inexistente → 404", async () => {
    const res = await supertest(app)
      .put(`${baseUrl}/99999/return`)
      .set("Cookie", authHeader)
      .send({});

    expect(res.status).toBe(404);
  });
});

describe("Assignments filtros", () => {
  it("GET / con status=ACTIVE → solo asignaciones sin devolver", async () => {
    const item = await seedItem();
    const employee = await seedEmployee();
    await prisma.itemAssignment.create({
      data: { inventoryItemId: item.id, employeeId: employee.id, quantityAssigned: 2, deliveryDate: new Date() },
    });
    await prisma.itemAssignment.create({
      data: {
        inventoryItemId: item.id,
        employeeId: employee.id,
        quantityAssigned: 1,
        deliveryDate: new Date(),
        returnDate: new Date(),
      },
    });

    const res = await supertest(app)
      .get(`${baseUrl}?status=ACTIVE`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].returnDate).toBeNull();
  });

  it("GET / con status=RETURNED → solo asignaciones devueltas", async () => {
    const item = await seedItem();
    const employee = await seedEmployee();
    await prisma.itemAssignment.create({
      data: { inventoryItemId: item.id, employeeId: employee.id, quantityAssigned: 2, deliveryDate: new Date() },
    });
    await prisma.itemAssignment.create({
      data: {
        inventoryItemId: item.id,
        employeeId: employee.id,
        quantityAssigned: 1,
        deliveryDate: new Date(),
        returnDate: new Date(),
      },
    });

    const res = await supertest(app)
      .get(`${baseUrl}?status=RETURNED`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].returnDate).not.toBeNull();
  });

  it("GET / con employeeId → filtra por empleado", async () => {
    const item = await seedItem();
    const employee1 = await seedEmployee({ fullName: "Empleado Uno" });
    const employee2 = await seedEmployee({ fullName: "Empleado Dos" });
    await prisma.itemAssignment.create({
      data: { inventoryItemId: item.id, employeeId: employee1.id, quantityAssigned: 1, deliveryDate: new Date() },
    });
    await prisma.itemAssignment.create({
      data: { inventoryItemId: item.id, employeeId: employee2.id, quantityAssigned: 1, deliveryDate: new Date() },
    });

    const res = await supertest(app)
      .get(`${baseUrl}?employeeId=${employee1.id}`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].employeeId).toBe(employee1.id);
  });
});
