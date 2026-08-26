import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { app } from "../src/app";
import { createAuthToken, publicAccount, shouldRememberSession } from "../src/lib/auth";
import { DATABASE_UNAVAILABLE_MESSAGE, isDatabaseConnectionError } from "../src/lib/database";
import { errorHandler } from "../src/middleware/errors";

function mockResponse() {
  const res = {
    headersSent: false,
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe("app", () => {
  it("serves the health endpoint", async () => {
    const response = await request(app).get("/api/health");

    expect(["connected", "disconnected"]).toContain(response.body.database);
    expect(response.body.status).toBe(response.body.database === "connected" ? "ok" : "unavailable");
    expect(response.status).toBe(response.body.database === "connected" ? 200 : 503);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("returns JSON for unknown routes", async () => {
    const response = await request(app).get("/api/not-a-route");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Route not found" });
  });
});

describe("profile account payload", () => {
  it("exposes sign-in method without leaking the password hash", () => {
    const payload = publicAccount({
      id: 7,
      email: "teacher@school.edu",
      name: "Teacher",
      role: "USER",
      googleId: null,
      passwordHash: "hashed-secret",
      createdAt: new Date("2026-01-15T00:00:00.000Z"),
    });

    expect(payload).toEqual({
      id: 7,
      email: "teacher@school.edu",
      name: "Teacher",
      role: "user",
      google: false,
      hasPassword: true,
      createdAt: "2026-01-15T00:00:00.000Z",
    });
    expect(JSON.stringify(payload)).not.toContain("hashed-secret");
  });

  it("treats long-lived tokens as remember-me sessions", () => {
    const payload = { userId: 1, email: "teacher@school.edu", name: "Teacher", role: "USER" as const };
    expect(shouldRememberSession(createAuthToken(payload, true))).toBe(true);
    expect(shouldRememberSession(createAuthToken(payload, false))).toBe(false);
    expect(shouldRememberSession(undefined)).toBe(false);
  });
});

describe("database connection errors", () => {
  it("detects Prisma initialization and network failures", () => {
    const initError = Object.assign(new Error("Can't reach database server at localhost:3307"), {
      name: "PrismaClientInitializationError",
      errorCode: "P1001",
    });
    const refused = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    const wrapped = Object.assign(new Error("Query engine error"), { cause: refused });

    expect(isDatabaseConnectionError(initError)).toBe(true);
    expect(isDatabaseConnectionError(refused)).toBe(true);
    expect(isDatabaseConnectionError(wrapped)).toBe(true);
    expect(isDatabaseConnectionError(new Error("Invalid email or password"))).toBe(false);
  });

  it("maps connection failures to HTTP 503", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = mockResponse();
    const error = new Prisma.PrismaClientInitializationError(
      "Can't reach database server at `localhost:3307`",
      "6.19.0",
      "P1001",
    );

    errorHandler(error, {} as Request, res as unknown as Response, vi.fn());

    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "5");
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: DATABASE_UNAVAILABLE_MESSAGE });
    log.mockRestore();
  });
});
