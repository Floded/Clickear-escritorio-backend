import "../env.js";

import { describe, it, expect } from "vitest";
import {
  signSession,
  verifySession,
  toSessionUser,
  sessionCookieOptions,
  COOKIE_NAME,
} from "./session.js";

describe("signSession / verifySession", () => {
  const payload = {
    sub: "42",
    email: "usuario@clickear.local",
    name: "Usuario Test",
  };

  it("signSession produce un JWT verificable", () => {
    const token = signSession(payload);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // JWT: header.payload.signature

    const decoded = verifySession(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.name).toBe(payload.name);
  });

  it("verifySession con token inválido lanza error", () => {
    expect(() => verifySession("token.invalido.aquí")).toThrow();
  });

  it("verifySession con token expirado lanza error", () => {
    const jwt = require("jsonwebtoken");
    const expiredToken = jwt.sign(payload, "cualquier-secreto", { expiresIn: -1 });
    expect(() => verifySession(expiredToken)).toThrow();
  });
});

describe("toSessionUser", () => {
  it("extrae id, email y name del payload de sesión", () => {
    const payload = { sub: "10", email: "a@b.com", name: "Nombre" };
    const user = toSessionUser(payload);

    expect(user).toEqual({ id: 10, email: "a@b.com", name: "Nombre" });
  });
});

describe("sessionCookieOptions", () => {
  it("tiene las opciones esperadas (httpOnly, sameSite, secure, path)", () => {
    expect(sessionCookieOptions.httpOnly).toBe(true);
    expect(sessionCookieOptions.sameSite).toBe("none");
    expect(sessionCookieOptions.secure).toBe(true);
    expect(sessionCookieOptions.path).toBe("/");
    expect(sessionCookieOptions.maxAge).toBeDefined();
  });

  it("COOKIE_NAME es auth_token", () => {
    expect(COOKIE_NAME).toBe("auth_token");
  });
});
