import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
export const COOKIE_NAME = "auth_token";
// Sesión larga: 7 días por defecto, configurable en segundos vía .env
const EXPIRES_IN_SECONDS = Number(process.env.JWT_EXPIRES_IN) || 7 * 24 * 60 * 60;
function getSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error("JWT_SECRET no está definido en .env");
    return secret;
}
export function signSession(payload) {
    return jwt.sign(payload, getSecret(), { expiresIn: EXPIRES_IN_SECONDS });
}
export function verifySession(token) {
    return jwt.verify(token, getSecret());
}
export function toSessionUser(payload) {
    return { id: Number(payload.sub), email: payload.email, name: payload.name };
}
export const sessionCookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: EXPIRES_IN_SECONDS * 1000,
};
// Logging de intentos de autenticación (SOC 2: auditoría)
export async function logAuthAttempt(req, token, success = false, errorCode) {
    try {
        await prisma.auditLog.create({
            data: {
                userId: req.user?.sub ? Number(req.user.sub) : null,
                action: success ? "login_success" : "login_failure",
                resource: "auth",
                details: {
                    ip: req.ip,
                    userAgent: req.get("User-Agent"),
                    ...(token && { token: token.substring(0, 10) + "..." }),
                    errorCode,
                },
                timestamp: new Date(),
            },
        });
    }
    catch (e) {
        // No bloquear la operación si falla el logging
        console.warn("Failed to log auth attempt:", e);
    }
}
//# sourceMappingURL=session.js.map