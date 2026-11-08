// Carga el archivo de entorno según NODE_ENV.
// En Render no existen estos archivos: gana el dashboard (dotenv no pisa lo ya definido).
import { existsSync } from "node:fs";
import { config } from "dotenv";

const file =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : process.env.NODE_ENV === "test"
      ? ".env.test"
      : ".env";

if (existsSync(file)) {
  config({ path: file });
  console.log(`[env] Archivo cargado: ${file}`);
} else {
  console.log(`[env] ${file} no existe; se usan solo variables del sistema`);
}
