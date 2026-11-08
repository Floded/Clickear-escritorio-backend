import "../env.js";

import bcrypt from "bcryptjs";
import { createApp } from "../app.js";
import { isSqlite, prisma } from "../prisma/client.js";
import { signSession, COOKIE_NAME } from "../shared/session.js";
import type { Express } from "express";
import type { SessionPayload } from "../shared/session.js";

export { prisma };

export interface TestUser {
  id: number;
  email: string;
  name: string;
}

export function createTestApp(): Express {
  return createApp();
}

export function authCookie(user: TestUser): string {
  const payload: SessionPayload = {
    sub: String(user.id),
    email: user.email,
    name: user.name,
  };
  const token = signSession(payload);
  return `${COOKIE_NAME}=${token}`;
}

export async function createTestUser(overrides?: {
  email?: string;
  password?: string;
  name?: string;
}): Promise<TestUser> {
  const email = overrides?.email ?? "test@clickear.local";
  const password = overrides?.password ?? "TestPass123!";
  const name = overrides?.name ?? "Test User";

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, passwordHash, name },
  });

  return { id: user.id, email: user.email, name: user.name };
}

async function deleteRows(tables: string[]): Promise<void> {
  if (tables.length === 0) return;

  if (isSqlite) {
    // SQLite no tiene TRUNCATE: se borran las filas y se difieren las FK para
    // no depender del orden de las tablas.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("PRAGMA defer_foreign_keys = ON");
      for (const table of tables) {
        await tx.$executeRawUnsafe(`DELETE FROM "${table}"`);
      }
    });
    return;
  }

  await prisma.$queryRawUnsafe(
    `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE`,
  );
}

export async function cleanDb(): Promise<void> {
  // No truncar 'users': se necesita para tests de auth que corren en paralelo
  const tables = [
    "audit_logs",
    "item_assignments",
    "ticket_assignments",
    "budget_lines",
    "invoices",
    "tickets",
    "establishments",
    "budgets",
    "inventory_items",
    "dispatch_technicians",
    "dispatch_orders",
    "technicians",
    "suppliers",
    "employees",
  ];

  await deleteRows(tables);
}

export async function cleanTables(tableNames: string[]): Promise<void> {
  await deleteRows(tableNames);
}
