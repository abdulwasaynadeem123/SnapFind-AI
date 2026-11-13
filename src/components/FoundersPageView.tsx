import React, { useState, useEffect } from "react";
import {
  Crown,
  Search,
  ShieldCheck,
  Zap,
  Check,
  ArrowRight,
  Infinity as InfinityIcon,
  RefreshCw,
  Award,
  Star,
  Users,
  Shield,
  HelpCircle,
  Gem,
  Lock,
} from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { SubscriptionManager } from "../services/billing/SubscriptionManager";
import { NavViewType } from "./BottomNavigation";
import { SnapFindLogo } from "./SnapFindLogo";
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
  const { user, isPro, refreshEntitlement } = useAuth();
  const [isClaiming, setIsClaiming] = useState(false);

  // Dynamic Founder stats state
  const [founderStats, setFounderStats] = useState<{
    claimed: number;
    totalSpots: number;
    remaining: number;
  }>({
    claimed: 0,
    totalSpots: 50,
    remaining: 50,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const isFounder = Boolean(user?.entitlement?.isFounder || user?.plan === "Founder");
  const founderNumber = user?.entitlement?.founderNumber;
  const isPaidPro = Boolean(isPro && !isFounder);

  const loadFounderStats = async () => {
    try {
      const stats = await SubscriptionManager.getFounderAvailability();
      setFounderStats(stats);
    } catch (e) {
      console.warn("[FoundersPage] Could not load founder availability:", e);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    loadFounderStats();
    const interval = setInterval(loadFounderStats, 12000);
    return () => clearInterval(interval);
  }, []);

  const totalSpots = founderStats.totalSpots || 50;
  const claimedCount = Math.max(0, Math.min(totalSpots, founderStats.claimed));
  const remainingCount = Math.max(0, totalSpots - claimedCount);
  const claimedPercentage = Math.round((claimedCount / totalSpots) * 100);

  const handleClaim = async () => {
    if (!user || user.id === "guest" || user.id.startsWith("local-guest")) {
      addToast?.({
        title: "Sign In Required",
        description: "Please sign in or create an account to claim your Pioneer Founder spot.",
        type: "info",
      });
      if (onOpenAuth) onOpenAuth();
      return;
    }

    try {
      setIsClaiming(true);
      const res = await SubscriptionManager.claimFounder(user.id);
      if (res.success && res.entitlement) {
        await refreshEntitlement();
        await loadFounderStats();
        addToast?.({
          title: "👑 Founder Status Activated!",
          description: `Congratulations! You are officially Pioneer Founder #${res.founderNumber || "VIP"} with Lifetime Pro free forever.`,
          type: "success",
        });
      } else {
        addToast?.({
          title: "Founder Allocation Full",
          description: res.error || "All 50 Pioneer Founder spots have been claimed. Lifetime Pro is available for PKR 7,999.",
          type: "info",
        });
      }
    } catch (err: any) {
      addToast?.({
        title: "Claim Failed",
        description: err.message || "Unable to claim Founder spot.",
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
      title: "Unlimited Screenshot Storage",
      desc: "Bypass the 70 lifetime screenshot free limit completely. Index unlimited screenshots.",
      icon: Zap,
      accent: "text-[#B7F36B] bg-[#141714] border-[#30362E]",
    },
    {
      title: "Pioneer Founder Rank (#1–#50)",
      desc: "Permanent badge and immutable Founder rank engraved on your profile and export cards.",
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
      title: "Priority Indexing Queue",
      desc: "Founder screenshots receive highest-priority processing speed during bulk uploads.",
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
      {/* 3D Hero Header */}
      <PageHeroHeader
        type="founder"
        title="Founders Club"
        isDark={isDark}
      />

      {/* Dynamic Status / Claim Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 sm:p-8 rounded-3xl border border-[#30362E] bg-[#141714] shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.025)] relative overflow-hidden"
      >
        <div className="relative z-10 space-y-6">
          {isFounder ? (
            /* ================= VERIFIED FOUNDER VIEW ================= */
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#30362E]">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#B7F36B] flex items-center justify-center text-[#10130D] shadow-[2px_2px_8px_rgba(0,0,0,0.4)]">
                    <Crown className="w-8 h-8 fill-current" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#B7F36B] uppercase tracking-widest">Pioneer Status Confirmed</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E]">VIP #1–#50</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-[#F7F8F5] tracking-tight">
                      Pioneer Founder #{founderNumber || "VIP"}
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
                  <p className="text-lg font-bold text-[#F7F8F5] font-mono">Unlimited</p>
                  <p className="text-[11px] text-[#777E74]">Free limit is 70 lifetime screenshots</p>
                </div>
                <div className="p-4 rounded-2xl bg-[#0D0F0D] border border-[#30362E] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] space-y-1">
                  <span className="text-xs text-[#A5AAA1] font-medium">Founder Rank &amp; Renewal</span>
                  <p className="text-lg font-bold text-[#B7F36B] font-mono">Rank #{founderNumber || "VIP"} of 50 (PKR 0 / Forever)</p>
                  <p className="text-[11px] text-[#777E74]">Pioneer Founder tier, never expires</p>
                </div>
              </div>
            </div>
          ) : (
            /* ================= NON-FOUNDER / CANDIDATE VIEW ================= */
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-[#B7F36B] uppercase tracking-widest">
                    Live Founder Spots Allocation
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#F7F8F5] tracking-tight mt-0.5">
                    {remainingCount > 0
                      ? `${remainingCount} of ${totalSpots} Founder Spots Remaining`
                      : `All ${totalSpots} Founder Spots Claimed`}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={loadFounderStats}
                    disabled={isLoadingStats}
                    title="Refresh availability count"
                    className="p-2.5 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-[#A5AAA1] hover:text-[#F7F8F5] shadow-[2px_2px_8px_rgba(0,0,0,0.3)] transition cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingStats ? "animate-spin" : ""}`} />
                  </button>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E]">
                    First 50 Users
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-[#A5AAA1] font-medium">
                  <span>{claimedCount} Pioneer spots claimed</span>
                  <span className="text-[#B7F36B] font-bold">{claimedPercentage}% Claimed</span>
                </div>
                <div className="w-full h-3 rounded-full bg-[#0D0F0D] overflow-hidden p-0.5 border border-[#30362E] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.6)]">
                  <div
                    className="h-full rounded-full bg-[#B7F36B] transition-all duration-500"
                    style={{ width: `${Math.max(4, Math.min(100, claimedPercentage))}%` }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              {remainingCount > 0 ? (
                <div className="p-4 rounded-2xl bg-[#1B1F1A] border border-[#30362E] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[3px_3px_10px_rgba(0,0,0,0.4)]">
                  <div className="space-y-0.5 text-center sm:text-left">
                    <h3 className="text-sm font-bold text-[#F7F8F5] flex items-center justify-center sm:justify-start gap-1.5">
                      <Crown className="w-4 h-4 text-[#B7F36B]" /> Qualify for Free Lifetime Pro
                    </h3>
                    <p className="text-xs text-[#A5AAA1]">
                      Claiming assigns your immutable Founder rank (#1–#50) and permanently unlocks unlimited screenshots.
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
                        <span>Claiming Spot...</span>
                      </>
                    ) : (
                      <>
                        <Crown className="w-4 h-4 fill-current text-[#10130D]" />
                        <span>Claim Free Founder Spot</span>
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
                      All 50 Pioneer Founder allocations have been claimed. You can unlock Lifetime Pro anytime via one-time PKR 7,999.
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
            </div>
          )}
        </div>
      </motion.div>

      {/* Perks Grid */}
      <div className="space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold text-[#F7F8F5]">Founder Perks & Privileges</h2>
          <p className="text-xs sm:text-sm text-[#A5AAA1]">
            Everything included with your Pioneer Founder grant
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
