// @vitest-environment node
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../server";

describe("Legacy VIP seat API retirement", () => {
  it("keeps the old claim endpoint disabled and returns JSON rather than allocating a seat", async () => {
    const response = await request(app).post("/api/billing/claim-founder")
      .set("Authorization", "Bearer test-token-legacy:legacy@example.com").send({});
    expect(response.status).toBe(410);
    expect(response.headers["content-type"]).toMatch(/application\\/json/i);
    expect(response.body.success).toBe(false);
    expect(response.body.disabled).toBe(true);
  });
  it("does not grant a claim through the old endpoint for signed-out callers", async () => {
    const response = await request(app).post("/api/billing/claim-founder").send({});
    expect(response.status).toBe(410);
    expect(response.body.disabled).toBe(true);
  });
});
