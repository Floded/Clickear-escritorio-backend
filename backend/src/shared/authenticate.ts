import type { RequestHandler } from "express";

import { COOKIE_NAME, verifySession, logAuthAttempt } from "./session.js";
import { UnauthorizedError } from "./http-error.js";

// Middleware global: exige sesión válida, deja el usuario en req.user y registra intento
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    await logAuthAttempt(req, undefined, false, "missing_token");
    next(new UnauthorizedError("Sesión no encontrada"));
    return;
  }

  try {
    req.user = verifySession(token);
    await logAuthAttempt(req, token, true);
    next();
  } catch {
    await logAuthAttempt(req, token, false, "invalid_token");
    next(new UnauthorizedError("Sesión inválida o expirada"));
  }
};
