import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { HttpError } from "./http-error.js";

interface PrismaKnownError {
  name: "PrismaClientKnownRequestError";
  code: string;
  meta?: Record<string, unknown>;
}

// Los clientes generados por proveedor exponen clases distintas para el mismo
// error; se detecta por forma para no depender de la identidad de la clase.
function isPrismaKnownError(error: unknown): error is PrismaKnownError {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { name?: unknown; code?: unknown };
  return candidate.name === "PrismaClientKnownRequestError" && typeof candidate.code === "string";
}

function formatField(field: unknown): string | undefined {
  if (Array.isArray(field)) return field.join(", ");
  return typeof field === "string" ? field : undefined;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Datos invalidos",
      details: err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  // JSON malformado en el body
  if ((err as { type?: string }).type === "entity.parse.failed") {
    res.status(400).json({ error: "JSON invalido en el cuerpo de la peticion" });
    return;
  }

  if (isPrismaKnownError(err) && err.code === "P2002") {
    res.status(409).json({ error: "Valor duplicado", field: err.meta?.target ?? null });
    return;
  }

  // Violación de FK: restricción de borrado (Restrict) o dato referenciado inexistente
  if (isPrismaKnownError(err) && (err.code === "P2003" || err.code === "P2014")) {
    const target = formatField(err.meta?.field);
    res.status(409).json({
      error: target
        ? `No se puede completar la operación sobre '${target}': tiene registros relacionados`
        : "No se puede completar la operación: tiene registros relacionados",
    });
    return;
  }

  console.error("[error]", err);
  res.status(500).json({ error: "Error interno del servidor" });
};
