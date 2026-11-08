import { Router } from "express";
import { authenticate } from "../../shared/authenticate.js";
import { COOKIE_NAME, sessionCookieOptions, toSessionUser, } from "../../shared/session.js";
import { loginSchema } from "./auth.dto.js";
import { authService } from "./auth.service.js";
export const authRouter = Router();
authRouter.post("/login", async (req, res) => {
    const input = loginSchema.parse(req.body);
    const { token, user } = await authService.login(input);
    res.cookie(COOKIE_NAME, token, sessionCookieOptions).json({ user });
});
authRouter.post("/logout", (_req, res) => {
    const { maxAge: _maxAge, ...clearOptions } = sessionCookieOptions;
    res.clearCookie(COOKIE_NAME, clearOptions).json({ ok: true });
});
authRouter.get("/me", authenticate, (req, res) => {
    res.json({ user: toSessionUser(req.user) });
});
//# sourceMappingURL=auth.routes.js.map