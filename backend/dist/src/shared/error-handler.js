import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { HttpError } from "./http-error.js";
export const errorHandler = (err, _req, res, _next) => {
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
    if (err.type === "entity.parse.failed") {
        res.status(400).json({ error: "JSON invalido en el cuerpo de la peticion" });
        return;
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        res.status(409).json({ error: "Valor duplicado", field: err.meta?.target ?? null });
        return;
    }
    // Violación de FK: restricción de borrado (Restrict) o dato referenciado inexistente
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2003" || err.code === "P2014")) {
        const field = err.meta?.field;
        const target = Array.isArray(field) ? field.join(", ") : field;
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
//# sourceMappingURL=error-handler.js.map