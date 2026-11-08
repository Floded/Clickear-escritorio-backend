import "../src/env.js";

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Crea (o actualiza) el usuario administrador inicial a partir del .env
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email) throw new Error("ADMIN_EMAIL no está definido en .env");
  if (!password) throw new Error("ADMIN_PASSWORD no está definido en .env");

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name: process.env.ADMIN_NAME?.trim() || "Administrador" },
    create: {
      email,
      passwordHash,
      name: process.env.ADMIN_NAME?.trim() || "Administrador",
    },
  });

  console.log(`Usuario listo: ${user.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
