import React, { useState } from "react";
import {
  Crown,
  Check,
  Zap,
  ShieldCheck,
  Infinity as InfinityIcon,
  Search,
  Shield,
  ArrowRight,
  RefreshCw,
  Gem,
  AlertCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { useFounder } from "../context/FounderContext";
import { NavViewType } from "./BottomNavigation";
import { PageHeroHeader } from "./PageHeroHeader";

interface FoundersPageViewProps {
  isDark?: boolean;
  onNavigate?: (view: NavViewType) => void;
  onOpenAuth?: () => void;
  onOpenUpgrade?: () => void;
  addToast?: (toast: { title: string; description?: string; type: "success" | "error" | "info" }) => void;
}

export const FoundersPageView: React.FC<FoundersPageViewProps> = ({
  isDark = true,
  onNavigate,
  onOpenAuth,
  onOpenUpgrade,
  addToast,
}) => {
  const { user, entitlement, isPro, loading: authLoading, refreshEntitlement } = useAuth();
  const {
    claimed: rawClaimed,
    totalSpots = 50,
    remaining: rawRemaining,
    isLoading: isLoadingStats,
    error: statsError,
    refreshFounderStats,
    claimFounderSpot,
  } = useFounder();

  const [isClaiming, setIsClaiming] = useState(false);

  const isFounder = Boolean(
    user?.entitlement?.isFounder ||
      entitlement?.isFounder ||
      user?.plan === "Founder" ||
      user?.entitlement?.plan === "founder" ||
      entitlement?.plan === "founder" ||
      user?.entitlement?.tier === "Founder" ||
      entitlement?.tier === "Founder"
  );
  const founderNumber = user?.entitlement?.founderNumber || entitlement?.founderNumber || null;
  const isPaidPro = Boolean(isPro && !isFounder);

  const hasValidStats =
    !statsError &&
    typeof rawClaimed === "number" &&
    typeof rawRemaining === "number";

  const occupiedCount = hasValidStats ? Math.max(0, Math.min(totalSpots, rawClaimed as number)) : null;
  const remainingCount = hasValidStats ? Math.max(0, totalSpots - (occupiedCount as number)) : null;
  const occupiedPercentage = hasValidStats ? Math.round(((occupiedCount as number) / totalSpots) * 100) : 0;

  const handleClaim = async () => {
    if (!user || user.id === "guest" || user.id.startsWith("local-guest")) {
      addToast?.({
        title: "Sign In Required",
        description: "Please sign in or create an account to claim your VIP Seat.",
        type: "info",
      });
      if (onOpenAuth) onOpenAuth();
      return;
    }

    if (isFounder) {
      addToast?.({
        title: "VIP Access Active",
        description: `You already hold ${founderNumber ? `VIP Seat #${founderNumber}` : "your VIP Seat"} with Lifetime Pro access.`,
        type: "success",
      });
      return;
    }

    if (!hasValidStats) {
      addToast?.({
        title: "Availability Unavailable",
        description: statsError || "Unable to verify VIP seat availability right now.",
        type: "info",
      });
      refreshFounderStats();
      return;
    }

    try {
      setIsClaiming(true);
      const res = await claimFounderSpot(user.id);
      if (res.success && (res as any).founderNumber) {
        await refreshEntitlement();
        await refreshFounderStats();
        addToast?.({
          title: "VIP Access Activated",
          description: `Welcome, VIP User! You hold VIP Seat #${res.founderNumber} with Lifetime Pro access.`,
          type: "success",
        });
      } else {
        await refreshFounderStats();
        addToast?.({
          title: "VIP Allocation Notice",
          description: res.error || "All 50 VIP seats have been occupied. Lifetime Pro is available for PKR 5,999.",
          type: "info",
        });
      }
    } catch (err: any) {
      addToast?.({
        title: "Claim Failed",
        description: err.message || "Unable to claim VIP Seat.",
        type: "error",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  const perks = [
    {
      title: "Lifetime Pro 100% Free",
      desc: "Never pay a monthly or yearly subscription fee. Permanent complimentary access.",
      icon: InfinityIcon,
      accent: "text-[#B7F36B] bg-[#141714] border-[#30362E]",
    },
    {
      title: "150,000 AI-Indexed Screenshots",
      desc: "Bypass the 250 lifetime screenshot free limit completely. Index up to 150,000 screenshots.",
      icon: Zap,
      accent: "text-[#B7F36B] bg-[#141714] border-[#30362E]",
    },
    {
      title: "VIP Seat & VIP Badge (#1–#50)",
      desc: "Permanent VIP Badge and immutable VIP Seat number displayed on your account.",
      icon: Crown,
      accent: "text-[#B7F36B] bg-[#141714] border-[#30362E]",
    },
    {
      title: "On-Device OCR & Multimodal Vision AI",
      desc: "High-accuracy multi-lingual optical character recognition with instant natural language search.",
      icon: Search,
      accent: "text-[#B7F36B] bg-[#141714] border-[#30362E]",
    },
    {
      title: "VIP Priority Processing Queue",
      desc: "VIP User screenshots receive highest-priority processing speed during bulk uploads.",
      icon: ShieldCheck,
      accent: "text-[#B7F36B] bg-[#141714] border-[#30362E]",
    },
    {
      title: "Encrypted Cloud Sync",
      desc: "Real-time cross-device synchronization with row-level cryptographic isolation.",
      icon: Shield,
      accent: "text-[#B7F36B] bg-[#141714] border-[#30362E]",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16 text-[#F7F8F5]">
      <PageHeroHeader
        type="founder"
        title="VIP Program"
        isDark={isDark}
      />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 sm:p-8 rounded-3xl border border-[#30362E] bg-[#141714] shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.025)] relative overflow-hidden"
      >
        <div className="relative z-10 space-y-6">
          {isFounder ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#30362E]">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#B7F36B] flex items-center justify-center text-[#10130D] shadow-[2px_2px_8px_rgba(0,0,0,0.4)]">
                    <Crown className="w-8 h-8 fill-current" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#B7F36B] uppercase tracking-widest">VIP Access Confirmed</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E]">VIP Badge #1–#50</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-[#F7F8F5] tracking-tight">
                      VIP User • {founderNumber ? `Seat #${founderNumber}` : "Seat Verified"}
                    </h2>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E] inline-flex items-center gap-1.5 shadow-[2px_2px_8px_rgba(0,0,0,0.3)]">
                    <Check className="w-4 h-4 text-[#B7F36B]" /> Lifetime Pro Unlocked (Free)
                  </span>
                  <p className="text-[11px] text-[#A5AAA1] mt-1">Permanent complimentary access</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[#0D0F0D] border border-[#30362E] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] space-y-1">
                  <span className="text-xs text-[#A5AAA1] font-medium">Screenshot Quota</span>
                  <p className="text-lg font-bold text-[#F7F8F5] font-mono">150,000</p>
                  <p className="text-[11px] text-[#777E74]">Free limit is 250 lifetime screenshots</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#0D0F0D] border border-[#30362E] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] space-y-1">
                  <span className="text-xs text-[#A5AAA1] font-medium">VIP Seat &amp; Renewal</span>
                  <p className="text-lg font-bold text-[#B7F36B] font-mono">
                    {founderNumber ? `VIP Seat #${founderNumber} of 50` : "VIP Seat Verified"} (PKR 0 / Forever)
                  </p>
                  <p className="text-[11px] text-[#777E74]">VIP Program tier, never expires</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {isLoadingStats && !hasValidStats ? (
                <div className="flex items-center justify-between gap-3 py-4 text-xs text-[#A5AAA1]">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#B7F36B]" />
                    <span>Loading live VIP seat availability...</span>
                  </div>
                  <span className="font-mono text-[#777E74]">{totalSpots} total VIP seats</span>
                </div>
              ) : !hasValidStats ? (
                <div className="p-4 rounded-2xl bg-[#1B1F1A] border border-[#30362E] flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-0.5 text-center sm:text-left">
                    <h3 className="text-sm font-bold text-[#F7F8F5] flex items-center justify-center sm:justify-start gap-1.5">
                      <AlertCircle className="w-4 h-4 text-[#B7F36B]" /> VIP seat availability temporarily unavailable
                    </h3>
                    <p className="text-xs text-[#A5AAA1]">
                      {statsError || "Could not verify the live VIP seat count. Please retry."}
                    </p>
                  </div>
                  <button
                    onClick={() => refreshFounderStats()}
                    className="px-4 py-2.5 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold text-[#B7F36B] uppercase tracking-widest">
                        Live VIP Seat Allocation
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-black text-[#F7F8F5] tracking-tight mt-0.5">
                        {(remainingCount as number) > 0
                          ? `${remainingCount} of ${totalSpots} VIP Seats Available`
                          : `All ${totalSpots} VIP Seats Occupied`}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => refreshFounderStats()}
                        disabled={isLoadingStats}
                        title="Refresh availability count"
                        className="p-2.5 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-[#A5AAA1] hover:text-[#F7F8F5] shadow-[2px_2px_8px_rgba(0,0,0,0.3)] transition cursor-pointer"
                      >
                        <RefreshCw className={`w-4 h-4 ${isLoadingStats ? "animate-spin" : ""}`} />
                      </button>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E]">
                        {totalSpots} Total VIP Seats
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-[#A5AAA1] font-medium">
                      <span>{occupiedCount} / {totalSpots} occupied</span>
                      <span className="text-[#B7F36B] font-bold">{remainingCount} available ({occupiedPercentage}%)</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-[#0D0F0D] overflow-hidden p-0.5 border border-[#30362E] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)]">
                      <div
                        className="h-full rounded-full bg-[#B7F36B] transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, occupiedPercentage))}%` }}
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {authLoading ? (
                    <div className="p-4 rounded-2xl bg-[#1B1F1A] border border-[#30362E] flex items-center justify-center gap-2 text-xs text-[#A5AAA1]">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#B7F36B]" />
                      <span>Verifying your account entitlement...</span>
                    </div>
                  ) : (remainingCount as number) > 0 ? (
                    <div className="p-4 rounded-2xl bg-[#1B1F1A] border border-[#30362E] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[3px_3px_10px_rgba(0,0,0,0.4)]">
                      <div className="space-y-0.5 text-center sm:text-left">
                        <h3 className="text-sm font-bold text-[#F7F8F5] flex items-center justify-center sm:justify-start gap-1.5">
                          <Crown className="w-4 h-4 text-[#B7F36B]" /> Claim Free Lifetime VIP Access
                        </h3>
                        <p className="text-xs text-[#A5AAA1]">
                          Claiming assigns your permanent VIP Seat (#1–#50) and unlocks 150,000 AI-indexed screenshots.
                        </p>
                      </div>

                      <button
                        id="claim-founder-spot-btn"
                        onClick={handleClaim}
                        disabled={isClaiming}
                        className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] font-bold text-sm flex items-center justify-center gap-2 shadow-[2px_2px_8px_rgba(0,0,0,0.4)] transition cursor-pointer hover:scale-[1.02] active:scale-[0.98] shrink-0"
                      >
                        {isClaiming ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-[#10130D]" />
                            <span>Allocating VIP Seat...</span>
                          </>
                        ) : (
                          <>
                            <Crown className="w-4 h-4 fill-current text-[#10130D]" />
                            <span>Claim Free VIP Seat</span>
                            <ArrowRight className="w-4 h-4 text-[#10130D]" />
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-[#1B1F1A] border border-[#30362E] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[3px_3px_10px_rgba(0,0,0,0.4)]">
                      <div className="space-y-0.5 text-center sm:text-left">
                        <h3 className="text-sm font-bold text-[#F7F8F5] flex items-center justify-center sm:justify-start gap-1.5">
                          <Gem className="w-4 h-4 text-[#B7F36B]" /> Lifetime Pro Available
                        </h3>
                        <p className="text-xs text-[#A5AAA1]">
                          All 50 VIP seats have been occupied. You can unlock Lifetime Pro anytime via one-time PKR 5,999.
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          if (onOpenUpgrade) onOpenUpgrade();
                          else if (onNavigate) onNavigate("pricing");
                        }}
                        className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shrink-0 shadow-[2px_2px_8px_rgba(0,0,0,0.4)]"
                      >
                        <span>Upgrade to Lifetime Pro</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>

      <div className="space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold text-[#F7F8F5]">VIP Program Benefits</h2>
          <p className="text-xs sm:text-sm text-[#A5AAA1]">
            Everything included with your VIP Seat
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {perks.map((perk, i) => (
            <motion.div
              key={perk.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-6 rounded-3xl bg-[#141714] border border-[#30362E] hover:border-[#B7F36B]/50 transition-all space-y-3 shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.025)] hover:-translate-y-1"
            >
              <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${perk.accent} shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4)]`}>
                <perk.icon className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#F7F8F5]">{perk.title}</h3>
              <p className="text-xs text-[#A5AAA1] leading-relaxed">{perk.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FoundersPageView;
