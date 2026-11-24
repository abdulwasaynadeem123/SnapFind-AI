// @vitest-environment node
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../server";

describe("Retired legacy VIP signup API", () => {
  it("does not expose the removed server-side VIP claim endpoint", async () => {
    const response = await request(app).post("/api/billing/claim-founder")
      .set("Authorization", "Bearer legacy-test-token").send({});
    expect(response.status).toBe(410);
    expect(response.headers["content-type"]).toMatch(/application\\/json/i);
    expect(response.body).toMatchObject({ success: false, disabled: true });
    expect(response.body.error).toMatch(/discontinued/i);
  });
  it("returns the same retired response for anonymous claim attempts", async () => {
    const response = await request(app).post("/api/billing/claim-founder").send({});
    expect(response.status).toBe(410);
    expect(response.body.disabled).toBe(true);
  });
});
