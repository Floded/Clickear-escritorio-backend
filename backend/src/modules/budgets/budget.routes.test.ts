import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { createTestApp, authCookie, createTestUser, cleanTables, prisma } from "../../test/setup.js";
import supertest from "supertest";

let app: ReturnType<typeof createTestApp>;
let authHeader: string;

beforeEach(async () => {
  app = createTestApp();
  await cleanTables(["budgets", "budget_lines", "establishments", "inventory_items"]);
  const user = await createTestUser({
    email: "budget@clickear.local",
    password: "BudgetPass123!",
  });
  authHeader = authCookie(user);
});

afterEach(async () => {
  await cleanTables(["budgets", "budget_lines", "establishments", "inventory_items"]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const baseUrl = "/api/budgets";

const validBudgetLines = [
  { description: "Item 1", quantity: 2, unitPrice: 100 },
  { description: "Item 2", quantity: 1, unitPrice: 250 },
];

const validBudget = {
  customerName: "Cliente Test",
  establishmentCue: undefined,
  validUntil: undefined,
  notes: "Notas de prueba",
  lines: validBudgetLines,
};

async function seedEstablishment(cue = "CUE-BUDGET-01") {
  return prisma.establishment.create({
    data: { cue, name: "Establecimiento Budget", department: "Capital", locality: "Centro" },
  });
}

async function seedInventoryItem(name = "Item Budget") {
  return prisma.inventoryItem.create({ data: { name, availableQuantity: 10 } });
}

describe("Budgets CRUD", () => {
  it("GET / → 200 con lista de presupuestos", async () => {
    await prisma.budget.create({
      data: {
        code: "BUD-001",
        customerName: "Cliente A",
        status: "DRAFT",
        total: 100,
        lines: {
          create: [{ description: "Línea A", quantity: 1, unitPrice: 100, subtotal: 100 }],
        },
      },
    });
    await prisma.budget.create({
      data: {
        code: "BUD-002",
        customerName: "Cliente B",
        status: "DRAFT",
        total: 200,
        lines: {
          create: [{ description: "Línea B", quantity: 2, unitPrice: 100, subtotal: 200 }],
        },
      },
    });

    const res = await supertest(app).get(baseUrl).set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].code).toBe("BUD-002"); // ordenado por createdAt desc
  });

  it("GET /:id existente → 200 con líneas", async () => {
    const budget = await prisma.budget.create({
      data: {
        code: "BUD-001",
        customerName: "Cliente Test",
        total: 450,
        lines: {
          create: validBudgetLines.map((l, i) => ({
            ...l,
            subtotal: l.quantity * l.unitPrice,
          })),
        },
      },
      include: { lines: true },
    });

    const res = await supertest(app)
      .get(`${baseUrl}/${budget.id}`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(budget.id);
    expect(res.body.customerName).toBe("Cliente Test");
    expect(res.body.total).toBe(450);
    expect(res.body.lines).toHaveLength(2);
  });

  it("GET /:id inexistente → 404", async () => {
    const res = await supertest(app)
      .get(`${baseUrl}/99999`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(404);
  });

  it("POST / válido → 201 con total calculado", async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send(validBudget);

    expect(res.status).toBe(201);
    expect(res.body.customerName).toBe(validBudget.customerName);
    expect(res.body.code).toMatch(/^BUD-/);
    // Total: 2*100 + 1*250 = 450
    expect(res.body.total).toBe(450);
    expect(res.body.lines).toHaveLength(2);
    expect(res.body.lines[0].subtotal).toBe(200);
    expect(res.body.lines[1].subtotal).toBe(250);
  });

  it("POST / con establishmentCue válido → 201", async () => {
    await seedEstablishment();

    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({ ...validBudget, establishmentCue: "CUE-BUDGET-01" });

    expect(res.status).toBe(201);
    expect(res.body.establishmentCue).toBe("CUE-BUDGET-01");
  });

  it("POST / con establishmentCue inexistente → 400", async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({ ...validBudget, establishmentCue: "CUE-NOEXISTE" });

    expect(res.status).toBe(400);
  });

  it("POST / sin líneas → 400 (Zod)", async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({ ...validBudget, lines: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Datos invalidos");
  });

  it("POST / body inválido → 400 con detalles", async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({ customerName: "", lines: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Datos invalidos");
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("POST / sin auth → 401", async () => {
    const res = await supertest(app).post(baseUrl).send(validBudget);
    expect(res.status).toBe(401);
  });

  it("PATCH /:id válido → 200", async () => {
    const budget = await prisma.budget.create({
      data: {
        code: "BUD-001",
        customerName: "Cliente Original",
        total: 100,
        lines: { create: [{ description: "Línea", quantity: 1, unitPrice: 100, subtotal: 100 }] },
      },
    });

    const res = await supertest(app)
      .patch(`${baseUrl}/${budget.id}`)
      .set("Cookie", authHeader)
      .send({ customerName: "Nombre Actualizado" });

    expect(res.status).toBe(200);
    expect(res.body.customerName).toBe("Nombre Actualizado");
  });

  it("PATCH /:id con nuevas líneas → recalcula total", async () => {
    const budget = await prisma.budget.create({
      data: {
        code: "BUD-001",
        customerName: "Cliente",
        total: 100,
        lines: { create: [{ description: "Línea", quantity: 1, unitPrice: 100, subtotal: 100 }] },
      },
    });

    const res = await supertest(app)
      .patch(`${baseUrl}/${budget.id}`)
      .set("Cookie", authHeader)
      .send({
        lines: [
          { description: "Línea Nueva", quantity: 3, unitPrice: 50 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(150); // 3 * 50
    expect(res.body.lines).toHaveLength(1);
  });

  it("PATCH /:id con líneas vacías → 400", async () => {
    const budget = await prisma.budget.create({
      data: {
        code: "BUD-001",
        customerName: "Cliente",
        total: 100,
        lines: { create: [{ description: "Línea", quantity: 1, unitPrice: 100, subtotal: 100 }] },
      },
    });

    const res = await supertest(app)
      .patch(`${baseUrl}/${budget.id}`)
      .set("Cookie", authHeader)
      .send({ lines: [] });

    expect(res.status).toBe(400);
  });

  it("PATCH /:id inexistente → 404", async () => {
    const res = await supertest(app)
      .patch(`${baseUrl}/99999`)
      .set("Cookie", authHeader)
      .send({ customerName: "X" });

    expect(res.status).toBe(404);
  });

  it("DELETE /:id → 204", async () => {
    const budget = await prisma.budget.create({
      data: {
        code: "BUD-001",
        customerName: "Para Borrar",
        total: 100,
        lines: { create: [{ description: "Línea", quantity: 1, unitPrice: 100, subtotal: 100 }] },
      },
    });

    const res = await supertest(app)
      .delete(`${baseUrl}/${budget.id}`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(204);
  });

  it("DELETE /:id inexistente → 404", async () => {
    const res = await supertest(app)
      .delete(`${baseUrl}/99999`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(404);
  });
});

describe("Budgets filtros", () => {
  it("GET / con establishmentCue → filtra por establecimiento", async () => {
    await seedEstablishment("CUE-A");
    await seedEstablishment("CUE-B");

    await prisma.budget.create({
      data: {
        code: "BUD-A",
        customerName: "Cliente A",
        establishmentCue: "CUE-A",
        total: 100,
        lines: { create: [{ description: "Línea", quantity: 1, unitPrice: 100, subtotal: 100 }] },
      },
    });
    await prisma.budget.create({
      data: {
        code: "BUD-B",
        customerName: "Cliente B",
        establishmentCue: "CUE-B",
        total: 200,
        lines: { create: [{ description: "Línea", quantity: 2, unitPrice: 100, subtotal: 200 }] },
      },
    });

    const res = await supertest(app)
      .get(`${baseUrl}?establishmentCue=CUE-A`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].establishmentCue).toBe("CUE-A");
  });
});
