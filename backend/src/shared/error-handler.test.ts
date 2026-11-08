import { describe, it, expect } from "vitest";
import { errorHandler } from "./error-handler.js";
import { HttpError, UnauthorizedError, NotFoundError, ConflictError } from "./http-error.js";
import { ZodError } from "zod";
import { z } from "zod";

function mockRes() {
  const res: any = {};
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: any) => { res.body = body; return res; };
  return res;
}

describe("errorHandler", () => {
  it("HttpError(401) → status 401 y { error: mensaje }", () => {
    const res = mockRes();
    errorHandler(new HttpError(401, "No autorizado"), {} as any, res, () => {});
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "No autorizado" });
  });

  it("UnauthorizedError → status 401", () => {
    const res = mockRes();
    errorHandler(new UnauthorizedError("Sesión inválida"), {} as any, res, () => {});
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Sesión inválida" });
  });

  it("NotFoundError → status 404", () => {
    const res = mockRes();
    errorHandler(new NotFoundError("Recurso no encontrado"), {} as any, res, () => {});
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Recurso no encontrado" });
  });

  it("ConflictError → status 409", () => {
    const res = mockRes();
    errorHandler(new ConflictError("Valor duplicado"), {} as any, res, () => {});
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: "Valor duplicado" });
  });

  it("ZodError → status 400 con detalles de validación", () => {
    const schema = z.object({ email: z.string().email() });
    try {
      schema.parse({ email: "no-email" });
    } catch (err) {
      const res = mockRes();
      errorHandler(err as ZodError, {} as any, res, () => {});
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe("Datos invalidos");
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details.length).toBeGreaterThan(0);
    }
  });

  it("error inesperado → status 500 sin stack filtrado", () => {
    const res = mockRes();
    errorHandler(new Error("algo falló"), {} as any, res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Error interno del servidor" });
  });
});
