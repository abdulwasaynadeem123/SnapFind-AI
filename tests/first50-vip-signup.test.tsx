import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VipSeatInvitationModal } from "../src/components/VipSeatInvitationModal";
import { NotificationCenter } from "../src/components/NotificationCenter";
import { NotificationPageView } from "../src/components/NotificationPageView";
import { AccountPageView } from "../src/components/AccountPageView";
import { NotificationService } from "../src/services/notificationService";
import { AppSettings, UserProfile, VipEligibilityInfo } from "../src/types";

const mockAuthState = {
  user: null as UserProfile | null,
  supabaseUser: null as any,
  session: null as any,
  entitlement: {
    userId: "user-1",
    plan: "free" as const,
    tier: "Free" as const,
    isPro: false,
    isFounder: false,
    founderNumber: null as number | null,
    founderRank: null as number | null,
    features: {
      maxIndexedScreenshots: 250,
      maxAIScansPerMonth: 250,
      maxStorageMB: 1000,
      cloudSync: false,
      advancedSearch: true,
      aiCollections: true,
      priorityProcessing: false,
    },
    maxScreenshots: 250,
    canCloudSync: false,
    canAiMultimodalSearch: false,
    priorityProcessing: false,
  },
  isPro: false,
  loading: false,
  isConfigured: true,
  isRecoveryMode: false,
  setIsRecoveryMode: vi.fn(),
  oauthErrorMessage: null as string | null,
  clearOauthError: vi.fn(),
  refreshEntitlement: vi.fn().mockResolvedValue(undefined),
  signInWithEmail: vi.fn().mockResolvedValue({}),
  signUpWithEmail: vi.fn().mockResolvedValue({}),
  resendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
  signInWithGoogle: vi.fn().mockResolvedValue({}),
  signOut: vi.fn().mockResolvedValue(undefined),
  signOutAllDevices: vi.fn().mockResolvedValue({}),
  reauthenticate: vi.fn().mockResolvedValue({}),
  updateName: vi.fn().mockResolvedValue({}),
  updateProfilePicture: vi.fn().mockResolvedValue({}),
  changeEmail: vi.fn().mockResolvedValue({}),
  changePassword: vi.fn().mockResolvedValue({}),
  resetPassword: vi.fn().mockResolvedValue({}),
  deleteAccount: vi.fn().mockResolvedValue({}),
};

const mockFounderState = {
  claimed: 10 as number | null,
  occupied: 10 as number | null,
  totalSpots: 50,
  remaining: 40 as number | null,
  isAvailable: true,
  isLive: true,
  isLoading: false,
  error: null as string | null,
  eligibility: null as VipEligibilityInfo | null,
  isEligibilityLoading: false,
  refreshFounderStats: vi.fn().mockResolvedValue(undefined),
  refreshEligibility: vi.fn().mockResolvedValue(null),
  deferVipOffer: vi.fn().mockResolvedValue({ success: true }),
  claimFounderSpot: vi.fn().mockResolvedValue({ success: true, founderNumber: 11 }),
};

vi.mock("../src/context/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

vi.mock("../src/context/FounderContext", () => ({
  useFounder: () => mockFounderState,
}));

vi.mock("../src/services/billing/ManualPaymentService", () => ({
  ManualPaymentService: {
    getMyPaymentRequests: vi.fn().mockResolvedValue([]),
  },
}));

const defaultSettings: AppSettings = {
  autoIndex: true,
  theme: "dark",
  notificationsEnabled: true,
  aiAnalysisEnabled: true,
  highAccuracyOcr: true,
  cloudSyncEnabled: false,
  autoTagging: true,
};

describe("First 50 Lifetime Free VIP UI & Persistent Reminder Flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    NotificationService.clearSessionNotificationsOnSignOut();

    mockAuthState.user = {
      id: "first50-ui-user",
      name: "Samira Khan",
      email: "samira@snapfind.app",
      emailVerified: true,
      isLoggedIn: true,
      plan: "Free",
      storageLimitMB: 1000,
    };

    mockFounderState.eligibility = {
      userId: "first50-ui-user",
      signupNumber: 5,
      vipEligible: true,
      vipClaimStatus: "pending",
      vipClaimedAt: null,
      vipOfferDeferredAt: null,
      founderNumber: null,
      isFounder: false,
      totalSlots: 50,
      assignedSlots: 12,
      claimedCount: 10,
      remainingSlots: 38,
      offerOpen: true,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders First-50 invitation copy, handles Maybe Later idempotent reminder creation, and restores reminder after sign-out/re-login", async () => {
    const userId = "first50-ui-user";
    const onMaybeLater = vi.fn(() => {
      NotificationService.notifyVipOfferWaiting(userId, { forceRecreate: true });
    });

    const { unmount } = render(
      <VipSeatInvitationModal
        isOpen={true}
        remainingSpots={40}
        totalSpots={50}
        isStatsLive={true}
        onClaim={mockFounderState.claimFounderSpot}
        onMaybeLater={onMaybeLater}
        onCloseAfterClaim={vi.fn()}
      />
    );

    expect(screen.getByText("You're One of the First 50!")).toBeInTheDocument();
    expect(
      screen.getByText("Claim Lifetime Free SnapFind Pro access. This exclusive offer is reserved for the first 50 accounts.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim Lifetime Free" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Maybe Later" }));
    expect(onMaybeLater).toHaveBeenCalledTimes(1);

    // Calling notifyVipOfferWaiting multiple times must remain idempotent (1 notification only)
    NotificationService.notifyVipOfferWaiting(userId);
    expect(NotificationService.getNotifications()).toHaveLength(1);
    unmount();

    // Simulate logout wiping local storage cache
    NotificationService.clearSessionNotificationsOnSignOut();
    localStorage.clear();
    expect(NotificationService.getNotifications()).toHaveLength(0);

    // Simulate re-login syncing persisted reminder from server /api/notifications
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        notifications: [
          {
            id: `vip_offer_waiting_${userId}`,
            user_id: userId,
            type: "SUBSCRIPTION",
            title: "Your Lifetime Free VIP Offer Is Waiting",
            message: "Your Lifetime Free VIP offer is waiting! Claim it anytime while your account remains eligible.",
            priority: "high",
            read: false,
            created_at: new Date().toISOString(),
            metadata: { eventType: "vip_offer_waiting", actionType: "open_vip_claim" },
          },
        ],
      }),
    } as any);

    await NotificationService.syncFromServer(userId, { isAlreadyVip: false });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const synced = NotificationService.getNotifications();
    expect(synced).toHaveLength(1);
    expect(synced[0].message).toContain("Your Lifetime Free VIP offer is waiting!");

    // Clicking the notification in NotificationCenter OR NotificationPageView opens the claim modal
    const onOpenVipClaim = vi.fn();
    const { unmount: unmountCenter } = render(
      <NotificationCenter
        notifications={synced}
        toasts={[]}
        isOpen={true}
        onClose={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        onMarkAsRead={vi.fn()}
        onDeleteNotification={vi.fn()}
        onClearAllNotifications={vi.fn()}
        isDark={true}
        onOpenVipClaim={onOpenVipClaim}
      />
    );

    const ctaCenter = screen.getByRole("button", { name: /Claim Lifetime Free/i });
    fireEvent.click(ctaCenter);
    expect(onOpenVipClaim).toHaveBeenCalledTimes(1);
    unmountCenter();

    render(
      <NotificationPageView
        notifications={synced}
        isDark={true}
        onMarkAllAsRead={vi.fn()}
        onMarkAsRead={vi.fn()}
        onDeleteNotification={vi.fn()}
        onClearAllNotifications={vi.fn()}
        onNavigate={vi.fn()}
        onOpenVipClaim={onOpenVipClaim}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Claim Lifetime Free/i }));
    expect(onOpenVipClaim).toHaveBeenCalledTimes(2);

    // Once claimed, waiting notification is automatically cleared
    NotificationService.clearVipOfferWaiting(userId);
    expect(NotificationService.getNotifications()).toHaveLength(0);
  });

  it("hides Claim Lifetime Free on Account page for 51st/ineligible Free accounts and existing paid Pro users", () => {
    mockFounderState.eligibility = {
      userId: "user-51",
      signupNumber: 51,
      vipEligible: false,
      vipClaimStatus: "not_eligible",
      vipClaimedAt: null,
      vipOfferDeferredAt: null,
      founderNumber: null,
      isFounder: false,
      totalSlots: 50,
      assignedSlots: 50,
      claimedCount: 35,
      remainingSlots: 0,
      offerOpen: false,
    };

    render(
      <AccountPageView
        user={mockAuthState.user!}
        isDark={true}
        indexedCount={12}
        settings={defaultSettings}
        onUpdateSettings={vi.fn()}
        addToast={vi.fn()}
        onOpenAuth={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.queryByText(/You're One of the First 50!/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Claim Lifetime Free/i })).not.toBeInTheDocument();
  });

  it("allows eligible deferred user to claim Lifetime Free directly from AccountPageView and displays VIP Member #N", async () => {
    mockFounderState.eligibility = {
      userId: "first50-ui-user",
      signupNumber: 11,
      vipEligible: true,
      vipClaimStatus: "pending",
      vipClaimedAt: null,
      vipOfferDeferredAt: new Date().toISOString(),
      founderNumber: null,
      isFounder: false,
      totalSlots: 50,
      assignedSlots: 20,
      claimedCount: 10,
      remainingSlots: 30,
      offerOpen: true,
    };
    mockFounderState.claimFounderSpot = vi.fn().mockResolvedValue({
      success: true,
      founderNumber: 11,
    });

    const addToast = vi.fn();
    render(
      <AccountPageView
        user={mockAuthState.user!}
        isDark={true}
        indexedCount={12}
        settings={defaultSettings}
        onUpdateSettings={vi.fn()}
        addToast={addToast}
        onOpenAuth={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    const claimBtn = screen.getByRole("button", { name: /Claim Lifetime Free/i });
    fireEvent.click(claimBtn);

    await waitFor(() => {
      expect(mockFounderState.claimFounderSpot).toHaveBeenCalledWith("first50-ui-user");
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Lifetime Free VIP Activated!",
          type: "success",
        })
      );
    });
  });
});
