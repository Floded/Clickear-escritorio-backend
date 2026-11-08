import "./shared/json-bigint.js";

import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { requestIdMiddleware } from "./shared/request-id.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";

import { authRouter } from "./modules/auth/auth.routes.js";
import { dispatchOrderRouter, technicianRouter } from "./modules/dispatch/dispatch.routes.js";
import { assignmentRouter } from "./modules/assignments/assignment.routes.js";
import { employeeRouter } from "./modules/employees/employee.routes.js";
import { establishmentRouter } from "./modules/establishments/establishment.routes.js";
import { inventoryItemRouter } from "./modules/inventory/inventory-item.routes.js";
import { supplierRouter } from "./modules/suppliers/supplier.routes.js";
import { ticketRouter } from "./modules/tickets/ticket.routes.js";
import { authenticate } from "./shared/authenticate.js";
import { errorHandler } from "./shared/error-handler.js";
import { healthRouter } from "./routes/health.routes.js";
import { budgetRouter } from "./modules/budgets/budget.routes.js";

export type AppMode = "web" | "desktop";

export interface AppConfig {
  /**
   * "web" (default): despliegue en Render, con CORS, rate-limit y HSTS.
   * "desktop": backend embebido en Electron; mismo origen, sin exposición a red.
   */
  mode?: AppMode;
  /** Orígenes permitidos para CORS. Solo aplica en modo web. */
  allowedOrigins?: string[];
  /** Build de React a servir en el mismo origen. Solo aplica en modo desktop. */
  frontendDist?: string;
}

const API_PREFIX = "/api";
const RENDER_ORIGIN = "https://clickear.onrender.com";

function mountFrontend(app: Express, distDir: string): void {
  if (!fs.existsSync(distDir)) return;

  app.use(express.static(distDir));
  app.get("/{*splat}", (req, res, next) => {
    if (req.path === API_PREFIX || req.path.startsWith(`${API_PREFIX}/`)) return next();
    res.sendFile(path.join(distDir, "index.html"));
  });
}

function resolveAllowedOrigins(config: AppConfig): string[] {
  if (config.allowedOrigins) return config.allowedOrigins;
  return (process.env.ALLOWED_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim());
}

export function createApp(config: AppConfig = {}): Express {
  const isDesktop = config.mode === "desktop";
  const allowedOrigins = resolveAllowedOrigins(config);
  const app = express();

  // En Render hay un proxy inverso que añade X-Forwarded-For
  if (!isDesktop) app.set("trust proxy", 1);

  app.use(requestIdMiddleware);

  // Security headers (SOC 2 / ISO 27001)
  // En desktop el contenido es local y http://127.0.0.1: upgrade-insecure-requests
  // rompería las llamadas al API, por eso no se declara.
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        frameSrc: ["'none'"],
        connectSrc: isDesktop ? ["'self'"] : ["'self'", RENDER_ORIGIN],
        objectSrc: ["'none'"],
        // Helmet lo agrega por default; en desktop rompería las llamadas al API
        upgradeInsecureRequests: isDesktop ? null : [],
      },
    })
  );

  // HSTS no aplica sobre localhost
  if (!isDesktop) {
    app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true, preload: true }));
  }

  app.use(helmet.referrerPolicy({ policy: "strict-origin-when-cross-origin" }));
  app.use(helmet.frameguard({ action: "deny" }));
  app.use(helmet.xssFilter());
  app.use(helmet.noSniff());

  // El backend de escritorio no está expuesto a la red: el rate-limit solo
  // penalizaría al propio usuario.
  if (!isDesktop) {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use("/api/", limiter);
    app.use(cors({ origin: allowedOrigins, credentials: true }));
  }

  app.use(cookieParser());
  app.use(express.json());

  app.use("/api", healthRouter);
  app.use("/api/auth", authRouter);

  app.use("/api/establishments", authenticate, establishmentRouter);
  app.use("/api/dispatch-orders", authenticate, dispatchOrderRouter);
  app.use("/api/technicians", authenticate, technicianRouter);
  app.use("/api/tickets", authenticate, ticketRouter);
  app.use("/api/suppliers", authenticate, supplierRouter);
  app.use("/api/employees", authenticate, employeeRouter);
  app.use("/api/inventory-items", authenticate, inventoryItemRouter);
  app.use("/api/assignments", authenticate, assignmentRouter);
  app.use("/api/budgets", authenticate, budgetRouter);

  // El frontend se sirve después de los routers: la SPA no debe interceptar /api
  if (isDesktop && config.frontendDist) {
    mountFrontend(app, config.frontendDist);
  } else {
    app.get("/", (_req, res) => {
      res.json({ name: "clickear-backend", status: "ok" });
    });
  }

  app.use(errorHandler);

  return app;
}
