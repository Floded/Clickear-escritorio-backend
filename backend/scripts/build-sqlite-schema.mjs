import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "prisma", "schema.prisma");
const target = path.join(root, "prisma", "schema-sqlite.prisma");

const header = `// GENERADO por scripts/build-sqlite-schema.mjs a partir de schema.prisma.
// No editar a mano: ejecutar "npm run db:sqlite:schema".
`;

const schema = await readFile(source, "utf8");
const sqliteSchema = schema
  // Los atributos @db.* son nativos de PostgreSQL y SQLite no los acepta
  .replace(/ @db\.[A-Za-z]+(?:\([^)]*\))?/g, "")
  .replace('provider = "postgresql"', 'provider = "sqlite"')
  .replace(
    'provider = "prisma-client-js"',
    'provider = "prisma-client-js"\n  output   = "../generated/sqlite"',
  );

await writeFile(target, header + sqliteSchema);
console.log(`[sqlite] Schema generado en ${path.relative(root, target)}`);
