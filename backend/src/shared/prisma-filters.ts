import type { Prisma } from "@prisma/client";

import { isSqlite } from "../prisma/client.js";

// SQLite no soporta `mode: "insensitive"`; su LIKE ya ignora mayúsculas en ASCII.
export function containsInsensitive(value: string): Prisma.StringFilter {
  return isSqlite ? { contains: value } : { contains: value, mode: "insensitive" };
}

// En SQLite `equals` es case-sensitive (colación BINARY): se documenta la
// diferencia en lugar de simularla con LIKE.
export function equalsInsensitive(value: string): Prisma.StringFilter {
  return isSqlite ? { equals: value } : { equals: value, mode: "insensitive" };
}
