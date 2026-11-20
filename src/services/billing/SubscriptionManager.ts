import {
  UserEntitlement,
  SubscriptionTier,
  SubscriptionRecord,
  GooglePlayProduct,
  BillingProduct,
  PlanFeatureLimits,
  FeatureKey,
  PlanType,
} from "../../types";
import { PLAY_STORE_SKUS } from "./googlePlayBillingPlugin";
import { PaymentService } from "./PaymentService";
import { PLAN_CONFIG, PLAN_LIMITS, FOUNDER_BENEFIT_CONFIG } from "./entitlementConfig";
import { supabase, isSupabaseConfigured, getAuthBearerHeader } from "../supabase";
import { NotificationService } from "../notificationService";

export { PLAN_CONFIG, PLAN_LIMITS, FOUNDER_BENEFIT_CONFIG, PLAY_STORE_SKUS };

const STORAGE_KEYS = {
  USER_ENTITLEMENT: "snapfind_user_entitlement_v2",
  OFFLINE_GRACE_TIMESTAMP: "snapfind_entitlement_last_verified",
  FOUNDER_STATUS: "snapfind_founder_status_v1",
};

export interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  isExceeded: boolean;
  tier: SubscriptionTier;
  plan: PlanType;
  isPro: boolean;
  isFounder: boolean;
}

export interface FeatureGateCheck {
  allowed: boolean;
  limit?: number;
  used?: number;
  remaining?: number;
  reason?: string;
  upgradePromptTitle?: string;
  upgradePromptMessage?: string;
}

type EntitlementListener = (entitlement: UserEntitlement) => void;

function createDefaultFreeEntitlement(userId: string = "guest"): UserEntitlement {
  return {
    userId,
    tier: "Free",
    plan: "free",
    isPro: false,
    isFounder: false,
    founderNumber: null,
    founderGrantedAt: null,
    founderExpiresAt: null,
    features: { ...PLAN_CONFIG.free.features },
    maxScreenshots: PLAN_CONFIG.free.features.maxIndexedScreenshots,
    canCloudSync: PLAN_CONFIG.free.features.cloudSync,
    canAiMultimodalSearch: PLAN_CONFIG.free.features.advancedSearch,
    priorityProcessing: PLAN_CONFIG.free.features.priorityProcessing,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Safely parse an HTTP response as JSON.
 * Prevents SyntaxError ("Unexpected token '<', '<!doctype...' is not valid JSON")
 * whenever a static SPA host, proxy, or WebView serves HTML instead of JSON.
 */
async function readJsonResponse(res: Response): Promise<{ isJson: boolean; data: any }> {
  const contentType = res.headers?.get?.("content-type") || "";
  if (contentType && !/application\/json|\+json/i.test(contentType)) {
    return { isJson: false, data: null };
  }

  if (typeof res.text === "function") {
    try {
      const raw = await res.text();
      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith("<")) {
        return { isJson: false, data: null };
      }
      return { isJson: true, data: JSON.parse(trimmed) };
    } catch {
      return { isJson: false, data: null };
    }
  }

  if (typeof res.json === "function") {
    try {
      const data = await res.json();
      return { isJson: true, data };
    } catch {
      return { isJson: false, data: null };
    }
  }

  return { isJson: false, data: null };
}

class SubscriptionManagerService {
  private currentEntitlement: UserEntitlement = createDefaultFreeEntitlement();
  private listeners: Set<EntitlementListener> = new Set();
  private userEntitlementsCache: Map<string, UserEntitlement> = new Map();

  constructor() {
    this.loadCachedEntitlement();
  }

  /**
   * Load cached entitlement from storage with expiration sanity checks
   */
  private loadCachedEntitlement(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USER_ENTITLEMENT);
      if (stored) {
        const parsed: UserEntitlement = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          // Check if subscription or founder benefit has expired
          const now = Date.now();
          if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < now) {
            parsed.isPro = false;
            parsed.tier = "Free";
            parsed.plan = "free";
            parsed.features = { ...PLAN_CONFIG.free.features };
            parsed.maxScreenshots = PLAN_CONFIG.free.features.maxIndexedScreenshots;
            parsed.canCloudSync = false;
            parsed.status = "expired";
          }
          if (parsed.founderExpiresAt && new Date(parsed.founderExpiresAt).getTime() < now) {
            parsed.isFounder = false;
            if (parsed.plan === "founder") {
              parsed.isPro = false;
              parsed.tier = "Free";
              parsed.plan = "free";
              parsed.features = { ...PLAN_CONFIG.free.features };
            }
          }
          this.currentEntitlement = parsed;
          if (parsed.userId) {
            this.userEntitlementsCache.set(parsed.userId, parsed);
          }
        }
      }
    } catch (err) {
      console.warn("[SubscriptionManager] Failed to load cached entitlement:", err);
    }
  }

  /**
   * Persist current entitlement to cache
   */
  private saveCachedEntitlement(entitlement: UserEntitlement): void {
    this.currentEntitlement = entitlement;
    if (entitlement.userId) {
      this.userEntitlementsCache.set(entitlement.userId, entitlement);
    }
    try {
      localStorage.setItem(STORAGE_KEYS.USER_ENTITLEMENT, JSON.stringify(entitlement));
      localStorage.setItem(STORAGE_KEYS.OFFLINE_GRACE_TIMESTAMP, Date.now().toString());
    } catch {}

    // Notify all active listeners (React components, UI, background workers)
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => {
      try {
        cb(this.currentEntitlement);
      } catch (err) {
        console.error("[SubscriptionManager] Listener error:", err);
      }
    });
  }

  /**
   * Subscribe to entitlement updates
   */
  public subscribe(callback: EntitlementListener): () => void {
    this.listeners.add(callback);
    callback(this.currentEntitlement);
    return () => {
      this.listeners.delete(callback);
    };
  }

  // ==============================================================================
  // CONCEPTUAL AUTHORITATIVE API REQUIRED BY PRODUCT ARCHITECTURE
  // ==============================================================================

  /**
   * getUserEntitlements(userId): Returns full UserEntitlement object for user
   */
  public getUserEntitlements(userId?: string): UserEntitlement {
    if (userId && this.userEntitlementsCache.has(userId)) {
      return this.userEntitlementsCache.get(userId)!;
    }
    if (userId && this.currentEntitlement.userId && this.currentEntitlement.userId !== userId) {
      return createDefaultFreeEntitlement(userId);
    }
    return this.currentEntitlement;
  }

  /**
   * getEntitlement(): Backwards-compatible getter for current user entitlement
   */
  public getEntitlement(): UserEntitlement {
    return this.currentEntitlement;
  }

  /**
   * hasFeature(userId, feature): Boolean check if user is entitled to a specific feature key
   */
  public hasFeature(userId?: string, feature?: FeatureKey): boolean {
    if (!feature) return true;
    const ent = this.getUserEntitlements(userId);
    const featureVal = ent.features?.[feature];
    if (typeof featureVal === "boolean") {
      return featureVal;
    }
    if (typeof featureVal === "number") {
      return featureVal > 0;
    }
    return Boolean(ent.isPro || ent.isFounder);
  }

  /**
   * isPro(userId): Returns true if user has active Pro or Founder tier
   */
  public isPro(userId?: string): boolean {
    const ent = this.getUserEntitlements(userId);
    return Boolean(ent.isPro || ent.isFounder);
  }

  /**
   * isFounder(userId): Returns true if user is an official Founder 100 pioneer
   */
  public isFounder(userId?: string): boolean {
    const ent = this.getUserEntitlements(userId);
    return Boolean(ent.isFounder);
  }

  /**
   * getFounderNumber(userId): Returns the assigned founder number (e.g. 1 to 100) or null
   */
  public getFounderNumber(userId?: string): number | null {
    const ent = this.getUserEntitlements(userId);
    return ent.founderNumber || null;
  }

  /**
   * getCurrentPlan(userId): Returns "free" | "pro" | "founder"
   */
  public getCurrentPlan(userId?: string): PlanType {
    const ent = this.getUserEntitlements(userId);
    return ent.plan || "free";
  }

  /**
   * getTier(): Returns display subscription tier "Free" | "Pro" | "Founder"
   */
  public getTier(userId?: string): SubscriptionTier {
    const ent = this.getUserEntitlements(userId);
    return ent.tier || "Free";
  }

  /**
   * Get maximum indexed screenshot limit for current tier
   */
  public getMaxScreenshotLimit(userId?: string): number {
    const ent = this.getUserEntitlements(userId);
    return ent.features?.maxIndexedScreenshots || (this.isPro(userId) ? PLAN_LIMITS.PRO_MAX_SCREENSHOTS : PLAN_LIMITS.FREE_MAX_SCREENSHOTS);
  }

  /**
   * Calculate Screenshot Quota Status
   */
  public getQuota(currentIndexedCount: number, userId?: string): QuotaStatus {
    const ent = this.getUserEntitlements(userId);
    const limit = this.getMaxScreenshotLimit(userId);
    const used = Math.max(0, currentIndexedCount);
    const remaining = Math.max(0, limit - used);
    const percentage = Math.min(100, Math.round((used / limit) * 100));
    const isExceeded = used >= limit;

    return {
      used,
      limit,
      remaining,
      percentage,
      isExceeded,
      tier: ent.tier,
      plan: ent.plan,
      isPro: ent.isPro,
      isFounder: ent.isFounder,
    };
  }

  /**
   * Feature Gate: Can user index another screenshot?
   */
  public canIndexScreenshot(currentTotalCount: number, userId?: string): FeatureGateCheck {
    const quota = this.getQuota(currentTotalCount, userId);
    if (!quota.isExceeded) {
      return {
        allowed: true,
        limit: quota.limit,
        used: quota.used,
        remaining: quota.remaining,
      };
    }

    return {
      allowed: false,
      limit: quota.limit,
      used: quota.used,
      remaining: 0,
      reason: `Plan limit of ${quota.limit} AI-indexed screenshots reached.`,
      upgradePromptTitle: "Your indexing limit has been reached.",
      upgradePromptMessage: `Your indexing limit has been reached (${quota.used} / ${quota.limit} AI-indexed screenshots used). Upgrade to Monthly, Annual, or claim an available free VIP Seat.`,
    };
  }

  /**
   * Feature Gate: Can user perform AI Vision scans this month?
   */
  public canPerformAIScan(currentMonthScans: number = 0, userId?: string): FeatureGateCheck {
    const ent = this.getUserEntitlements(userId);
    const limit = ent.features?.maxAIScansPerMonth || (this.isPro(userId) ? PLAN_LIMITS.PRO_AI_SCANS_MONTHLY : PLAN_LIMITS.FREE_AI_SCANS_MONTHLY);
    
    if (currentMonthScans < limit) {
      return {
        allowed: true,
        limit,
        used: currentMonthScans,
        remaining: limit - currentMonthScans,
      };
    }

    return {
      allowed: false,
      limit,
      used: currentMonthScans,
      remaining: 0,
      reason: `Monthly AI scan limit of ${limit} reached.`,
      upgradePromptTitle: "Monthly AI Vision Limit Reached",
      upgradePromptMessage: `You have completed ${currentMonthScans} / ${limit} AI scans this month. Upgrade to unlock higher monthly AI scan limits.`,
    };
  }

  /**
   * Feature Gate: Can user use encrypted cloud backup and Supabase sync?
   */
  public canUseCloudSync(userId?: string): FeatureGateCheck {
    if (this.hasFeature(userId, "cloudSync") || this.isPro(userId)) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: "Cloud synchronization is a SnapFind Pro feature.",
      upgradePromptTitle: "Unlock Cloud Backup & Sync",
      upgradePromptMessage: "Cloud Sync keeps your screenshots, smart search index, and tags backed up and synced across your devices. Upgrade to Pro (starting at PKR 249/month) to enable cloud synchronization.",
    };
  }

  /**
   * Feature Gate: Can user use advanced natural language search?
   */
  public canUseAdvancedSearch(userId?: string): FeatureGateCheck {
    if (this.hasFeature(userId, "advancedSearch") || this.isPro(userId)) {
      return { allowed: true };
    }

    return {
      allowed: true, // Free has basic keyword/OCR search + simple AI, Pro has full multimodal search
    };
  }

  /**
   * Feature Gate: Can user use auto-generated AI Collections?
   */
  public canUseAiCollections(userId?: string): FeatureGateCheck {
    if (this.hasFeature(userId, "aiCollections") || this.isPro(userId)) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: "AI Collections auto-grouping requires SnapFind Pro.",
      upgradePromptTitle: "Unlock AI Smart Collections",
      upgradePromptMessage: "SnapFind Pro automatically organizes receipts, flight passes, design inspiration, and code snippets into dynamic AI Collections.",
    };
  }

  /**
   * Feature Gate: Priority Background Ingestion & Fast OCR
   */
  public hasPriorityProcessing(userId?: string): boolean {
    return Boolean(this.hasFeature(userId, "priorityProcessing") || this.isPro(userId));
  }

  /**
   * Authoritative Server Sync: Fetch latest entitlement from Supabase backend / Server API
   */
  public async syncEntitlementsFromServer(userId?: string): Promise<UserEntitlement> {
    const targetUserId = userId || this.currentEntitlement.userId || "guest";
    if (!targetUserId || targetUserId === "guest" || targetUserId.startsWith("local-")) {
      const guestEnt = createDefaultFreeEntitlement("guest");
      this.saveCachedEntitlement(guestEnt);
      return guestEnt;
    }

    let apiEntitlement: UserEntitlement | null = null;
    let dbFounderRank = 0;
    let dbFounderGrantedAt: string | null = null;
    let dbEntRow: any = null;

    try {
      const authHeaders = await getAuthBearerHeader().catch(() => ({}));
      const serverFetchPromise = fetch("/api/billing/entitlements", {
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": targetUserId,
          ...authHeaders,
        },
      })
        .then(async (res) => {
          if (!res.ok) return null;
          const parsed = await readJsonResponse(res);
          if (!parsed.isJson || !parsed.data) return null;
          return parsed.data?.success && parsed.data?.entitlement
            ? (parsed.data.entitlement as UserEntitlement)
            : null;
        })
        .catch(() => null);

      const dbClaimPromise =
        isSupabaseConfigured && supabase
          ? supabase
              .from("founder_claims")
              .select("user_id, founder_rank, claimed_at, status")
              .eq("user_id", targetUserId)
              .eq("status", "claimed")
              .maybeSingle()
              .then((r) => (!r.error && r.data ? r.data : null), () => null)
          : Promise.resolve(null);

      const dbEntPromise =
        isSupabaseConfigured && supabase
          ? supabase
              .from("user_entitlements")
              .select("*")
              .eq("user_id", targetUserId)
              .maybeSingle()
              .then((r) => (!r.error && r.data ? r.data : null), () => null)
          : Promise.resolve(null);

      const [fetchedApi, claimRow, entRow] = await Promise.all([
        serverFetchPromise,
        dbClaimPromise,
        dbEntPromise,
      ]);

      apiEntitlement = fetchedApi;
      dbEntRow = entRow;

      const claimRank = Number(claimRow?.founder_rank || 0);
      const entRank = Number(entRow?.founder_number || 0);
      if (claimRank >= 1 && claimRank <= 50) {
        dbFounderRank = claimRank;
        dbFounderGrantedAt = claimRow?.claimed_at || entRow?.founder_granted_at || null;
      } else if (entRow?.is_founder && entRank >= 1 && entRank <= 50) {
        dbFounderRank = entRank;
        dbFounderGrantedAt = entRow?.founder_granted_at || null;
      }

      // 1. Verified VIP seat from any authoritative DB/server source always takes precedence
      //    so a stale Free row in user_entitlements can never hide a claimed VIP seat.
      const apiRank = Number(apiEntitlement?.founderNumber || 0);
      if (dbFounderRank >= 1 && dbFounderRank <= 50) {
        const vipEnt: UserEntitlement = {
          userId: targetUserId,
          plan: "founder",
          tier: "Founder",
          isPro: true,
          isFounder: true,
          founderNumber: dbFounderRank,
          founderGrantedAt: dbFounderGrantedAt || apiEntitlement?.founderGrantedAt || new Date().toISOString(),
          founderExpiresAt: null,
          features: { ...PLAN_CONFIG.founder.features },
          maxScreenshots: PLAN_CONFIG.founder.features.maxIndexedScreenshots,
          canCloudSync: true,
          canAiMultimodalSearch: true,
          priorityProcessing: true,
          status: "active",
          updatedAt: new Date().toISOString(),
        };
        this.saveCachedEntitlement(vipEnt);
        return vipEnt;
      }

      if (apiEntitlement && apiEntitlement.isFounder && apiRank >= 1 && apiRank <= 50) {
        const verifiedApiEnt = { ...apiEntitlement, userId: targetUserId };
        this.saveCachedEntitlement(verifiedApiEnt);
        return verifiedApiEnt;
      }

      // 2. Otherwise use authoritative server entitlement if available
      if (apiEntitlement && (!apiEntitlement.userId || apiEntitlement.userId === targetUserId)) {
        const normalized = { ...apiEntitlement, userId: targetUserId };
        this.saveCachedEntitlement(normalized);
        return normalized;
      }

      // 3. Otherwise use user_entitlements row from Supabase
      if (dbEntRow) {
        const isPro = Boolean(dbEntRow.is_pro);
        const rawPlan = String(dbEntRow.plan || "").toLowerCase();
        const plan: PlanType =
          rawPlan === "monthly" || rawPlan === "yearly" || rawPlan === "lifetime"
            ? (rawPlan as PlanType)
            : isPro
            ? "pro"
            : "free";
        const tier: SubscriptionTier = isPro ? "Pro" : "Free";
        const features: PlanFeatureLimits = dbEntRow.features || PLAN_CONFIG[plan].features;

        const entitlement: UserEntitlement = {
          userId: dbEntRow.user_id,
          plan,
          tier,
          isPro,
          isFounder: false,
          founderNumber: null,
          founderGrantedAt: null,
          founderExpiresAt: null,
          features,
          maxScreenshots: features.maxIndexedScreenshots || (isPro ? PLAN_LIMITS.PRO_MAX_SCREENSHOTS : PLAN_LIMITS.FREE_MAX_SCREENSHOTS),
          canCloudSync: features.cloudSync,
          canAiMultimodalSearch: features.advancedSearch,
          priorityProcessing: features.priorityProcessing,
          expiresAt: dbEntRow.expires_at,
          activeSubscriptionId: dbEntRow.active_subscription_id,
          updatedAt: dbEntRow.updated_at || new Date().toISOString(),
        };

        this.saveCachedEntitlement(entitlement);
        return entitlement;
      }
    } catch (err) {
      console.warn("[SubscriptionManager] Server sync failed, relying on user cache:", err);
    }

    // Only reuse cached entitlement if it belongs to this exact authenticated userId
    if (this.userEntitlementsCache.has(targetUserId)) {
      const cached = this.userEntitlementsCache.get(targetUserId)!;
      this.currentEntitlement = cached;
      this.notifyListeners();
      return cached;
    }
    if (this.currentEntitlement.userId === targetUserId) {
      return this.currentEntitlement;
    }

    const fallbackFree = createDefaultFreeEntitlement(targetUserId);
    this.saveCachedEntitlement(fallbackFree);
    return fallbackFree;
  }

  /**
   * Execute Purchase Flow via PaymentService abstraction and Verify on Server
   */
  public async purchaseSubscription(
    productId: string,
    userId?: string
  ): Promise<{ success: boolean; entitlement?: UserEntitlement; error?: string }> {
    try {
      const targetUserId = userId || this.currentEntitlement.userId || "guest";
      const result = await PaymentService.purchaseSubscription(productId, targetUserId);

      if (result.success && result.entitlement) {
        this.saveCachedEntitlement(result.entitlement);
        const cycle = productId.includes("annual") ? "annual" : "monthly";
        NotificationService.notifyProActivated(cycle, result.entitlement.isFounder);
        return {
          success: true,
          entitlement: result.entitlement,
        };
      }

      return {
        success: false,
        error: result.error || "Purchase was not completed.",
      };
    } catch (err: any) {
      console.error("[SubscriptionManager] Purchase error:", err);
      return {
        success: false,
        error: err.message || "Failed to complete purchase.",
      };
    }
  }

  /**
   * Restore Purchases Flow via PaymentService
   */
  public async restorePurchases(
    userId?: string
  ): Promise<{ success: boolean; restoredCount: number; entitlement?: UserEntitlement; message: string }> {
    try {
      const targetUserId = userId || this.currentEntitlement.userId || "guest";
      const result = await PaymentService.restorePurchases(targetUserId);

      if (result.success && result.entitlement) {
        this.saveCachedEntitlement(result.entitlement);
        NotificationService.notifyPurchasesRestored(result.restoredCount);
        return {
          success: true,
          restoredCount: result.restoredCount,
          entitlement: result.entitlement,
          message: result.message,
        };
      }

      return {
        success: false,
        restoredCount: 0,
        message: result.message || "No active subscription found for this account.",
      };
    } catch (err: any) {
      console.error("[SubscriptionManager] Restore error:", err);
      return {
        success: false,
        restoredCount: 0,
        message: err.message || "Error restoring purchases.",
      };
    }
  }

  /**
   * Cancel Subscription auto-renewal
   */
  public async cancelSubscription(
    subscriptionId?: string,
    userId?: string
  ): Promise<{ success: boolean; message: string }> {
    const targetUserId = userId || this.currentEntitlement.userId || "guest";
    const subId = subscriptionId || this.currentEntitlement.activeSubscriptionId || "";
    const res = await PaymentService.cancelSubscription(subId, targetUserId);
    if (res.success) {
      NotificationService.notifySubscriptionCanceled();
    }
    return res;
  }

  /**
   * Open Platform Customer Portal or Google Play Management
   */
  public async openCustomerPortal(subscriptionId?: string): Promise<void> {
    const subId = subscriptionId || this.currentEntitlement.activeSubscriptionId;
    await PaymentService.openCustomerPortal(subId);
  }

  /**
   * Claim Founder 50 Spot (Complimentary Lifetime Free + Crown Tag)
   */
  public async claimFounder(
    userId?: string
  ): Promise<{ success: boolean; entitlement?: UserEntitlement; founderNumber?: number; message?: string; error?: string }> {
    return { success: false, error: "VIP seats have been temporarily discontinued." };
    const targetUserId = userId || this.currentEntitlement.userId || "guest";
    let networkUnreachable = false;

    try {
      const authHeaders = await getAuthBearerHeader().catch(() => ({}));
      const res = await fetch("/api/billing/claim-founder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": targetUserId,
          ...authHeaders,
        },
        body: JSON.stringify({ userId: targetUserId }),
      });

      const parsed = await readJsonResponse(res);
      if (!parsed.isJson || !parsed.data) {
        networkUnreachable = true;
      } else {
        const data = parsed.data;
        if (res.ok && data.success && data.entitlement) {
          this.saveCachedEntitlement({ ...data.entitlement, userId: targetUserId });
          if (!data.alreadyClaimed) {
            NotificationService.notifyProActivated("lifetime", true);
          }
          return {
            success: true,
            entitlement: { ...data.entitlement, userId: targetUserId },
            founderNumber: data.founderNumber || data.entitlement.founderNumber,
            message: data.message || `VIP Seat #${data.founderNumber || "VIP"} activated!`,
          };
        }

        return {
          success: false,
          error: data.error || "Could not claim VIP seat.",
        };
      }
    } catch (err: any) {
      networkUnreachable = true;
      console.warn("[SubscriptionManager] Claim VIP API unreachable, checking direct DB RPC:", err?.message || err);
    }

    return {
      success: false,
      error: "VIP seat allocation service is temporarily unavailable. Please try again shortly.",
    };
  }

  /**
   * Get Real Authoritative 50-Seat VIP Availability.
   * Uses only the authenticated server registry endpoint. Never exposes a SECURITY DEFINER
   * stats RPC to browser roles or fabricates a zero-count fallback on error.
   */
  public async getFounderAvailability(): Promise<{ claimed: number; totalSpots: number; remaining: number }> {
    let apiError: Error | null = null;
    let apiUnreachable = false;

    // 1. Authoritative backend API endpoint (returns global verified VIP seat count)
    try {
      const authHeaders = await getAuthBearerHeader().catch(() => ({}));
      const res = await fetch("/api/billing/founder-stats", {
        cache: "no-store",
        headers: { ...authHeaders },
      });
      const parsed = await readJsonResponse(res);
      if (!parsed.isJson || !parsed.data) {
        apiUnreachable = true;
        apiError = new Error("VIP seat availability is temporarily unavailable. Please try again shortly.");
      } else if (res.ok) {
        const data = parsed.data;
        const occupied =
          typeof data.occupiedSpots === "number"
            ? data.occupiedSpots
            : typeof data.claimedSpots === "number"
            ? data.claimedSpots
            : typeof data.claimed === "number"
            ? data.claimed
            : null;
        if (data.success && occupied !== null) {
          const total = data.totalSpots || 50;
          const boundedOccupied = Math.max(0, Math.min(total, occupied));
          return {
            claimed: boundedOccupied,
            totalSpots: total,
            remaining: Math.max(0, total - boundedOccupied),
          };
        }
        apiError = new Error(data.error || "VIP seat availability response was invalid.");
      } else {
        const serverMsg = parsed.data?.error || `VIP seat registry returned HTTP ${res.status}.`;
        apiError = new Error(serverMsg);
      }
    } catch {
      apiUnreachable = true;
      apiError = new Error("VIP seat availability is temporarily unavailable. Please try again shortly.");
    }


    throw apiError || new Error("VIP seat availability is temporarily unavailable.");
  }

  /**
   * Real-time subscription to Founder count updates with Supabase Realtime channel + polling fallback
   */
  public subscribeToFounderAvailability(
    callback: (stats: { claimed: number; totalSpots: number; remaining: number }) => void
  ): () => void {
    // 1. Immediate fetch
    this.getFounderAvailability().then(callback).catch(() => {});

    // 2. Supabase Realtime Channel if available
    let realtimeChannel: any = null;
    if (supabase && typeof (supabase as any).channel === "function") {
      try {
        realtimeChannel = supabase
          .channel("founder-realtime-tracker")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "user_entitlements" },
            async () => {
              try {
                const fresh = await this.getFounderAvailability();
                callback(fresh);
              } catch {}
            }
          )
          .subscribe();
      } catch (e) {
        console.warn("[SubscriptionManager] Realtime channel setup warning:", e);
      }
    }

    // 3. Fallback polling interval (every 8 seconds)
    const pollInterval = setInterval(async () => {
      try {
        const fresh = await this.getFounderAvailability();
        callback(fresh);
      } catch {}
    }, 8000);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (realtimeChannel && supabase) {
        try {
          supabase.removeChannel(realtimeChannel);
        } catch {}
      }
    };
  }

  /**
   * Reset to Free tier on logout / account purge
   */
  public resetToFree(): void {
    this.userEntitlementsCache.clear();
    try {
      localStorage.removeItem(STORAGE_KEYS.USER_ENTITLEMENT);
      localStorage.removeItem(STORAGE_KEYS.OFFLINE_GRACE_TIMESTAMP);
      localStorage.removeItem(STORAGE_KEYS.FOUNDER_STATUS);
    } catch {}
    const freeEntitlement = createDefaultFreeEntitlement("guest");
    this.currentEntitlement = freeEntitlement;
    this.notifyListeners();
  }
}

export const SubscriptionManager = new SubscriptionManagerService();
