import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SubscriptionManager } from "../src/services/billing/SubscriptionManager";

describe("SubscriptionManager VIP Seat Persistence & Sign-Out Isolation", () => {
  beforeEach(() => {
    localStorage.clear();
    SubscriptionManager.resetToFree();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retains VIP seat across sign-out and re-login from /api/billing/entitlements and isolates across users", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/billing/entitlements")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            entitlement: {
              userId: "vip-user-1",
              plan: "founder",
              tier: "Founder",
              isPro: true,
              isFounder: true,
              founderNumber: 1,
              maxScreenshots: 150000,
              canCloudSync: true,
              canAiMultimodalSearch: true,
              priorityProcessing: true,
              status: "active",
            },
          }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) } as Response;
    });

    // 1. Initial sync on login -> acquires VIP Seat #1
    const firstEnt = await SubscriptionManager.syncEntitlementsFromServer("vip-user-1");
    expect(firstEnt.isFounder).toBe(true);
    expect(firstEnt.founderNumber).toBe(1);
    expect(firstEnt.maxScreenshots).toBe(150000);

    // 2. Switching to a different user must never leak user 1's VIP entitlement
    const otherEnt = SubscriptionManager.getUserEntitlements("other-user-2");
    expect(otherEnt.isFounder).toBe(false);
    expect(otherEnt.founderNumber).toBeNull();
    expect(otherEnt.plan).toBe("free");

    // 3. Sign out clears all VIP storage keys & cache cleanly
    SubscriptionManager.resetToFree();
    expect(localStorage.getItem("snapfind_user_entitlement_v2")).toBeNull();
    expect(localStorage.getItem("snapfind_founder_status_v1")).toBeNull();
    expect(localStorage.getItem("snapfind_entitlement_last_verified")).toBeNull();
    expect(SubscriptionManager.getUserEntitlements("vip-user-1").isFounder).toBe(false);

    // 4. Re-login restores permanent VIP Seat #1
    const restoredEnt = await SubscriptionManager.syncEntitlementsFromServer("vip-user-1");
    expect(restoredEnt.isFounder).toBe(true);
    expect(restoredEnt.founderNumber).toBe(1);
    expect(restoredEnt.maxScreenshots).toBe(150000);
  });

  it("throws when authoritative founder-stats fails rather than returning fake 0/50 counts", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({ success: false, error: "VIP seat availability is temporarily unavailable." }),
    } as unknown as Response);

    await expect(SubscriptionManager.getFounderAvailability()).rejects.toThrow(/unavailable/i);
  });

  it("handles HTML SPA fallback responses on VIP check and claim without SyntaxError or fake seat allocation", async () => {
    const htmlResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      text: async () => "<!doctype html><html><body>SnapFind</body></html>",
      json: async () => {
        throw new SyntaxError(`Unexpected token '<', "<!doctype..." is not valid JSON`);
      },
    } as unknown as Response;

    vi.spyOn(globalThis, "fetch").mockResolvedValue(htmlResponse);

    // VIP check must fail cleanly without surfacing Unexpected token '<' and without faking 0/50
    await expect(SubscriptionManager.getFounderAvailability()).rejects.toThrow(/temporarily unavailable/i);
    await expect(SubscriptionManager.getFounderAvailability()).rejects.not.toThrow(/Unexpected token/i);

    // VIP claim must fail cleanly without surfacing Unexpected token '<' and without allocating a seat in memory
    const claimRes = await SubscriptionManager.claimFounder("user-html-test");
    expect(claimRes.success).toBe(false);
    expect(claimRes.error).not.toMatch(/Unexpected token/i);
    expect(claimRes.error).toMatch(/unavailable/i);
    expect(SubscriptionManager.getUserEntitlements("user-html-test").isFounder).toBe(false);
  });
});
