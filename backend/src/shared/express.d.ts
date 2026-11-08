import type { SessionPayload } from "./session.js";

declare global {
  namespace Express {
    interface Request {
      user?: SessionPayload;
    }
  }
}
