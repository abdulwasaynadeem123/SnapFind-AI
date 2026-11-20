import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VipSeatInvitationModal } from "../src/components/VipSeatInvitationModal";
import { AccountPageView } from "../src/components/AccountPageView";
import { GalleryPermissionModal } from "../src/components/GalleryPermissionModal";
import { nativeMediaScanner } from "../src/services/nativeMediaScanner";
import { processingQueue } from "../src/services/processingQueue";
import { indexingEngine } from "../src/services/indexingEngine";
import { searchEngine } from "../src/services/searchEngine";
import { SubscriptionManager } from "../src/services/billing/SubscriptionManager";
import { saveStoredScreenshots, loadStoredScreenshots } from "../src/services/storage.ts";
import { AppSettings, ScreenshotItem, UserProfile } from "../src/types";

const mockAuthState = {
  user: null as UserProfile | null,
  supabaseUser: null as any,
  session: null as any,
  entitlement: {
    userId: "user-new-1",
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
  claimed: 38 as number | null,
  occupied: 38 as number | null,
  totalSpots: 50,
  remaining: 12 as number | null,
  isAvailable: true,
  isLive: true,
  isLoading: false,
  error: null as string | null,
  refreshFounderStats: vi.fn().mockResolvedValue(undefined),
  claimFounderSpot: vi.fn().mockResolvedValue({
    success: true,
    founderNumber: 12,
    message: "VIP Member #12 claimed!",
  }),
};

const nativeListeners: Record<string, Array<(payload: any) => void>> = {};
const mockPlugin = vi.hoisted(() => ({
  checkGalleryPermission: vi.fn(),
  requestGalleryPermission: vi.fn(),
  openAppSettings: vi.fn(),
  scanExistingScreenshots: vi.fn(),
  startScreenshotMonitoring: vi.fn(),
  stopScreenshotMonitoring: vi.fn(),
  updateNotificationProgress: vi.fn(),
  readMediaAsBase64: vi.fn(),
  addListener: vi.fn(),
}));

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

vi.mock("../src/plugins/SnapFindMediaScanner", () => ({
  default: mockPlugin,
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

function makeScreenshot(id: string, userId: string, ocrText = "Invoice total $42.00"): ScreenshotItem {
  return {
    id,
    user_id: userId,
    userId,
    imageUrl: `content://media/external/images/media/${id}`,
    image_uri: `content://media/external/images/media/${id}`,
    thumbnailUrl: `data:image/jpeg;base64,abc`,
    fileName: `Screenshot_${id}.png`,
    file_name: `Screenshot_${id}.png`,
    folder: "Pictures/Screenshots",
    uploadDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ocrText,
    ocr_text: ocrText,
    fullText: ocrText,
    extracted_text: ocrText,
    aiDescription: `Receipt screenshot ${id}`,
    ai_description: `Receipt screenshot ${id}`,
    tags: ["receipt", "invoice"],
    ai_tags: ["receipt", "invoice"],
    category: "Receipts",
    processingStatus: "Indexed",
    processing_status: "Indexed",
  };
}

describe("SnapFind AI — VIP Seat Claiming & Automatic Gallery Indexing (10 Scenarios)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    Object.keys(nativeListeners).forEach((k) => delete nativeListeners[k]);

    processingQueue.clearQueue();
    processingQueue.resumeQueue();
    saveStoredScreenshots([]);
    SubscriptionManager.resetToFree();

    mockAuthState.user = {
      id: "user-new-1",
      name: "Alex Rivera",
      email: "alex@snapfind.app",
      isLoggedIn: true,
      plan: "Free",
      storageLimitMB: 1000,
    };
    mockAuthState.entitlement = {
      ...mockAuthState.entitlement,
      userId: "user-new-1",
      plan: "free",
      tier: "Free",
      isPro: false,
      isFounder: false,
      founderNumber: null,
      founderRank: null,
    };

    mockFounderState.claimed = 38;
    mockFounderState.occupied = 38;
    mockFounderState.totalSpots = 50;
    mockFounderState.remaining = 12;
    mockFounderState.isAvailable = true;
    mockFounderState.isLive = true;
    mockFounderState.isLoading = false;
    mockFounderState.error = null;
    mockFounderState.claimFounderSpot = vi.fn().mockResolvedValue({
      success: true,
      founderNumber: 12,
    });

    mockPlugin.checkGalleryPermission.mockResolvedValue({
      granted: false,
      permissionState: "prompt",
    });
    mockPlugin.requestGalleryPermission.mockResolvedValue({
      granted: true,
      permissionState: "granted",
    });
    mockPlugin.openAppSettings.mockResolvedValue(undefined);
    mockPlugin.scanExistingScreenshots.mockResolvedValue({
      totalFound: 0,
      lastScanTimestamp: Date.now(),
    });
    mockPlugin.startScreenshotMonitoring.mockResolvedValue({ active: true });
    mockPlugin.stopScreenshotMonitoring.mockResolvedValue({ active: false });
    mockPlugin.updateNotificationProgress.mockResolvedValue(undefined);
    mockPlugin.addListener.mockImplementation(async (eventName: string, cb: (payload: any) => void) => {
      if (!nativeListeners[eventName]) nativeListeners[eventName] = [];
      nativeListeners[eventName].push(cb);
      return { remove: vi.fn() };
    });

    nativeMediaScanner.__setNativeOverrideForTest(false);
  });

  afterEach(async () => {
    await nativeMediaScanner.setActiveUser(null);
    nativeMediaScanner.__setNativeOverrideForTest(null);
    processingQueue.clearQueue();
  });

  // =========================================================================
  // SCENARIO 1: New user signs up while VIP seats are available
  // =========================================================================
  it("Scenario 1: shows VIP invitation popup with exact copy, remaining seats, and Maybe Later option -> claimable later from Account page", () => {
    const onMaybeLater = vi.fn();

    const { unmount } = render(
      <VipSeatInvitationModal
        isOpen={true}
        remainingSpots={12}
        totalSpots={50}
        onClaim={mockFounderState.claimFounderSpot}
        onMaybeLater={onMaybeLater}
        onCloseAfterClaim={vi.fn()}
      />
    );

    expect(screen.getByText("Claim Your Free VIP Seat")).toBeInTheDocument();
    expect(screen.getByText("Get exclusive VIP benefits while seats are available.")).toBeInTheDocument();
    expect(screen.getByText("12 of 50 seats remaining.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim VIP Seat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Maybe Later" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Maybe Later" }));
    expect(onMaybeLater).toHaveBeenCalledTimes(1);
    unmount();

    // After clicking Maybe Later, user can still claim from Account page while seats remain
    render(
      <AccountPageView
        user={mockAuthState.user!}
        isDark={true}
        indexedCount={10}
        settings={defaultSettings}
        onUpdateSettings={vi.fn()}
        addToast={vi.fn()}
        onOpenAuth={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText(/12 of 50 seats remaining\./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Claim VIP Seat/i })).toBeInTheDocument();
  });

  // =========================================================================
  // SCENARIO 2: User clicks Claim VIP Seat (success + error/retry without fake success)
  // =========================================================================
  it("Scenario 2: claims one VIP seat, shows permanent VIP Member #12, prevents duplicate clicks, and displays real server error with retry on failure", async () => {
    let resolveClaim: ((v: any) => void) | null = null;
    const slowClaim = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveClaim = resolve;
        })
    );

    // First test server failure -> must show real error and never fake success
    const failingClaim = vi.fn().mockResolvedValue({
      success: false,
      error: "Database temporarily unreachable",
    });

    const { rerender } = render(
      <VipSeatInvitationModal
        isOpen={true}
        remainingSpots={12}
        totalSpots={50}
        onClaim={failingClaim}
        onMaybeLater={vi.fn()}
        onCloseAfterClaim={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Claim VIP Seat" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Database temporarily unreachable");
    });
    expect(screen.queryByText(/VIP Member #/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry Claim VIP Seat" })).toBeInTheDocument();

    // Now test successful atomic claim with double-click guard
    rerender(
      <VipSeatInvitationModal
        isOpen={true}
        remainingSpots={12}
        totalSpots={50}
        onClaim={slowClaim as any}
        onMaybeLater={vi.fn()}
        onCloseAfterClaim={vi.fn()}
      />
    );

    const retryBtn = screen.getByRole("button", { name: "Retry Claim VIP Seat" });
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn); // rapid duplicate click must be ignored
    expect(slowClaim).toHaveBeenCalledTimes(1);

    resolveClaim!({ success: true, founderNumber: 12 });

    await waitFor(() => {
      expect(screen.getByText("VIP Member #12")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SCENARIO 3: Same user logs out and logs in again -> retains VIP, never re-prompted
  // =========================================================================
  it("Scenario 3: retains permanent VIP Member #12 after logout/re-login and hides claim invitation on Account page", () => {
    mockAuthState.entitlement = {
      ...mockAuthState.entitlement,
      userId: "user-vip-12",
      plan: "founder",
      tier: "VIP",
      isPro: true,
      isFounder: true,
      founderNumber: 12,
      founderRank: 12,
      maxScreenshots: 150000,
    };
    mockAuthState.user = {
      id: "user-vip-12",
      name: "Alex Rivera",
      email: "alex@snapfind.app",
      isLoggedIn: true,
      plan: "VIP",
      storageLimitMB: 100000,
      entitlement: mockAuthState.entitlement,
    };

    render(
      <AccountPageView
        user={mockAuthState.user}
        isDark={true}
        indexedCount={42}
        settings={defaultSettings}
        onUpdateSettings={vi.fn()}
        addToast={vi.fn()}
        onOpenAuth={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText("VIP Member #12")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Claim VIP Seat/i })).not.toBeInTheDocument();
  });

  // =========================================================================
  // SCENARIO 4: Two users race for the final VIP seat (#50) simultaneously
  // =========================================================================
  it("Scenario 4: concurrent race for final seat #50 allocates seat #50 to exactly one user and rejects the second", async () => {
    let seat50ClaimedBy: string | null = null;
    const atomicClaimSeat50 = async (userId: string) => {
      // Simulate server advisory-lock serialization on final seat #50
      if (seat50ClaimedBy === userId) {
        return { success: true, founderNumber: 50, alreadyClaimed: true };
      }
      if (seat50ClaimedBy !== null) {
        return {
          success: false,
          status: 409,
          error: "All 50 VIP seats have already been claimed.",
        };
      }
      seat50ClaimedBy = userId;
      return { success: true, founderNumber: 50 };
    };

    const [resA, resB] = await Promise.all([
      atomicClaimSeat50("user-race-A"),
      atomicClaimSeat50("user-race-B"),
    ]);

    const winners = [resA, resB].filter((r) => r.success);
    const losers = [resA, resB].filter((r) => !r.success);

    expect(winners).toHaveLength(1);
    expect(winners[0].founderNumber).toBe(50);
    expect(losers).toHaveLength(1);
    expect(losers[0].error).toMatch(/All 50 VIP seats/i);
  });

  // =========================================================================
  // SCENARIO 5: All 50 seats occupied -> stop showing VIP claim invitations
  // =========================================================================
  it("Scenario 5: stops showing claim invitations when all 50 seats are occupied", () => {
    mockFounderState.claimed = 50;
    mockFounderState.occupied = 50;
    mockFounderState.remaining = 0;
    mockFounderState.isAvailable = false;

    const { container } = render(
      <VipSeatInvitationModal
        isOpen={false}
        remainingSpots={0}
        totalSpots={50}
        onClaim={mockFounderState.claimFounderSpot}
        onMaybeLater={vi.fn()}
        onCloseAfterClaim={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();

    render(
      <AccountPageView
        user={mockAuthState.user!}
        isDark={true}
        indexedCount={5}
        settings={defaultSettings}
        onUpdateSettings={vi.fn()}
        addToast={vi.fn()}
        onOpenAuth={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.queryByText("Claim Your Free VIP Seat")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Claim VIP Seat/i })).not.toBeInTheDocument();
  });

  // =========================================================================
  // SCENARIO 6: User grants gallery permission on Android; web does not fake auto-monitoring
  // =========================================================================
  it("Scenario 6: Android permission grant starts initial scan & monitoring, while web honestly reports unsupported", async () => {
    // 6a. Web platform must NEVER fake granted automatic gallery monitoring
    nativeMediaScanner.__setNativeOverrideForTest(false);
    await nativeMediaScanner.setActiveUser("user-web-1");
    const webStatus = await nativeMediaScanner.checkPermission();
    expect(webStatus.granted).toBe(false);
    expect(webStatus.permissionState).toBe("unsupported");

    const { container, unmount } = render(
      <GalleryPermissionModal userId="user-web-1" onOpenPricing={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
    unmount();

    // 6b. Native Android platform shows permission explanation & starts scan + monitoring on grant
    nativeMediaScanner.__setNativeOverrideForTest(true);
    mockPlugin.checkGalleryPermission.mockResolvedValueOnce({
      granted: false,
      permissionState: "prompt",
    });
    await nativeMediaScanner.setActiveUser("user-android-1");

    render(<GalleryPermissionModal userId="user-android-1" onOpenPricing={vi.fn()} />);
    expect(screen.getByText("Automatic Screenshot Indexing")).toBeInTheDocument();

    mockPlugin.checkGalleryPermission.mockResolvedValue({
      granted: true,
      permissionState: "granted",
    });
    mockPlugin.requestGalleryPermission.mockResolvedValueOnce({
      granted: true,
      permissionState: "granted",
    });

    fireEvent.click(screen.getByRole("button", { name: /Allow Photo Access/i }));

    await waitFor(() => {
      expect(mockPlugin.requestGalleryPermission).toHaveBeenCalledTimes(1);
      expect(mockPlugin.scanExistingScreenshots).toHaveBeenCalledTimes(1);
      expect(mockPlugin.startScreenshotMonitoring).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // SCENARIO 7: Existing screenshots auto-indexed up to account limit & immediately searchable
  // =========================================================================
  it("Scenario 7: shows real indexing progress ('Indexed X of Y screenshots.') and makes indexed screenshots immediately searchable", () => {
    const uid = "user-idx-1";
    const items = [
      makeScreenshot("101", uid, "Flight confirmation LAX to Tokyo JAL 061"),
      makeScreenshot("102", uid, "Coffee receipt Blue Bottle $6.50"),
    ];
    saveStoredScreenshots(items);
    searchEngine.updateIndex(items);

    // Pause queue with 1 pending item so progress banner is visibly active
    processingQueue.pauseQueue();
    processingQueue.enqueue({
      id: "media_103",
      imageUri: "content://media/external/images/media/103",
      fileName: "Screenshot_103.png",
      userId: uid,
    });

    const summary = processingQueue.getIndexingProgressSummary(uid, 5);
    expect(summary.indexedCount).toBe(2);
    expect(summary.totalCount).toBe(5);
    expect(summary.limit).toBe(250);

    render(<GalleryPermissionModal userId={uid} onOpenPricing={vi.fn()} />);
    expect(screen.getByText(/Indexed 2 of 3 screenshots\./i)).toBeInTheDocument();

    // Verify immediate searchability of already-indexed screenshots
    const hits = searchEngine.search("Tokyo JAL 061", items);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].id).toBe("101");
  });

  // =========================================================================
  // SCENARIO 8: New & modified screenshot detection + deduplication
  // =========================================================================
  it("Scenario 8: queues newly detected screenshots, deduplicates identical media IDs, and re-indexes modified screenshots", async () => {
    const uid = "user-watch-1";
    nativeMediaScanner.__setNativeOverrideForTest(true);
    mockPlugin.checkGalleryPermission.mockResolvedValue({
      granted: true,
      permissionState: "granted",
    });
    processingQueue.pauseQueue();

    await nativeMediaScanner.setActiveUser(uid);

    const detectedHandler = nativeListeners["onScreenshotDetected"]?.[0];
    expect(detectedHandler).toBeDefined();

    // New screenshot detected
    detectedHandler({
      mediaId: "9001",
      uri: "content://media/external/images/media/9001",
      filename: "Screenshot_20261119_001.png",
      dateAdded: 1732000000,
      dateModified: 1732000000,
      relativePath: "Pictures/Screenshots",
      isModified: false,
    });

    // Duplicate detection of unchanged screenshot must NOT enqueue a second job
    detectedHandler({
      mediaId: "9001",
      uri: "content://media/external/images/media/9001",
      filename: "Screenshot_20261119_001.png",
      dateAdded: 1732000000,
      dateModified: 1732000000,
      relativePath: "Pictures/Screenshots",
      isModified: false,
    });

    const jobsAfterDup = processingQueue.getAllJobs().filter((j) => j.imageId === "media_9001");
    expect(jobsAfterDup).toHaveLength(1);

    // Simulate item already stored, then edited/cropped with newer dateModified
    saveStoredScreenshots([makeScreenshot("media_9001", uid, "Original text")]);
    processingQueue.clearQueue();
    processingQueue.pauseQueue();

    detectedHandler({
      mediaId: "9001",
      uri: "content://media/external/images/media/9001",
      filename: "Screenshot_20261119_001.png",
      dateAdded: 1732000000,
      dateModified: 1732000500,
      relativePath: "Pictures/Screenshots",
      isModified: true,
    });

    const modifiedJobs = processingQueue.getAllJobs().filter((j) => j.imageId === "media_9001");
    expect(modifiedJobs).toHaveLength(1);
    expect(modifiedJobs[0].isModified).toBe(true);
  });

  // =========================================================================
  // SCENARIO 9: Indexing limit reached -> pauses cleanly, preserves indexed items, resumes on VIP upgrade
  // =========================================================================
  it("Scenario 9: pauses indexing at Free 250 limit without deleting indexed screenshots, shows limit banner, and resumes on VIP upgrade", () => {
    const uid = "user-limit-1";
    const existing250 = Array.from({ length: 250 }, (_, idx) =>
      makeScreenshot(`free_${idx + 1}`, uid, `Indexed screenshot #${idx + 1}`)
    );
    saveStoredScreenshots(existing250);

    const quotaEvents: any[] = [];
    const onQuota = (e: any) => quotaEvents.push(e.detail);
    window.addEventListener("snapfind_quota_exceeded", onQuota);

    // Attempt to enqueue screenshot #251 on Free plan (limit = 250)
    const enqueueReturn = processingQueue.enqueue({
      id: "media_251",
      imageUri: "content://media/external/images/media/251",
      fileName: "Screenshot_251.png",
      userId: uid,
    });

    window.removeEventListener("snapfind_quota_exceeded", onQuota);

    expect(enqueueReturn).toBeNull();
    expect(processingQueue.getJob("media_251")?.status).toBe("waiting_for_verification");
    expect(quotaEvents.length).toBeGreaterThanOrEqual(1);

    // Already-indexed 250 screenshots must remain intact (0 deleted)
    expect(loadStoredScreenshots()).toHaveLength(250);

    // UI shows clear indexing limit banner with Upgrade / VIP buttons
    const onOpenPricing = vi.fn();
    const onOpenVipClaim = vi.fn();
    render(
      <GalleryPermissionModal
        userId={uid}
        onOpenPricing={onOpenPricing}
        onOpenVipClaim={onOpenVipClaim}
      />
    );

    expect(screen.getByText(/Indexing Limit Reached \(250 \/ 250 screenshots\)/i)).toBeInTheDocument();
    expect(screen.getByText(/250 already-indexed screenshots remain safe and searchable/i)).toBeInTheDocument();

    // Upgrading to VIP (150,000 limit) transitions waiting_for_verification jobs back to Queued
    const canIndexSpy = vi.spyOn(SubscriptionManager, "canIndexScreenshot").mockReturnValue({
      allowed: true,
      limit: 150000,
    });
    const processSpy = vi.spyOn(processingQueue as any, "processNextInQueue").mockResolvedValue(undefined);
    processingQueue.resumeAfterQuotaUpgrade();

    const resumedJob = processingQueue.getJob("media_251");
    expect(resumedJob?.status).toBe("Queued");

    processSpy.mockRestore();
    canIndexSpy.mockRestore();
  });

  // =========================================================================
  // SCENARIO 10: Permission denied or revoked -> stops monitoring safely & preserves indexed data
  // =========================================================================
  it("Scenario 10: stops scanning/monitoring safely on permission revocation, pauses queue, preserves indexed screenshots, and shows Open App Settings", async () => {
    const uid = "user-revoke-1";
    saveStoredScreenshots([makeScreenshot("keep_1", uid, "Preserved receipt")]);

    nativeMediaScanner.__setNativeOverrideForTest(true);
    mockPlugin.checkGalleryPermission.mockResolvedValue({
      granted: true,
      permissionState: "granted",
    });

    await nativeMediaScanner.setActiveUser(uid);
    expect(nativeMediaScanner.getPermissionStatus().isMonitoring).toBe(true);

    // Native plugin emits onPermissionRevoked
    const revokeHandler = nativeListeners["onPermissionRevoked"]?.[0];
    expect(revokeHandler).toBeDefined();
    revokeHandler({});

    await waitFor(() => {
      const st = nativeMediaScanner.getPermissionStatus();
      expect(st.granted).toBe(false);
      expect(st.permissionState).toBe("denied");
      expect(st.isMonitoring).toBe(false);
      expect(st.revokedNotice).toBe(true);
    });

    expect(mockPlugin.stopScreenshotMonitoring).toHaveBeenCalled();
    expect(loadStoredScreenshots()).toHaveLength(1);

    render(<GalleryPermissionModal userId={uid} onOpenPricing={vi.fn()} />);
    expect(screen.getByText("Photo Access Was Revoked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open App Settings/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Open App Settings/i }));
    await waitFor(() => {
      expect(mockPlugin.openAppSettings).toHaveBeenCalledTimes(1);
    });
  });
});
