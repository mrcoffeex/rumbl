import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app";

describe("app", () => {
  it("serves the health endpoint", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("returns JSON for unknown routes", async () => {
    const response = await request(app).get("/api/not-a-route");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Route not found" });
  });
});
