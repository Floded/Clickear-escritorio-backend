import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { createTestApp, authCookie, createTestUser, cleanTables, prisma } from "../../test/setup.js";
import supertest from "supertest";

let app: ReturnType<typeof createTestApp>;
let authHeader: string;

beforeEach(async () => {
  app = createTestApp();
  await cleanTables(["inventory_items", "suppliers", "item_assignments", "employees"]);
  const user = await createTestUser({
    email: "inventory@clickear.local",
    password: "InventoryPass123!",
  });
  authHeader = authCookie(user);
});

afterEach(async () => {
  await cleanTables(["inventory_items", "suppliers", "item_assignments", "employees"]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const baseUrl = "/api/inventory-items";

const validItem = {
  name: "Item Test",
  description: "Descripción del item",
  availableQuantity: 10,
};

async function seedSupplier() {
  return prisma.supplier.create({
    data: { name: "Proveedor Test", contactPhone: "12345678" },
  });
}

describe("Inventory Items CRUD", () => {
  it("GET / → 200 con paginación", async () => {
    await prisma.inventoryItem.create({ data: { name: "Item A", availableQuantity: 5 } });
    await prisma.inventoryItem.create({ data: { name: "Item B", availableQuantity: 0 } });

    const res = await supertest(app).get(baseUrl).set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it("GET /:id existente → 200", async () => {
    const item = await prisma.inventoryItem.create({
      data: { name: "Item Detalle", availableQuantity: 7 },
    });

    const res = await supertest(app)
      .get(`${baseUrl}/${item.id}`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(item.id);
    expect(res.body.name).toBe("Item Detalle");
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
      .send(validItem);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe(validItem.name);
    expect(res.body.availableQuantity).toBe(validItem.availableQuantity);
  });

  it("POST / con supplier → 201", async () => {
    const supplier = await seedSupplier();

    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({ ...validItem, supplierId: supplier.id });

    expect(res.status).toBe(201);
    expect(res.body.supplierId).toBe(supplier.id);
  });

  it("POST / supplier inexistente → 404", async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({ ...validItem, supplierId: 99999 });

    expect(res.status).toBe(404);
  });

  it("POST / body inválido (Zod) → 400 con detalles", async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({ name: "", availableQuantity: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Datos invalidos");
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("POST / sin auth → 401", async () => {
    const res = await supertest(app).post(baseUrl).send(validItem);
    expect(res.status).toBe(401);
  });

  it("PATCH /:id válido → 200", async () => {
    const item = await prisma.inventoryItem.create({
      data: { name: "Item Original", availableQuantity: 5 },
    });

    const res = await supertest(app)
      .patch(`${baseUrl}/${item.id}`)
      .set("Cookie", authHeader)
      .send({ name: "Nombre Actualizado" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Nombre Actualizado");
  });

  it("PATCH /:id inexistente → 404", async () => {
    const res = await supertest(app)
      .patch(`${baseUrl}/99999`)
      .set("Cookie", authHeader)
      .send({ name: "X" });

    expect(res.status).toBe(404);
  });

  it("DELETE /:id sin asignaciones → 204", async () => {
    const item = await prisma.inventoryItem.create({
      data: { name: "Para Borrar", availableQuantity: 5 },
    });

    const res = await supertest(app)
      .delete(`${baseUrl}/${item.id}`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(204);
  });

  it("DELETE /:id con asignaciones activas → 409", async () => {
    const item = await prisma.inventoryItem.create({
      data: { name: "Con Asignaciones", availableQuantity: 5 },
    });
    const employee = await prisma.employee.create({
      data: { fullName: "Empleado", dniOrFileNumber: "DNI-INVENTORY" },
    });
    await prisma.itemAssignment.create({
      data: {
        inventoryItemId: item.id,
        employeeId: employee.id,
        quantityAssigned: 1,
        deliveryDate: new Date(),
      },
    });

    const res = await supertest(app)
      .delete(`${baseUrl}/${item.id}`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(409);
  });

  it("DELETE /:id inexistente → 404", async () => {
    const res = await supertest(app)
      .delete(`${baseUrl}/99999`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(404);
  });
});

describe("Inventory Items ajuste de stock", () => {
  it("PATCH /:id/stock suma cantidad positiva → 200", async () => {
    const item = await prisma.inventoryItem.create({
      data: { name: "Stock Suma", availableQuantity: 10 },
    });

    const res = await supertest(app)
      .patch(`${baseUrl}/${item.id}/stock`)
      .set("Cookie", authHeader)
      .send({ quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body.availableQuantity).toBe(15);
  });

  it("PATCH /:id/stock resta cantidad negativa → 200", async () => {
    const item = await prisma.inventoryItem.create({
      data: { name: "Stock Resta", availableQuantity: 10 },
    });

    const res = await supertest(app)
      .patch(`${baseUrl}/${item.id}/stock`)
      .set("Cookie", authHeader)
      .send({ quantity: -3 });

    expect(res.status).toBe(200);
    expect(res.body.availableQuantity).toBe(7);
  });

  it("PATCH /:id/stock que dejaría negativo → 409", async () => {
    const item = await prisma.inventoryItem.create({
      data: { name: "Stock Negativo", availableQuantity: 2 },
    });

    const res = await supertest(app)
      .patch(`${baseUrl}/${item.id}/stock`)
      .set("Cookie", authHeader)
      .send({ quantity: -5 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Ajuste dejaria el stock en negativo");
  });

  it("PATCH /:id/stock cantidad cero → 400", async () => {
    const item = await prisma.inventoryItem.create({
      data: { name: "Stock Cero", availableQuantity: 5 },
    });

    const res = await supertest(app)
      .patch(`${baseUrl}/${item.id}/stock`)
      .set("Cookie", authHeader)
      .send({ quantity: 0 });

    expect(res.status).toBe(400);
  });

  it("PATCH /:id/stock item inexistente → 404", async () => {
    const res = await supertest(app)
      .patch(`${baseUrl}/99999/stock`)
      .set("Cookie", authHeader)
      .send({ quantity: 5 });

    expect(res.status).toBe(404);
  });
});

describe("Inventory Items filtros", () => {
  it("GET / con search → filtra por nombre", async () => {
    await prisma.inventoryItem.create({ data: { name: "Laptop Dell", availableQuantity: 3 } });
    await prisma.inventoryItem.create({ data: { name: "Monitor Samsung", availableQuantity: 5 } });

    const res = await supertest(app)
      .get(`${baseUrl}?search=Dell`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe("Laptop Dell");
  });

  it("GET / con hasStock=true → solo items con stock", async () => {
    await prisma.inventoryItem.create({ data: { name: "Con Stock", availableQuantity: 5 } });
    await prisma.inventoryItem.create({ data: { name: "Sin Stock", availableQuantity: 0 } });

    const res = await supertest(app)
      .get(`${baseUrl}?hasStock=true`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].availableQuantity).toBeGreaterThan(0);
  });

  it("GET / con hasStock=false → solo items sin stock", async () => {
    await prisma.inventoryItem.create({ data: { name: "Con Stock", availableQuantity: 5 } });
    await prisma.inventoryItem.create({ data: { name: "Sin Stock", availableQuantity: 0 } });

    const res = await supertest(app)
      .get(`${baseUrl}?hasStock=false`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].availableQuantity).toBe(0);
  });

  it("GET / con supplierId → filtra por proveedor", async () => {
    const supplier = await seedSupplier();
    await prisma.inventoryItem.create({
      data: { name: "Item Proveedor", availableQuantity: 5, supplierId: supplier.id },
    });
    await prisma.inventoryItem.create({ data: { name: "Item Sin Proveedor", availableQuantity: 5 } });

    const res = await supertest(app)
      .get(`${baseUrl}?supplierId=${supplier.id}`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].supplierId).toBe(supplier.id);
  });
});
