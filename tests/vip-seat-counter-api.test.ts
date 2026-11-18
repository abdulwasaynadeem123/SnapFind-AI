// @vitest-environment node
import crypto from "crypto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app, serverEntitlements, __vipTestControls } from "../server";

describe("Authoritative 50-Seat VIP Counter, Concurrency & Security", () => {
  beforeEach(() => {
    __vipTestControls?.resetState();
    // Test auth resolver maps "Bearer test-token-<userId>:<email>" cleanly for isolated API tests
    __vipTestControls?.setAuthResolverOverride(async (req) => {
      const auth = req.headers.authorization;
      if (auth && auth.startsWith("Bearer test-token-")) {
        const raw = auth.slice("Bearer test-token-".length);
        const [id, email] = raw.split(":");
        if (id && id !== "guest") {
          return {
            id,
            email: email || `${id}@example.com`,
            isAuthenticated: true,
          };
        }
      }
      return null;
    });
  });

  afterEach(() => {
    __vipTestControls?.resetState();
  });

  it("reports 0 / 50 occupied and 50 available when registry is empty", async () => {
    __vipTestControls?.setRegistryOverride(async () => ({
      totalSeats: 50,
      claims: [],
      updatedAt: new Date().toISOString(),
    }));

    const res = await request(app).get("/api/billing/founder-stats");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalSpots).toBe(50);
    expect(res.body.occupiedSpots).toBe(0);
    expect(res.body.claimedSpots).toBe(0);
    expect(res.body.remainingSpots).toBe(50);
    expect(res.body.isFull).toBe(false);
  });

  it("allocates VIP Seat #1, updates global count for logged-out visitors, and preserves seat on refresh", async () => {
    // Initially empty in local isolated memory
    let res = await request(app).get("/api/billing/founder-stats");
    expect(res.status).toBe(200);
    expect(res.body.occupiedSpots).toBe(0);

    // User 1 claims VIP seat
    const claimRes = await request(app)
      .post("/api/billing/claim-founder")
      .set("Authorization", "Bearer test-token-vip-user-1:vip1@example.com")
      .send({});

    expect(claimRes.status).toBe(200);
    expect(claimRes.body.success).toBe(true);
    expect(claimRes.body.founderNumber).toBe(1);
    expect(claimRes.body.occupiedSpots).toBe(1);
    expect(claimRes.body.remainingSpots).toBe(49);

    // Logged-out visitor / another device queries public stats -> sees exact same 1 / 50
    const publicRes = await request(app).get("/api/billing/founder-stats");
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.occupiedSpots).toBe(1);
    expect(publicRes.body.remainingSpots).toBe(49);

    // Existing VIP user fetches entitlement -> retains VIP Seat #1
    const entRes = await request(app)
      .get("/api/billing/entitlements")
      .set("Authorization", "Bearer test-token-vip-user-1:vip1@example.com");
    expect(entRes.status).toBe(200);
    expect(entRes.body.entitlement.isFounder).toBe(true);
    expect(entRes.body.entitlement.founderNumber).toBe(1);
  });

  it("does not grant VIP status automatically to ordinary users", async () => {
    const res = await request(app)
      .get("/api/billing/entitlements")
      .set("Authorization", "Bearer test-token-ordinary-user-1:normal@example.com");

    expect(res.status).toBe(200);
    expect(res.body.entitlement.isFounder).toBe(false);
    expect(res.body.entitlement.founderNumber).toBeNull();
    expect(res.body.entitlement.plan).toBe("free");
    expect(res.body.entitlement.maxScreenshots).toBe(250);

    // Global VIP seat count must still be 0
    const statsRes = await request(app).get("/api/billing/founder-stats");
    expect(statsRes.body.occupiedSpots).toBe(0);
  });

  it("prevents duplicate claims by the same userId or verified email without double counting", async () => {
    // First claim
    const first = await request(app)
      .post("/api/billing/claim-founder")
      .set("Authorization", "Bearer test-token-dup-user:dup@example.com")
      .send({});
    expect(first.status).toBe(200);
    expect(first.body.founderNumber).toBe(1);
    expect(first.body.occupiedSpots).toBe(1);

    // Duplicate claim by same account
    const second = await request(app)
      .post("/api/billing/claim-founder")
      .set("Authorization", "Bearer test-token-dup-user:dup@example.com")
      .send({});
    expect(second.status).toBe(200);
    expect(second.body.alreadyClaimed).toBe(true);
    expect(second.body.founderNumber).toBe(1);
    expect(second.body.occupiedSpots).toBe(1);

    // Duplicate claim under same verified email (case-insensitive) on a different userId
    const sameEmail = await request(app)
      .post("/api/billing/claim-founder")
      .set("Authorization", "Bearer test-token-dup-user-alt:DUP@example.com")
      .send({});
    expect(sameEmail.status).toBe(200);
    expect(sameEmail.body.alreadyClaimed).toBe(true);
    expect(sameEmail.body.founderNumber).toBe(1);
    expect(sameEmail.body.occupiedSpots).toBe(1);
  });

  it("handles 49 occupied seats, allows seat #50 atomically, and rejects #51 when 50 are occupied", async () => {
    for (let i = 1; i <= 49; i++) {
      __vipTestControls?.seedVipSeat(`existing-vip-${i}`, i, `vip${i}@example.com`);
    }

    // Verify 49 / 50 state and existing VIP #7 retains seat #7
    const stats49 = await request(app).get("/api/billing/founder-stats");
    expect(stats49.status).toBe(200);
    expect(stats49.body.occupiedSpots).toBe(49);
    expect(stats49.body.remainingSpots).toBe(1);
    expect(stats49.body.isFull).toBe(false);

    const existing7 = await request(app)
      .get("/api/billing/entitlements")
      .set("Authorization", "Bearer test-token-existing-vip-7:vip7@example.com");
    expect(existing7.body.entitlement.founderNumber).toBe(7);

    // Concurrent race for final seat #50 by two distinct users
    const [resA, resB] = await Promise.all([
      request(app)
        .post("/api/billing/claim-founder")
        .set("Authorization", "Bearer test-token-racer-a:racera@example.com")
        .send({}),
      request(app)
        .post("/api/billing/claim-founder")
        .set("Authorization", "Bearer test-token-racer-b:racerb@example.com")
        .send({}),
    ]);

    const successes = [resA, resB].filter((r) => r.status === 200 && r.body.success === true);
    const rejections = [resA, resB].filter((r) => r.status === 409 && r.body.success === false);

    expect(successes).toHaveLength(1);
    expect(rejections).toHaveLength(1);
    expect(successes[0].body.founderNumber).toBe(50);
    expect(successes[0].body.occupiedSpots).toBe(50);
    expect(successes[0].body.remainingSpots).toBe(0);
    expect(rejections[0].body.error).toMatch(/50 VIP seats/i);

    // Final count must strictly be 50 / 50 occupied and 0 available
    const stats50 = await request(app).get("/api/billing/founder-stats");
    expect(stats50.status).toBe(200);
    expect(stats50.body.occupiedSpots).toBe(50);
    expect(stats50.body.remainingSpots).toBe(0);
    expect(stats50.body.isFull).toBe(true);

    // 51st user attempt fails cleanly
    const res51 = await request(app)
      .post("/api/billing/claim-founder")
      .set("Authorization", "Bearer test-token-user-51:u51@example.com")
      .send({});
    expect(res51.status).toBe(409);
    expect(res51.body.success).toBe(false);
  });

  it("never increments VIP seat counter merely because a webhook is received", async () => {
    const prevSecret = process.env.PADDLE_WEBHOOK_SECRET;
    process.env.PADDLE_WEBHOOK_SECRET = "test_vip_webhook_secret_key_12345";

    try {
      const payloadObj = {
        event_id: `evt_vip_webhook_${Date.now()}`,
        event_type: "transaction.completed",
        data: {
          id: "txn_webhook_test_1",
          customer_id: "ctm_1",
          currency_code: "PKR",
          details: { totals: { total: "0" } },
          custom_data: {
            plan: "founder",
            user_id: "webhook-non-vip-user",
            email: "webhook@example.com",
          },
        },
      };
      const rawBody = JSON.stringify(payloadObj);
      const ts = Math.floor(Date.now() / 1000).toString();
      const hmac = crypto
        .createHmac("sha256", process.env.PADDLE_WEBHOOK_SECRET)
        .update(`${ts}:${rawBody}`)
        .digest("hex");

      const hookRes = await request(app)
        .post("/api/payments/paddle/webhook")
        .set("Paddle-Signature", `ts=${ts};h1=${hmac}`)
        .set("Content-Type", "application/json")
        .send(rawBody);

      expect([200, 202]).toContain(hookRes.status);
      expect(__vipTestControls?.getFounderCounter()).toBe(0);

      const statsRes = await request(app).get("/api/billing/founder-stats");
      expect(statsRes.status).toBe(200);
      expect(statsRes.body.occupiedSpots).toBe(0);
    } finally {
      if (prevSecret === undefined) delete process.env.PADDLE_WEBHOOK_SECRET;
      else process.env.PADDLE_WEBHOOK_SECRET = prevSecret;
    }
  });

  it("returns 503 error instead of fake 0/50 when authoritative registry fails", async () => {
    __vipTestControls?.setRegistryOverride(async () => {
      throw new Error("Simulated database connection timeout");
    });

    const statsRes = await request(app).get("/api/billing/founder-stats");
    expect(statsRes.status).toBe(503);
    expect(statsRes.body.success).toBe(false);
    expect(statsRes.body.occupiedSpots).toBeUndefined();
    expect(statsRes.body.claimed).toBeUndefined();
    expect(statsRes.body.error).toMatch(/unavailable/i);

    const claimRes = await request(app)
      .post("/api/billing/claim-founder")
      .set("Authorization", "Bearer test-token-u1:u1@example.com")
      .send({});
    expect(claimRes.status).toBe(503);
    expect(claimRes.body.success).toBe(false);

    const remainingRes = await request(app).get("/api/admin/founders/remaining");
    expect(remainingRes.status).toBe(503);
    expect(remainingRes.body.success).toBe(false);
  });

  it("retains claimed VIP seat across simulated app restart and re-login and prevents duplicate claims", async () => {
    const claimRes = await request(app)
      .post("/api/billing/claim-founder")
      .set("Authorization", "Bearer test-token-relogin-user:wasay@example.com")
      .send({});

    expect(claimRes.status).toBe(200);
    expect(claimRes.body.founderNumber).toBe(1);
    expect(claimRes.body.occupiedSpots).toBe(1);
    expect(claimRes.body.remainingSpots).toBe(49);

    // Simulate server restart: wipe in-memory cache and reload from persistent storage
    serverEntitlements.clear();
    __vipTestControls?.reloadFromDisk();

    // Re-login fetches entitlements -> must restore VIP Seat #1 permanently
    const entRes = await request(app)
      .get("/api/billing/entitlements")
      .set("Authorization", "Bearer test-token-relogin-user:wasay@example.com");

    expect(entRes.status).toBe(200);
    expect(entRes.body.entitlement.isFounder).toBe(true);
    expect(entRes.body.entitlement.founderNumber).toBe(1);
    expect(entRes.body.entitlement.plan).toBe("founder");

    // Simulate authoritative DB registry having VIP Seat #1 even if in-memory cache has stale Free row
    serverEntitlements.set("relogin-user", {
      userId: "relogin-user",
      plan: "free",
      tier: "Free",
      isPro: false,
      isFounder: false,
      founderNumber: null,
    });
    __vipTestControls?.setRegistryOverride(async () => ({
      totalSeats: 50,
      claims: [
        {
          id: "fc_1",
          userId: "relogin-user",
          userEmail: "wasay@example.com",
          founderRank: 1,
          founderNumber: 1,
          status: "claimed",
          claimedAt: new Date().toISOString(),
          tier: "Founder",
          plan: "founder",
          isFounder: true,
          isPro: true,
        },
      ],
      updatedAt: new Date().toISOString(),
    }));

    const dbOverrideEnt = await request(app)
      .get("/api/billing/entitlements")
      .set("Authorization", "Bearer test-token-relogin-user:wasay@example.com");
    expect(dbOverrideEnt.status).toBe(200);
    expect(dbOverrideEnt.body.entitlement.isFounder).toBe(true);
    expect(dbOverrideEnt.body.entitlement.founderNumber).toBe(1);

    // Clear registry override back to disk-reloaded state for duplicate-claim check
    __vipTestControls?.setRegistryOverride(null);

    // Duplicate claim from another session/device returns same seat and keeps occupied = 1
    const dupRes = await request(app)
      .post("/api/billing/claim-founder")
      .set("Authorization", "Bearer test-token-relogin-user:wasay@example.com")
      .send({});

    expect(dupRes.status).toBe(200);
    expect(dupRes.body.alreadyClaimed).toBe(true);
    expect(dupRes.body.founderNumber).toBe(1);
    expect(dupRes.body.occupiedSpots).toBe(1);
    expect(dupRes.body.remainingSpots).toBe(49);
  });

  it("always returns valid JSON (never HTML) for VIP status aliases, signed-out claims, 404s, and malformed payloads", async () => {
    // Seed 1 existing VIP seat to verify preservation
    __vipTestControls?.seedVipSeat("preserved-vip-1", 1, "preserved@example.com");

    // 1. All VIP status endpoints return valid JSON with exact 1/50 counts for signed-out and signed-in callers
    for (const endpoint of ["/api/billing/founder-stats", "/api/billing/founder-status", "/api/billing/vip-status"]) {
      const signedOutRes = await request(app).get(endpoint);
      expect(signedOutRes.status).toBe(200);
      expect(signedOutRes.headers["content-type"]).toMatch(/application\/json/i);
      expect(signedOutRes.text.trim().startsWith("<")).toBe(false);
      expect(signedOutRes.body.success).toBe(true);
      expect(signedOutRes.body.occupiedSpots).toBe(1);
      expect(signedOutRes.body.remainingSpots).toBe(49);

      const signedInRes = await request(app)
        .get(endpoint)
        .set("Authorization", "Bearer test-token-preserved-vip-1:preserved@example.com");
      expect(signedInRes.status).toBe(200);
      expect(signedInRes.headers["content-type"]).toMatch(/application\/json/i);
      expect(signedInRes.body.occupiedSpots).toBe(1);
    }

    // 2. Signed-out claim returns JSON 401 and never allocates a seat
    const anonClaim = await request(app).post("/api/billing/claim-founder").send({});
    expect(anonClaim.status).toBe(401);
    expect(anonClaim.headers["content-type"]).toMatch(/application\/json/i);
    expect(anonClaim.body.success).toBe(false);
    expect(__vipTestControls?.getFounderCounter()).toBe(1);

    // 3. Unmatched /api/* routes & wrong HTTP methods return JSON 404 instead of SPA HTML
    const missingRoute = await request(app).get("/api/billing/nonexistent-vip-check");
    expect(missingRoute.status).toBe(404);
    expect(missingRoute.headers["content-type"]).toMatch(/application\/json/i);
    expect(missingRoute.text.trim().startsWith("<")).toBe(false);
    expect(missingRoute.body.success).toBe(false);

    const wrongMethod = await request(app).get("/api/billing/claim-founder");
    expect(wrongMethod.status).toBe(404);
    expect(wrongMethod.headers["content-type"]).toMatch(/application\/json/i);
    expect(wrongMethod.body.success).toBe(false);

    // 4. Malformed JSON body returns JSON 400 instead of Express HTML error page
    const badJson = await request(app)
      .post("/api/billing/claim-founder")
      .set("Content-Type", "application/json")
      .send("{invalid-json");
    expect(badJson.status).toBe(400);
    expect(badJson.headers["content-type"]).toMatch(/application\/json/i);
    expect(badJson.text.trim().startsWith("<")).toBe(false);
    expect(badJson.body.success).toBe(false);

    // 5. Database failure returns JSON 503 and does not mutate existing allocations in memory
    __vipTestControls?.setRegistryOverride(async () => {
      throw new Error("DB connection refused");
    });
    const dbErrStatus = await request(app).get("/api/billing/founder-stats");
    expect(dbErrStatus.status).toBe(503);
    expect(dbErrStatus.headers["content-type"]).toMatch(/application\/json/i);
    expect(dbErrStatus.body.success).toBe(false);

    const dbErrClaim = await request(app)
      .post("/api/billing/claim-founder")
      .set("Authorization", "Bearer test-token-new-user:new@example.com")
      .send({});
    expect(dbErrClaim.status).toBe(503);
    expect(dbErrClaim.headers["content-type"]).toMatch(/application\/json/i);
    expect(dbErrClaim.body.success).toBe(false);
    expect(serverEntitlements.get("new-user")).toBeUndefined();
    expect(serverEntitlements.get("preserved-vip-1")?.founderNumber).toBe(1);
  });
});
