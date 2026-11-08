import "./shared/json-bigint.js";

import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { requestIdMiddleware } from "./shared/request-id.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";

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

// Orígenes permitidos para CORS (las cookies requieren un origen explícito)
const allowedOrigins = (process.env.ALLOWED_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

export function createApp(): Express {
  const app = express();

  // Configuración para Render: Render usa un proxy inverso que añade el header X-Forwarded-For
  // Esto permite que express-rate-limit identifique correctamente las IPs de los clientes
  app.set("trust proxy", 1);

  //!Borrar luego
  console.log("=================================");
console.log("TRUST PROXY:", app.get("trust proxy"));
console.log("=================================");

  // Request ID for audit trails (SOC 2: unique identification per request)
  app.use(requestIdMiddleware);

  // Security headers (SOC 2 / ISO 27001)
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        frameSrc: ["'none'"],
        connectSrc: ["'self'", "https://clickear.onrender.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    })
  );

  // Additional Helmet middlewares (solo los que no sobreescribimos CSP)
  app.use(helmet.referrerPolicy({ policy: "strict-origin-when-cross-origin" }));
  app.use(helmet.frameguard({ action: "deny" }));
  app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true, preload: true }));
  app.use(helmet.xssFilter());
  app.use(helmet.noSniff());

  // Rate limiting to prevent brute-force (SOC 2 CC6.1, CC6.2)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // límite por IP en la ventana de tiempo
    standardHeaders: true, // headers RateLimit- remaining/reset
    legacyHeaders: false,
  });
//! BORRAR
console.log("RATE LIMITER CONFIGURADO");

  app.use("/api/", limiter);

  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({ name: "clickear-backend", status: "ok" });
  });

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

  app.use(errorHandler);

  return app;
}
