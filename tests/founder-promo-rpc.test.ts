import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRpc = vi.fn();

vi.mock("../src/services/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

import { SubscriptionManager } from "../src/services/billing/SubscriptionManager";

describe("First-50 Lifetime Free Supabase RPC integration", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("reads eligibility using the RPC actually created by the SQL migration", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{
        user_id: "user-1",
        signup_number: 7,
        vip_eligible: true,
        vip_claim_status: "pending",
        vip_claimed_at: null,
        vip_offer_deferred_at: null,
        founder_number: null,
        is_founder: false,
        total_spots: 50,
        assigned_slots: 7,
        occupied_spots: 2,
        remaining_spots: 43,
      }],
      error: null,
    });

    const status = await SubscriptionManager.getFounderPromoStatus();

    expect(mockRpc).toHaveBeenCalledWith("get_my_vip_eligibility");
    expect(status).toEqual({
      eligible: true,
      signupNumber: 7,
      dismissed: false,
      claimed: false,
      founderRank: null,
      signupCount: 7,
      remainingSignups: 43,
    });
  });

  it("persists Maybe Later through the migration's defer RPC", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{
        success: true,
        vip_eligible: true,
        vip_claim_status: "pending",
        vip_offer_deferred_at: "2026-11-24T10:00:00.000Z",
        message: "Your offer remains reserved.",
      }],
      error: null,
    });

    await expect(SubscriptionManager.dismissFounderPromo()).resolves.toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("defer_vip_offer_for_user");
  });

  it("does not report a successful deferral when the RPC rejects the request", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ success: false, message: "Account is not eligible." }],
      error: null,
    });

    await expect(SubscriptionManager.dismissFounderPromo()).resolves.toBe(false);
  });
});
