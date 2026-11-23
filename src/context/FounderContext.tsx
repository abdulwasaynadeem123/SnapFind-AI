import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "../services/supabase";
import { SubscriptionManager } from "../services/billing/SubscriptionManager";
import { NotificationService } from "../services/notificationService";
import { useAuth } from "./AuthContext";
import { VipEligibilityInfo } from "../types";

export interface FounderStats {
  claimed: number | null;
  occupied: number | null;
  totalSpots: number;
  remaining: number | null;
  isAvailable: boolean;
  isLive: boolean;
  isLoading: boolean;
  error?: string | null;
}

interface FounderContextType extends FounderStats {
  eligibility: VipEligibilityInfo | null;
  isEligibilityLoading: boolean;
  refreshFounderStats: () => Promise<void>;
  refreshEligibility: () => Promise<VipEligibilityInfo | null>;
  deferVipOffer: () => Promise<{
    success: boolean;
    eligibility?: VipEligibilityInfo;
    error?: string;
  }>;
  claimFounderSpot: (userId?: string) => Promise<{
    success: boolean;
    founderNumber?: number;
    message?: string;
    error?: string;
  }>;
}

const TOTAL_VIP_SEATS = 50;

const defaultFounderState: FounderStats = {
  claimed: null,
  occupied: null,
  totalSpots: TOTAL_VIP_SEATS,
  remaining: null,
  isAvailable: false,
  isLive: false,
  isLoading: true,
  error: null,
};

const FounderContext = createContext<FounderContextType>({
  ...defaultFounderState,
  eligibility: null,
  isEligibilityLoading: false,
  refreshFounderStats: async () => {},
  refreshEligibility: async () => null,
  deferVipOffer: async () => ({ success: false, error: "Not initialized" }),
  claimFounderSpot: async () => ({ success: false, error: "Not initialized" }),
});

export const FounderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const authUserId = auth?.user?.id;
  const authLoading = Boolean(auth?.loading);
  const emailVerified = auth?.user?.emailVerified;

  const [stats, setStats] = useState<FounderStats>(defaultFounderState);
  const [eligibility, setEligibility] = useState<VipEligibilityInfo | null>(null);
  const [isEligibilityLoading, setIsEligibilityLoading] = useState<boolean>(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const fetchAuthoritativeStats = useCallback(async () => {
    try {
      const liveStats = await SubscriptionManager.getFounderAvailability();
      if (!isMountedRef.current) return;
      const total = liveStats.totalSpots || TOTAL_VIP_SEATS;
      const occupied = Math.max(0, Math.min(total, liveStats.claimed));
      const remaining = Math.max(0, total - occupied);
      setStats({
        claimed: occupied,
        occupied,
        totalSpots: total,
        remaining,
        isAvailable: remaining > 0,
        isLive: true,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      console.warn("[VIPContext] Error fetching authoritative VIP seat stats:", err?.message || err);
      if (!isMountedRef.current) return;
      setStats({
        claimed: null,
        occupied: null,
        totalSpots: TOTAL_VIP_SEATS,
        remaining: null,
        isAvailable: false,
        isLive: false,
        isLoading: false,
        error: err?.message || "VIP seat availability is temporarily unavailable. Please try again.",
      });
    }
  }, []);

  const refreshEligibility = useCallback(async (): Promise<VipEligibilityInfo | null> => {
    if (!authUserId || authUserId === "guest" || authUserId.startsWith("local-guest") || emailVerified === false) {
      if (isMountedRef.current) {
        setEligibility(null);
        setIsEligibilityLoading(false);
      }
      return null;
    }

    if (isMountedRef.current) {
      setIsEligibilityLoading(true);
    }
    try {
      const status = await SubscriptionManager.getFounderPromoStatus();
      if (!status) {
        if (isMountedRef.current) setEligibility(null);
        return null;
      }
      const remainingSlots = Math.max(0, Number(status.remainingSignups ?? 0));
      const assignedSlots = Math.max(0, Number(status.signupCount ?? 0));
      const mapped: VipEligibilityInfo = {
        userId: authUserId,
        signupNumber: status.signupNumber,
        vipEligible: Boolean(status.eligible),
        vipClaimStatus: status.claimed ? "claimed" : status.eligible ? "pending" : "not_eligible",
        vipClaimedAt: null,
        vipOfferDeferredAt: status.dismissed ? new Date().toISOString() : null,
        founderNumber: status.founderRank,
        isFounder: Boolean(status.claimed),
        totalSlots: 50,
        assignedSlots,
        claimedCount: stats.claimed ?? 0,
        remainingSlots,
        offerOpen: remainingSlots > 0,
      };
      if (isMountedRef.current) {
        setEligibility(mapped);
      }
      return mapped;
    } catch {
      if (isMountedRef.current) {
        setEligibility(null);
      }
      return null;
    } finally {
      if (isMountedRef.current) {
        setIsEligibilityLoading(false);
      }
    }
  }, [authUserId, emailVerified, stats.claimed]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchAuthoritativeStats();

    let channel: any = null;
    if (supabase && isSupabaseConfigured && typeof (supabase as any).channel === "function") {
      channel = supabase
        .channel("vip_seat_realtime_sync")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_entitlements",
          },
          () => {
            fetchAuthoritativeStats();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "founder_claims",
          },
          () => {
            fetchAuthoritativeStats();
          }
        )
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            fetchAuthoritativeStats();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (isMountedRef.current) {
              setStats((prev) => ({ ...prev, isLive: false }));
            }
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = setTimeout(() => {
              fetchAuthoritativeStats();
            }, 3000);
          }
        });
    }

    const interval = setInterval(() => {
      fetchAuthoritativeStats();
    }, 15000);

    const handleFocus = () => {
      fetchAuthoritativeStats();
    };
    const handleVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchAuthoritativeStats();
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleFocus);
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }

    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      clearInterval(interval);
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleFocus);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
      if (channel && supabase) {
        supabase.removeChannel(channel).catch(() => {});
      }
    };
  }, [fetchAuthoritativeStats]);

  useEffect(() => {
    if (authLoading) return;
    refreshEligibility();
  }, [authLoading, refreshEligibility]);

  const claimFounderSpot = async (userId?: string) => {
    try {
      const res = await SubscriptionManager.claimFounder(userId || authUserId);
      await Promise.all([fetchAuthoritativeStats(), refreshEligibility()]);
      return res;
    } catch (err: any) {
      await fetchAuthoritativeStats();
      return {
        success: false,
        error: err.message || "Failed to claim Lifetime Free VIP access.",
      };
    }
  };

  const deferVipOffer = async () => {
    const targetId = authUserId;
    if (!targetId || targetId === "guest" || targetId.startsWith("local-guest")) {
      return { success: false, error: "Authentication required." };
    }
    try {
      const ok = await SubscriptionManager.dismissFounderPromo();
      if (ok) {
        NotificationService.notifyVipOfferWaiting(targetId, { forceRecreate: true });
        const refreshed = await refreshEligibility();
        return { success: true, eligibility: refreshed || undefined };
      }
      return { success: false, error: "Unable to defer offer right now." };
    } catch (err: any) {
      return { success: false, error: err?.message || "Unable to defer offer right now." };
    }
  };

  return (
    <FounderContext.Provider
      value={{
        ...stats,
        eligibility,
        isEligibilityLoading,
        refreshFounderStats: fetchAuthoritativeStats,
        refreshEligibility,
        deferVipOffer,
        claimFounderSpot,
      }}
    >
      {children}
    </FounderContext.Provider>
  );
};

export const useFounder = (): FounderContextType => {
  return useContext(FounderContext);
};
