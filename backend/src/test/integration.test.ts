import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { createTestApp, authCookie, createTestUser, cleanTables, prisma } from "./setup.js";
import supertest from "supertest";

let app: ReturnType<typeof createTestApp>;
let authHeader: string;

beforeEach(async () => {
  app = createTestApp();
  await cleanTables([
    "budgets", "budget_lines",
    "ticket_assignments", "tickets",
    "item_assignments", "inventory_items",
    "establishments", "employees",
  ]);
  const user = await createTestUser({
    email: "integration@clickear.local",
    password: "IntegrationPass123!",
  });
  authHeader = authCookie(user);
});

afterEach(async () => {
  await cleanTables([
    "budgets", "budget_lines",
    "ticket_assignments", "tickets",
    "item_assignments", "inventory_items",
    "establishments", "employees",
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Integración cruzando módulos", () => {
  it("flujo completo: establecimiento → ticket → empleado asignado → ítem asignado → presupuesto", async () => {
    // 1. Crear establecimiento
    const estRes = await supertest(app)
      .post("/api/establishments")
      .set("Cookie", authHeader)
      .send({
        cue: "CUE-INTEG-01",
        name: "Escuela Integración",
        department: "Capital",
        locality: "Centro",
        address: "Calle 123",
      });
    expect(estRes.status).toBe(201);
    const establishmentCue = estRes.body.cue;

    // 2. Crear empleado
    const empRes = await supertest(app)
      .post("/api/employees")
      .set("Cookie", authHeader)
      .send({
        fullName: "Empleado Integración",
        dniOrFileNumber: "DNI-INTEG-001",
        phone: "12345678",
      });
    expect(empRes.status).toBe(201);
    const employeeId = empRes.body.id;

    // 3. Crear ítem de inventario
    const itemRes = await supertest(app)
      .post("/api/inventory-items")
      .set("Cookie", authHeader)
      .send({
        name: "Laptop",
        availableQuantity: 10,
      });
    expect(itemRes.status).toBe(201);
    const inventoryItemId = itemRes.body.id;

    // 4. Crear ticket vinculado al establecimiento
    const ticketRes = await supertest(app)
      .post("/api/tickets")
      .set("Cookie", authHeader)
      .send({
        ticketId: 9001,
        establishmentCue,
        title: "Ticket de integración",
        status: "ABIERTO",
      });
    expect(ticketRes.status).toBe(201);
    const ticketId = ticketRes.body.ticketId;

    // 5. Asignar ticket al empleado
    const assignTicketRes = await supertest(app)
      .patch(`/api/tickets/${ticketId}/assignment`)
      .set("Cookie", authHeader)
      .send({ employeeId });
    expect(assignTicketRes.status).toBe(200);
    expect(assignTicketRes.body.assignedEmployeeId).toBe(employeeId);

    // 6. Cambiar estado del ticket a EN PROGRESO
    const statusRes = await supertest(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set("Cookie", authHeader)
      .send({ status: "EN PROGRESO" });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe("EN PROGRESO");

    // 7. Asignar ítem de inventario al empleado (descuenta stock)
    const assignItemRes = await supertest(app)
      .post("/api/assignments")
      .set("Cookie", authHeader)
      .send({
        inventoryItemId,
        employeeId,
        quantityAssigned: 2,
        deliveryDate: new Date().toISOString(),
      });
    expect(assignItemRes.status).toBe(201);
    expect(assignItemRes.body.quantityAssigned).toBe(2);

    // Verificar que el stock se descontó (10 - 2 = 8)
    const itemAfter = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
    expect(itemAfter?.availableQuantity).toBe(8);

    // 8. Crear presupuesto para el establecimiento
    const budgetRes = await supertest(app)
      .post("/api/budgets")
      .set("Cookie", authHeader)
      .send({
        customerName: "Cliente Integración",
        establishmentCue,
        notes: "Presupuesto de integración",
        lines: [
          { description: "Laptop", quantity: 2, unitPrice: 50000 },
          { description: "Mouse", quantity: 2, unitPrice: 5000 },
        ],
      });
    expect(budgetRes.status).toBe(201);
    // Total: 2*50000 + 2*5000 = 110000
    expect(budgetRes.body.total).toBe(110000);
    expect(budgetRes.body.establishmentCue).toBe(establishmentCue);
    expect(budgetRes.body.lines).toHaveLength(2);

    // 9. Verificar que el ticket aparece vinculado al establecimiento
    const ticketDetail = await supertest(app)
      .get(`/api/tickets/${ticketId}`)
      .set("Cookie", authHeader);
    expect(ticketDetail.status).toBe(200);
    expect(ticketDetail.body.establishmentCue).toBe(establishmentCue);

    // 10. Devolver el ítem parcialmente (1 de 2) y verificar stock vuelve a 9
    const returnRes = await supertest(app)
      .put(`/api/assignments/${assignItemRes.body.id}/return`)
      .set("Cookie", authHeader)
      .send({ quantity: 1 });
    expect(returnRes.status).toBe(200);

    const itemFinal = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
    expect(itemFinal?.availableQuantity).toBe(9);
  });

  it("flujo de ticket sin asignar se puede listar con employeeId=none", async () => {
    const estRes = await supertest(app)
      .post("/api/establishments")
      .set("Cookie", authHeader)
      .send({
        cue: "CUE-INTEG-02",
        name: "Escuela Sin Asignar",
        department: "Interior",
        locality: "Pueblo",
      });
    expect(estRes.status).toBe(201);

    await supertest(app)
      .post("/api/tickets")
      .set("Cookie", authHeader)
      .send({
        ticketId: 9002,
        establishmentCue: "CUE-INTEG-02",
        title: "Ticket sin asignar",
        status: "ABIERTO",
      });

    const res = await supertest(app)
      .get("/api/tickets?employeeId=none")
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    const unassigned = res.body.data.filter((t: any) => t.establishmentCue === "CUE-INTEG-02");
    expect(unassigned.length).toBeGreaterThanOrEqual(1);
    expect(unassigned.every((t: any) => t.assignedEmployeeId === null)).toBe(true);
  });
});
