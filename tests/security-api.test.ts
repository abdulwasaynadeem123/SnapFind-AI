// @vitest-environment node
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app, CANONICAL_PRODUCTS, PLAN_FEATURES_MAP } from "../server";

describe("Server API Security, Authorization & Canonical Billing", () => {
  it("returns 200 OK on /api/health", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("exposes canonical PKR pricing on /api/billing/products", async () => {
    const res = await request(app).get("/api/billing/products");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.products)).toBe(true);

    const monthly = CANONICAL_PRODUCTS.find((p: any) => p.productId === "snapfind_pro_monthly");
    const yearly = CANONICAL_PRODUCTS.find((p: any) => p.productId === "snapfind_pro_yearly");
    const lifetime = CANONICAL_PRODUCTS.find((p: any) => p.productId === "snapfind_pro_lifetime");

    expect(monthly?.priceAmount).toBe(249);
    expect(yearly?.priceAmount).toBe(1999);
    expect(lifetime?.priceAmount).toBe(5999);
    expect(PLAN_FEATURES_MAP.free.maxIndexedScreenshots).toBe(250);
    expect(PLAN_FEATURES_MAP.founder.maxIndexedScreenshots).toBe(150000);
  });

  it("rejects unauthenticated billing purchase verification and restore calls with 401", async () => {
    const verifyRes = await request(app)
      .post("/api/billing/verify-purchase")
      .send({
        userId: "victim-user-id",
        productId: "snapfind_pro_lifetime",
        purchaseToken: "fake-token-123",
      });
    expect(verifyRes.status).toBe(401);

    const restoreRes = await request(app)
      .post("/api/billing/restore-purchases")
      .send({ userId: "victim-user-id", purchases: [] });
    expect(restoreRes.status).toBe(401);
  });

  it("rejects unauthenticated access to admin audit logs and account deletion", async () => {
    const auditRes = await request(app).get("/api/billing/audit-events");
    expect([401, 403]).toContain(auditRes.status);

    const deleteRes = await request(app).post("/api/account/delete").send({});
    expect(deleteRes.status).toBe(401);
  });

  it("validates CORS and rejects arbitrary foreign origins while allowing same-origin", async () => {
    const allowed = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:3000");
    expect(allowed.status).toBe(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");

    const blocked = await request(app)
      .get("/api/health")
      .set("Origin", "https://evil-attacker.example.com");
    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
