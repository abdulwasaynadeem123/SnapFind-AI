// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app, serverEntitlements, __vipTestControls } from "../server";

function authHeader(userId: string, email?: string, verified = true) {
  const verFlag = verified ? "verified" : "unverified";
  return `Bearer test-token-${userId}:${email || `${userId}@example.com`}:${verFlag}`;
}

describe("First 50 Signups Lifetime Free VIP Program — Authoritative API & Concurrency", () => {
  beforeEach(() => {
    __vipTestControls?.resetState();
    __vipTestControls?.setAuthResolverOverride(async (req) => {
      const auth = req.headers.authorization;
      if (auth && auth.startsWith("Bearer test-token-")) {
        const raw = auth.slice("Bearer test-token-".length);
        const [id, email, verFlag] = raw.split(":");
        if (id && id !== "guest") {
          return {
            id,
            email: email || `${id}@example.com`,
            isAuthenticated: true,
            emailVerified: verFlag !== "unverified",
          };
        }
      }
      return null;
    });
  });

  afterEach(() => {
    __vipTestControls?.resetState();
  });

  it("Scenario 1: 1st user signup is eligible (pending) and stays strictly Free until Claim is clicked", async () => {
    const signupRes = await request(app)
      .post("/api/vip/register-signup")
      .set("Authorization", authHeader("signup-user-1", "u1@snapfind.app"))
      .send({});

    expect(signupRes.status).toBe(200);
    expect(signupRes.body.success).toBe(true);
    expect(signupRes.body.eligibility.signupNumber).toBe(1);
    expect(signupRes.body.eligibility.vipEligible).toBe(true);
    expect(signupRes.body.eligibility.vipClaimStatus).toBe("pending");
    expect(signupRes.body.eligibility.isFounder).toBe(false);

    // Must remain on Free plan without auto-granting VIP
    const entRes = await request(app)
      .get("/api/billing/entitlements")
      .set("Authorization", authHeader("signup-user-1", "u1@snapfind.app"));
    expect(entRes.status).toBe(200);
    expect(entRes.body.entitlement.plan).toBe("free");
    expect(entRes.body.entitlement.isFounder).toBe(false);
    expect(entRes.body.entitlement.isPro).toBe(false);
    expect(entRes.body.entitlement.vipEligible).toBe(true);
    expect(entRes.body.entitlement.vipClaimStatus).toBe("pending");

    // Global claimed count is still 0 until user manually clicks Claim
    const statsRes = await request(app).get("/api/vip/status");
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.occupiedSpots).toBe(0);
    expect(statsRes.body.remainingSpots).toBe(50);
  });

  it("Scenario 2 & 3: 50th signup is eligible and claims successfully; 51st signup is not eligible and claim returns 403", async () => {
    for (let i = 1; i <= 49; i++) {
      const r = await request(app)
        .post("/api/vip/register-signup")
        .set("Authorization", authHeader(`u-${i}`, `u${i}@snapfind.app`))
        .send({});
      expect(r.body.eligibility.vipEligible).toBe(true);
    }

    // 50th signup
    const res50Signup = await request(app)
      .post("/api/vip/register-signup")
      .set("Authorization", authHeader("u-50", "u50@snapfind.app"))
      .send({});
    expect(res50Signup.status).toBe(200);
    expect(res50Signup.body.eligibility.signupNumber).toBe(50);
    expect(res50Signup.body.eligibility.vipEligible).toBe(true);
    expect(res50Signup.body.eligibility.vipClaimStatus).toBe("pending");

    // 51st signup
    const res51Signup = await request(app)
      .post("/api/vip/register-signup")
      .set("Authorization", authHeader("u-51", "u51@snapfind.app"))
      .send({});
    expect(res51Signup.status).toBe(200);
    expect(res51Signup.body.eligibility.signupNumber).toBe(51);
    expect(res51Signup.body.eligibility.vipEligible).toBe(false);
    expect(res51Signup.body.eligibility.vipClaimStatus).toBe("not_eligible");

    // 50th claims Lifetime Free VIP
    const claim50 = await request(app)
      .post("/api/vip/claim")
      .set("Authorization", authHeader("u-50", "u50@snapfind.app"))
      .send({});
    expect(claim50.status).toBe(200);
    expect(claim50.body.success).toBe(true);
    expect(claim50.body.founderNumber).toBe(1);
    expect(claim50.body.entitlement.isFounder).toBe(true);
    expect(claim50.body.entitlement.maxScreenshots).toBe(150000);

    // 51st cannot claim
    const claim51 = await request(app)
      .post("/api/vip/claim")
      .set("Authorization", authHeader("u-51", "u51@snapfind.app"))
      .send({});
    expect(claim51.status).toBe(403);
    expect(claim51.body.success).toBe(false);
  });

  it("Scenario 4, 5 & 6: Maybe Later saves deferral & waiting reminder without assigning a seat, survives logout/re-login, and claiming deletes the reminder permanently", async () => {
    await request(app)
      .post("/api/vip/register-signup")
      .set("Authorization", authHeader("defer-user", "defer@snapfind.app"))
      .send({});

    // Click "Maybe Later"
    const deferRes = await request(app)
      .post("/api/vip/defer")
      .set("Authorization", authHeader("defer-user", "defer@snapfind.app"))
      .send({});
    expect(deferRes.status).toBe(200);
    expect(deferRes.body.success).toBe(true);
    expect(deferRes.body.eligibility.vipEligible).toBe(true);
    expect(deferRes.body.eligibility.vipClaimStatus).toBe("pending");
    expect(deferRes.body.eligibility.vipOfferDeferredAt).toBeTruthy();
    expect(deferRes.body.notification.id).toBe("vip_offer_waiting_defer-user");
    expect(deferRes.body.notification.message).toContain("Your Lifetime Free VIP offer is waiting!");

    // Calling defer again is idempotent and never allocates a seat
    const deferAgain = await request(app)
      .post("/api/vip/defer")
      .set("Authorization", authHeader("defer-user", "defer@snapfind.app"))
      .send({});
    expect(deferAgain.status).toBe(200);

    const statusBeforeClaim = await request(app).get("/api/vip/status");
    expect(statusBeforeClaim.body.occupiedSpots).toBe(0);

    // Simulate logout + server restart / new session login
    serverEntitlements.clear();
    __vipTestControls?.reloadFromDisk();

    const reloginElig = await request(app)
      .get("/api/vip/eligibility")
      .set("Authorization", authHeader("defer-user", "defer@snapfind.app"));
    expect(reloginElig.status).toBe(200);
    expect(reloginElig.body.eligibility.vipEligible).toBe(true);
    expect(reloginElig.body.eligibility.vipClaimStatus).toBe("pending");
    expect(reloginElig.body.eligibility.vipOfferDeferredAt).toBeTruthy();

    const reloginNotifs = await request(app)
      .get("/api/notifications")
      .set("Authorization", authHeader("defer-user", "defer@snapfind.app"));
    expect(reloginNotifs.status).toBe(200);
    expect(reloginNotifs.body.notifications).toHaveLength(1);
    expect(reloginNotifs.body.notifications[0].id).toBe("vip_offer_waiting_defer-user");

    // Other users never see defer-user's waiting notification
    const otherNotifs = await request(app)
      .get("/api/notifications")
      .set("Authorization", authHeader("stranger", "stranger@snapfind.app"));
    expect(otherNotifs.body.notifications).toHaveLength(0);

    // User clicks notification and claims Lifetime Free VIP
    const claimRes = await request(app)
      .post("/api/vip/claim")
      .set("Authorization", authHeader("defer-user", "defer@snapfind.app"))
      .send({});
    expect(claimRes.status).toBe(200);
    expect(claimRes.body.founderNumber).toBe(1);

    // Waiting notification is automatically removed from server
    const notifsAfterClaim = await request(app)
      .get("/api/notifications")
      .set("Authorization", authHeader("defer-user", "defer@snapfind.app"));
    expect(notifsAfterClaim.body.notifications).toHaveLength(0);

    // After subsequent logout/re-login, user permanently retains VIP Member #1
    serverEntitlements.clear();
    __vipTestControls?.reloadFromDisk();
    const postClaimElig = await request(app)
      .get("/api/vip/eligibility")
      .set("Authorization", authHeader("defer-user", "defer@snapfind.app"));
    expect(postClaimElig.body.eligibility.vipClaimStatus).toBe("claimed");
    expect(postClaimElig.body.eligibility.isFounder).toBe(true);
    expect(postClaimElig.body.eligibility.founderNumber).toBe(1);
  });

  it("Scenario 7: duplicate claim attempts are idempotent and never consume extra VIP seats", async () => {
    await request(app)
      .post("/api/vip/register-signup")
      .set("Authorization", authHeader("dup-vip", "dupvip@snapfind.app"))
      .send({});

    const first = await request(app)
      .post("/api/vip/claim")
      .set("Authorization", authHeader("dup-vip", "dupvip@snapfind.app"))
      .send({});
    expect(first.status).toBe(200);
    expect(first.body.founderNumber).toBe(1);

    const [second, third] = await Promise.all([
      request(app).post("/api/vip/claim").set("Authorization", authHeader("dup-vip", "dupvip@snapfind.app")).send({}),
      request(app).post("/api/vip/claim").set("Authorization", authHeader("dup-vip", "dupvip@snapfind.app")).send({}),
    ]);

    expect(second.status).toBe(200);
    expect(second.body.alreadyClaimed).toBe(true);
    expect(second.body.founderNumber).toBe(1);
    expect(third.status).toBe(200);
    expect(third.body.alreadyClaimed).toBe(true);
    expect(third.body.founderNumber).toBe(1);

    const stats = await request(app).get("/api/vip/status");
    expect(stats.body.occupiedSpots).toBe(1);
  });

  it("Scenario 8: >50 simultaneous signups and concurrent claims strictly cap at 50 seats", async () => {
    const signupPromises = Array.from({ length: 60 }, (_, idx) =>
      request(app)
        .post("/api/vip/register-signup")
        .set("Authorization", authHeader(`race-${idx + 1}`, `race${idx + 1}@snapfind.app`))
        .send({})
    );
    const signupResults = await Promise.all(signupPromises);
    const eligibleSignups = signupResults.filter((r) => r.body.eligibility?.vipEligible === true);
    const ineligibleSignups = signupResults.filter((r) => r.body.eligibility?.vipEligible === false);

    expect(eligibleSignups).toHaveLength(50);
    expect(ineligibleSignups).toHaveLength(10);

    const claimResults = await Promise.all(
      Array.from({ length: 60 }, (_, idx) =>
        request(app)
          .post("/api/vip/claim")
          .set("Authorization", authHeader(`race-${idx + 1}`, `race${idx + 1}@snapfind.app`))
          .send({})
      )
    );

    const claimSuccess = claimResults.filter((r) => r.status === 200 && r.body.success === true);
    const claimRejected = claimResults.filter((r) => (r.status === 403 || r.status === 409) && r.body.success === false);
    const uniqueRanks = new Set(claimSuccess.map((r) => r.body.founderNumber));

    expect(claimSuccess).toHaveLength(50);
    expect(claimRejected).toHaveLength(10);
    expect(uniqueRanks.size).toBe(50);

    const stats = await request(app).get("/api/vip/status");
    expect(stats.body.occupiedSpots).toBe(50);
    expect(stats.body.remainingSpots).toBe(0);
  });

  it("Scenario 9, 10 & 11: preserves existing non-VIP users (ineligible), existing VIPs (#1/#7), and existing paid Pro users", async () => {
    // Seed existing non-VIP Free user, existing VIP #1 & #7, and existing paid Lifetime Pro user
    __vipTestControls?.seedExistingNonVipUser("legacy-free-1", "legacyfree@snapfind.app");
    __vipTestControls?.seedVipSeat("legacy-vip-1", 1, "vip1@snapfind.app");
    __vipTestControls?.seedVipSeat("legacy-vip-7", 7, "vip7@snapfind.app");
    __vipTestControls?.seedPaidProUser("legacy-pro-1", "lifetime", "pro@snapfind.app");

    // Legacy free user attempting signup registration or claim stays ineligible
    const legacySignup = await request(app)
      .post("/api/vip/register-signup")
      .set("Authorization", authHeader("legacy-free-1", "legacyfree@snapfind.app"))
      .send({});
    expect(legacySignup.body.eligibility.vipEligible).toBe(false);
    expect(legacySignup.body.eligibility.vipClaimStatus).toBe("not_eligible");

    const legacyClaim = await request(app)
      .post("/api/vip/claim")
      .set("Authorization", authHeader("legacy-free-1", "legacyfree@snapfind.app"))
      .send({});
    expect(legacyClaim.status).toBe(403);

    // Existing VIP #7 retains rank #7 and 150k capacity
    const vip7Ent = await request(app)
      .get("/api/billing/entitlements")
      .set("Authorization", authHeader("legacy-vip-7", "vip7@snapfind.app"));
    expect(vip7Ent.body.entitlement.isFounder).toBe(true);
    expect(vip7Ent.body.entitlement.founderNumber).toBe(7);
    expect(vip7Ent.body.entitlement.maxScreenshots).toBe(150000);

    // Existing paid Lifetime Pro user remains untouched
    const proEnt = await request(app)
      .get("/api/billing/entitlements")
      .set("Authorization", authHeader("legacy-pro-1", "pro@snapfind.app"));
    expect(proEnt.body.entitlement.plan).toBe("lifetime");
    expect(proEnt.body.entitlement.isPro).toBe(true);
    expect(proEnt.body.entitlement.isFounder).toBe(false);
    expect(proEnt.body.entitlement.vipClaimStatus).toBe("not_eligible");
  });

  it("Scenario 12: blocks unverified email claims (403) and signed-out eligibility/claim requests (401)", async () => {
    await request(app)
      .post("/api/vip/register-signup")
      .set("Authorization", authHeader("unverified-u1", "unver@snapfind.app", false))
      .send({});

    const unverifiedClaim = await request(app)
      .post("/api/vip/claim")
      .set("Authorization", authHeader("unverified-u1", "unver@snapfind.app", false))
      .send({});
    expect(unverifiedClaim.status).toBe(403);
    expect(unverifiedClaim.body.code).toBe("email_not_verified");

    const anonElig = await request(app).get("/api/vip/eligibility");
    expect(anonElig.status).toBe(401);

    const anonClaim = await request(app).post("/api/vip/claim").send({});
    expect(anonClaim.status).toBe(401);
  });
});
