import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "../services/supabase";
import { SubscriptionManager } from "../services/billing/SubscriptionManager";

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
  refreshFounderStats: () => Promise<void>;
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
  refreshFounderStats: async () => {},
  claimFounderSpot: async () => ({ success: false, error: "Not initialized" }),
});

export const FounderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stats, setStats] = useState<FounderStats>(defaultFounderState);
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

    // Periodic refresh while open
    const interval = setInterval(() => {
      fetchAuthoritativeStats();
    }, 15000);

    // Refresh when user returns to tab/window or across devices
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

  const claimFounderSpot = async (userId?: string) => {
    try {
      const res = await SubscriptionManager.claimFounder(userId);
      await fetchAuthoritativeStats();
      return res;
    } catch (err: any) {
      await fetchAuthoritativeStats();
      return {
        success: false,
        error: err.message || "Failed to claim VIP seat.",
      };
    }
  };

  return (
    <FounderContext.Provider
      value={{
        ...stats,
        refreshFounderStats: fetchAuthoritativeStats,
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
