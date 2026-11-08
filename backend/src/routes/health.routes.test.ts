import { describe, it, expect } from "vitest";
import { createApp } from "../app.js";
import supertest from "supertest";

const app = createApp();

describe("GET /api/health", () => {
  it("debe responder 200 con payload { status: 'ok' }", async () => {
    const res = await supertest(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
