import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { createTestApp, authCookie, createTestUser, cleanTables, prisma } from "../../test/setup.js";
import supertest from "supertest";

let app: ReturnType<typeof createTestApp>;
let authHeader: string;

beforeEach(async () => {
  app = createTestApp();
  await cleanTables(["employees", "item_assignments", "inventory_items"]);
  const user = await createTestUser({
    email: "employee@clickear.local",
    password: "EmployeePass123!",
  });
  authHeader = authCookie(user);
});

afterEach(async () => {
  await cleanTables(["employees", "item_assignments", "inventory_items"]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const baseUrl = "/api/employees";

const validEmployee = {
  fullName: "Empleado Test",
  dniOrFileNumber: "DNI-12345678",
  phone: "12345678",
  isActive: true,
};

describe("Employees CRUD", () => {
  it("GET / → 200 con paginación", async () => {
    await prisma.employee.create({ data: { fullName: "Empleado A", dniOrFileNumber: "DNI-001" } });
    await prisma.employee.create({ data: { fullName: "Empleado B", dniOrFileNumber: "DNI-002" } });

    const res = await supertest(app).get(baseUrl).set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it("GET /:id existente → 200", async () => {
    const employee = await prisma.employee.create({
      data: { fullName: "Empleado Detalle", dniOrFileNumber: "DNI-DETALLE" },
    });

    const res = await supertest(app)
      .get(`${baseUrl}/${employee.id}`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(employee.id);
    expect(res.body.fullName).toBe("Empleado Detalle");
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
      .send(validEmployee);

    expect(res.status).toBe(201);
    expect(res.body.fullName).toBe(validEmployee.fullName);
    expect(res.body.dniOrFileNumber).toBe(validEmployee.dniOrFileNumber);
    expect(res.body.isActive).toBe(true);
  });

  it("POST / body inválido (Zod) → 400 con detalles", async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({ fullName: "A", dniOrFileNumber: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Datos invalidos");
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("POST / sin auth → 401", async () => {
    const res = await supertest(app).post(baseUrl).send(validEmployee);
    expect(res.status).toBe(401);
  });

  it("POST / DNI duplicado → 409", async () => {
    await prisma.employee.create({ data: validEmployee });

    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send(validEmployee);

    expect(res.status).toBe(409);
  });

  it("PATCH /:id válido → 200", async () => {
    const employee = await prisma.employee.create({
      data: { fullName: "Empleado Original", dniOrFileNumber: "DNI-ORIGINAL" },
    });

    const res = await supertest(app)
      .patch(`${baseUrl}/${employee.id}`)
      .set("Cookie", authHeader)
      .send({ fullName: "Nombre Actualizado" });

    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe("Nombre Actualizado");
  });

  it("PATCH /:id inexistente → 404", async () => {
    const res = await supertest(app)
      .patch(`${baseUrl}/99999`)
      .set("Cookie", authHeader)
      .send({ fullName: "Nuevo Nombre" });

    expect(res.status).toBe(404);
  });

  it("PATCH /:id DNI duplicado → 409", async () => {
    await prisma.employee.create({
      data: { fullName: "Emp 1", dniOrFileNumber: "DNI-111" },
    });
    const employee = await prisma.employee.create({
      data: { fullName: "Emp 2", dniOrFileNumber: "DNI-222" },
    });

    const res = await supertest(app)
      .patch(`${baseUrl}/${employee.id}`)
      .set("Cookie", authHeader)
      .send({ dniOrFileNumber: "DNI-111" });

    expect(res.status).toBe(409);
  });

  it("DELETE /:id sin asignaciones → 204", async () => {
    const employee = await prisma.employee.create({
      data: { fullName: "Para Borrar", dniOrFileNumber: "DNI-BORRAR" },
    });

    const res = await supertest(app)
      .delete(`${baseUrl}/${employee.id}`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(204);
  });

  it("DELETE /:id con asignaciones activas → 409 (usa baja logica)", async () => {
    const employee = await prisma.employee.create({
      data: { fullName: "Con Asignaciones", dniOrFileNumber: "DNI-ASIGNADO" },
    });
    const item = await prisma.inventoryItem.create({
      data: { name: "Item Test", availableQuantity: 10 },
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
      .delete(`${baseUrl}/${employee.id}`)
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

describe("Employees activar/inactivar", () => {
  it("PATCH /:id isActive=false → inactivo", async () => {
    const employee = await prisma.employee.create({
      data: { fullName: "Empleado Activo", dniOrFileNumber: "DNI-ACTIVO", isActive: true },
    });

    const res = await supertest(app)
      .patch(`${baseUrl}/${employee.id}`)
      .set("Cookie", authHeader)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it("PATCH /:id isActive=true → activo", async () => {
    const employee = await prisma.employee.create({
      data: { fullName: "Empleado Inactivo", dniOrFileNumber: "DNI-INACTIVO", isActive: false },
    });

    const res = await supertest(app)
      .patch(`${baseUrl}/${employee.id}`)
      .set("Cookie", authHeader)
      .send({ isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(true);
  });
});

describe("Employees filtros", () => {
  it("GET / con search → filtra por nombre o DNI", async () => {
    await prisma.employee.create({ data: { fullName: "Juan Perez", dniOrFileNumber: "DNI-111" } });
    await prisma.employee.create({ data: { fullName: "Maria Gomez", dniOrFileNumber: "DNI-222" } });

    const res = await supertest(app)
      .get(`${baseUrl}?search=Juan`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].fullName).toBe("Juan Perez");
  });

  it("GET / con isActive=false → solo inactivos", async () => {
    await prisma.employee.create({ data: { fullName: "Activo", dniOrFileNumber: "DNI-A1", isActive: true } });
    await prisma.employee.create({ data: { fullName: "Inactivo", dniOrFileNumber: "DNI-I1", isActive: false } });

    const res = await supertest(app)
      .get(`${baseUrl}?isActive=false`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].isActive).toBe(false);
  });
});
