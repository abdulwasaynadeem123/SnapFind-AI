import React, { useState } from "react";
import {
  Check,
  Crown,
  ShieldCheck,
  RefreshCw,
  Infinity as InfinityIcon,
  Sparkles,
  Gem,
  Zap,
  Lock,
  Star,
  Activity,
  AlertCircle,
  Clock,
  LogIn,
  UserPlus,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useFounder } from "../context/FounderContext";
import { PaddleBillingService } from "../services/billing/PaddleBillingService";
import { PaddlePlanKey } from "../services/billing/paddleConfig";
import { PaymentHistoryCard } from "./subscription/PaymentHistoryCard";
import { AdminPaymentRequestsModal } from "./admin/AdminPaymentRequestsModal";
import { PageHeroHeader } from "./PageHeroHeader";
import { NavViewType } from "./BottomNavigation";

interface PricingPageViewProps {
  isDark?: boolean;
  onNavigate?: (view: NavViewType) => void;
  onOpenAuth?: () => void;
  addToast?: (toast: { title: string; description?: string; type: "success" | "error" | "info" }) => void;
}

type BillingFilter = "all" | "monthly" | "yearly" | "lifetime";

export const PricingPageView: React.FC<PricingPageViewProps> = ({
  isDark = true,
  onNavigate,
  onOpenAuth,
  addToast,
}) => {
  const { user, entitlement, isPro, loading: authLoading, refreshEntitlement } = useAuth();
  const {
    claimed: rawClaimed,
    totalSpots: totalVipSeats = 50,
    remaining: rawRemaining,
    isLive,
    isLoading: isLoadingVipStats,
    error: vipStatsError,
    claimFounderSpot,
    refreshFounderStats,
  } = useFounder();

  const hasValidVipStats =
    !vipStatsError &&
    typeof rawClaimed === "number" &&
    typeof rawRemaining === "number";
  const spotsClaimed = hasValidVipStats ? Math.max(0, Math.min(totalVipSeats, rawClaimed as number)) : null;
  const spotsRemaining = hasValidVipStats ? Math.max(0, totalVipSeats - (spotsClaimed as number)) : null;

  const [billingTab, setBillingTab] = useState<BillingFilter>("all");
  const [openingCheckoutPlan, setOpeningCheckoutPlan] = useState<PaddlePlanKey | null>(null);
  const [isClaimingFounder, setIsClaimingFounder] = useState(false);
  const [showAuthRequiredModal, setShowAuthRequiredModal] = useState(false);
  const [authModalPlanName, setAuthModalPlanName] = useState<string>("Pro");
  const [showAdminModal, setShowAdminModal] = useState(false);

  // Dynamic user plan calculation from authoritative state
  const isFounder = Boolean(
    user?.entitlement?.isFounder ||
      entitlement?.isFounder ||
      user?.plan === "Founder" ||
      user?.entitlement?.plan === "founder" ||
      entitlement?.plan === "founder" ||
      user?.entitlement?.tier === "Founder" ||
      entitlement?.tier === "Founder" ||
      (user as any)?.tier === "Founder"
  );
  const founderNumber = user?.entitlement?.founderNumber || entitlement?.founderNumber || null;
  const activePlanType =
    user?.entitlement?.plan ||
    entitlement?.plan ||
    user?.plan?.toLowerCase() ||
    (isFounder ? "founder" : isPro ? "pro" : "free");

  const isPaidMonthlyPro = Boolean(isPro && !isFounder && activePlanType === "monthly");
  const isPaidYearlyPro = Boolean(isPro && !isFounder && activePlanType === "yearly");
  const isPaidLifetimePro = Boolean(isPro && !isFounder && (activePlanType === "lifetime" || activePlanType === "pro"));
  const isFreeUser = !isPro && !isFounder;

  const isAdmin =
    user?.email?.toLowerCase().trim() === "ash.mary.2006@gmail.com" ||
    user?.role === "admin" ||
    (user as any)?.user_metadata?.role === "admin" ||
    (user as any)?.app_metadata?.role === "admin";

  // Canonical pricing definitions
  const monthlyPrice = 249;
  const yearlyPrice = 1999;
  const lifetimePrice = 5999;
  const founderPrice = 0;
  const yearlySavings = monthlyPrice * 12 - yearlyPrice; // 989 PKR savings

  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const [comingSoonPlanName, setComingSoonPlanName] = useState<string>("Pro Plan");

  // VIP seat copy based strictly on authoritative database state
  const vipSeatAvailabilityLabel = !hasValidVipStats
    ? isLoadingVipStats
      ? "Checking VIP Seats..."
      : "Temporarily Unavailable"
    : (spotsRemaining as number) > 0
    ? `${spotsRemaining} Available`
    : "0 Available • Full";

  /**
   * Handle click on Paid Plans (Coming Soon)
   */
  const handlePaidPlanClick = (planName: string) => {
    setComingSoonPlanName(planName);
    setShowComingSoonModal(true);
  };

  /**
   * 1-Click Free Founder Claim (No payment required, strictly 50 seats)
   */
  const handleClaimFreeFounder = async () => {
    if (!user || !user.id || user.id === "guest" || user.id.startsWith("local-guest")) {
      setAuthModalPlanName("VIP Program (Lifetime Free)");
      setShowAuthRequiredModal(true);
      return;
    }

    if (isFounder) {
      addToast?.({
        title: "VIP Access Active",
        description: `You already hold ${founderNumber ? `VIP Seat #${founderNumber}` : "your VIP Seat"} with permanent Lifetime Free Pro access.`,
        type: "success",
      });
      return;
    }

    if (!hasValidVipStats) {
      addToast?.({
        title: "Availability Unavailable",
        description: vipStatsError || "Live VIP seat count is still loading. Please retry in a moment.",
        type: "info",
      });
      refreshFounderStats();
      return;
    }

    if ((spotsRemaining ?? 0) <= 0) {
      addToast?.({
        title: "VIP Seats Full",
        description: "All 50 VIP seats have been occupied. You can choose Pro Lifetime or Pro Yearly.",
        type: "info",
      });
      return;
    }

    try {
      setIsClaimingFounder(true);
      const result = await claimFounderSpot(user.id);
      if (result.success) {
        await refreshEntitlement();
        await refreshFounderStats();
        addToast?.({
          title: "VIP Seat Activated",
          description:
            result.message ||
            `Welcome, VIP User! You have been assigned ${result.founderNumber ? `VIP Seat #${result.founderNumber}` : "your VIP Seat"} with Lifetime Pro access.`,
          type: "success",
        });
      } else {
        addToast?.({
          title: "VIP Seat Notice",
          description: result.error || "Could not allocate a VIP seat at this time.",
          type: "error",
        });
      }
    } catch (err: any) {
      console.error("[PricingPage] VIP claim error:", err);
      addToast?.({
        title: "Allocation Error",
        description: err.message || "Failed to claim VIP seat. Please try again.",
        type: "error",
      });
    } finally {
      setIsClaimingFounder(false);
    }
  };

  /**
   * Real Paddle Checkout Flow for Paid Plans
   */
  const handlePaddleCheckout = async (plan: PaddlePlanKey, planName: string) => {
    if (plan === "founder") {
      handleClaimFreeFounder();
      return;
    }

    // 1. Check if user is authenticated
    if (!user || !user.id || user.id === "guest" || user.id.startsWith("local-guest")) {
      setAuthModalPlanName(planName);
      setShowAuthRequiredModal(true);
      return;
    }

    // 2. Prevent purchasing already active permanent plans
    if (isFounder) {
      addToast?.({
        title: "VIP Access Active",
        description: `You are verified as VIP User with ${founderNumber ? `VIP Seat #${founderNumber}` : "your VIP Seat"} and permanent Lifetime Free Pro access.`,
        type: "success",
      });
      return;
    }

    if (isPaidLifetimePro && (plan === "monthly" || plan === "yearly")) {
      addToast?.({
        title: "Lifetime Pro Active",
        description: "You already have permanent Lifetime Pro access and do not need a recurring subscription.",
        type: "info",
      });
      return;
    }

    try {
      setOpeningCheckoutPlan(plan);

      const result = await PaddleBillingService.openCheckout({
        plan,
        user,
        onError: (errMessage) => {
          addToast?.({
            title: "Checkout Notice",
            description: errMessage || "Secure checkout is temporarily unavailable. Please try again later.",
            type: "error",
          });
        },
      });

      if (!result.success) {
        if (result.requiresAuth) {
          setAuthModalPlanName(planName);
          setShowAuthRequiredModal(true);
        } else {
          addToast?.({
            title: "Checkout Unavailable",
            description: result.error || "Secure checkout is temporarily unavailable. Please try again later.",
            type: "error",
          });
        }
      }
    } catch (err: any) {
      console.error("[PricingPage] Checkout open exception:", err);
      addToast?.({
        title: "Checkout Error",
        description: "Secure checkout is temporarily unavailable. Please try again later.",
        type: "error",
      });
    } finally {
      setOpeningCheckoutPlan(null);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 sm:space-y-12 pb-20 text-[#F1F5F9]">
      {/* 1. Standard Page Hero Header */}
      <PageHeroHeader
        type="pricing"
        title="Pricing"
        isDark={isDark}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-[#A5AAA1] bg-[#141714] px-3 py-1.5 rounded-xl border border-[#30362E] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4)]">
              <span className="flex h-2 w-2 relative">
                <span className="sr-only">Live spot indicator</span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#B7F36B]"></span>
              </span>
              <span>{isLive ? "Live Realtime Sync" : "Authoritative Sync"}</span>
            </div>
            {isAdmin && (
              <button
                id="admin-review-payments-btn"
                type="button"
                onClick={() => setShowAdminModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#1B1F1A] hover:bg-[#222720] text-[#F7F8F5] border border-[#30362E] transition cursor-pointer shadow-[2px_2px_8px_rgba(0,0,0,0.4)]"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#B7F36B]" />
                <span>Admin Review</span>
              </button>
            )}
          </div>
        }
      />

      {/* 2. Active User Current Plan Status Banner */}
      {user && user.id !== "guest" && (
        <div
          id="current-plan-status-bar"
          className="max-w-4xl mx-auto p-4 sm:p-5 rounded-2xl bg-[#141714] border border-[#30362E] flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.025)]"
        >
          <div className="flex items-center gap-3.5">
            {isFounder ? (
              <div className="w-11 h-11 rounded-xl bg-[#B7F36B]/15 border border-[#B7F36B]/35 flex items-center justify-center text-[#B7F36B] shrink-0">
                <Crown className="w-6 h-6" />
              </div>
            ) : isPaidLifetimePro ? (
              <div className="w-11 h-11 rounded-xl bg-[#B7F36B]/15 border border-[#B7F36B]/35 flex items-center justify-center text-[#B7F36B] shrink-0">
                <Gem className="w-6 h-6" />
              </div>
            ) : isPaidYearlyPro || isPaidMonthlyPro ? (
              <div className="w-11 h-11 rounded-xl bg-[#B7F36B]/15 border border-[#B7F36B]/35 flex items-center justify-center text-[#B7F36B] shrink-0">
                <Zap className="w-6 h-6 stroke-[2.5]" />
              </div>
            ) : (
              <div className="w-11 h-11 rounded-xl bg-[#1B1F1A] border border-[#30362E] flex items-center justify-center text-[#777E74] shrink-0">
                <InfinityIcon className="w-6 h-6" />
              </div>
            )}

            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <span className="text-sm font-bold text-[#F7F8F5]">
                  {isFounder
                    ? `VIP User • ${founderNumber ? `VIP Seat #${founderNumber}` : "VIP Seat Verified"}`
                    : isPaidLifetimePro
                    ? "💎 Pro Lifetime"
                    : isPaidYearlyPro
                    ? "⚡ Pro Yearly"
                    : isPaidMonthlyPro
                    ? "⚡ Pro Monthly"
                    : "Free Plan"}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    isFounder
                      ? "bg-[#B7F36B]/15 text-[#B7F36B] border border-[#B7F36B]/30"
                      : isPro
                      ? "bg-[#B7F36B]/15 text-[#B7F36B] border border-[#B7F36B]/30"
                      : "bg-[#1B1F1A] text-[#A5AAA1] border border-[#30362E]"
                  }`}
                >
                  {isFounder ? "VIP Access Active" : isPro ? "Active Pro" : "Active Plan"}
                </span>
              </div>
              <p className="text-xs text-[#A5AAA1] mt-0.5">
                {isFounder
                  ? "150,000 AI-indexed screenshots • Lifetime Free VIP Access • AI Multimodal Search"
                  : isPaidLifetimePro
                  ? "100,000 AI-indexed screenshots • Permanent Pro • AI Multimodal Search"
                  : isPaidYearlyPro
                  ? "30,000 AI-indexed screenshots/year • Priority AI Vision • Cloud Sync"
                  : isPaidMonthlyPro
                  ? "2,500 AI-indexed screenshots/month • AI Multimodal Search • Cloud Sync"
                  : "250 lifetime AI-indexed screenshots • On-device OCR • Basic search"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            {isFounder ? (
              <span className="text-[#B7F36B] flex items-center gap-1.5 bg-[#B7F36B]/15 px-3 py-1.5 rounded-xl border border-[#B7F36B]/30">
                <Crown className="w-3.5 h-3.5 text-[#B7F36B]" />
                {founderNumber ? `VIP Seat #${founderNumber} of 50` : "VIP Seat Verified"}
              </span>
            ) : isPro ? (
              <span className="text-[#B7F36B] flex items-center gap-1.5 bg-[#B7F36B]/15 px-3 py-1.5 rounded-xl border border-[#B7F36B]/30">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                Active Pro
              </span>
            ) : (
              <span className="text-[#A5AAA1] bg-[#1B1F1A] px-3 py-1.5 rounded-xl border border-[#30362E]">
                250 Lifetime AI-Indexed Screenshots Quota
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3. Billing Selector Filter Tabs */}
      <div className="flex items-center justify-center">
        <div className="inline-flex p-1 rounded-2xl bg-[#141714] border border-[#30362E] text-xs font-semibold shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4)]">
          <button
            type="button"
            onClick={() => setBillingTab("all")}
            className={`px-3 sm:px-4 py-2 rounded-xl transition-all cursor-pointer ${
              billingTab === "all"
                ? "bg-[#B7F36B] text-[#10130D] font-bold shadow-[2px_2px_8px_rgba(0,0,0,0.4)]"
                : "text-[#A5AAA1] hover:text-[#F7F8F5]"
            }`}
          >
            All Plans
          </button>
          <button
            type="button"
            onClick={() => setBillingTab("monthly")}
            className={`px-3 sm:px-4 py-2 rounded-xl transition-all cursor-pointer ${
              billingTab === "monthly"
                ? "bg-[#B7F36B] text-[#10130D] font-bold shadow-[2px_2px_8px_rgba(0,0,0,0.4)]"
                : "text-[#A5AAA1] hover:text-[#F7F8F5]"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingTab("yearly")}
            className={`px-3 sm:px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              billingTab === "yearly"
                ? "bg-[#B7F36B] text-[#10130D] font-bold shadow-[2px_2px_8px_rgba(0,0,0,0.4)]"
                : "text-[#A5AAA1] hover:text-[#F7F8F5]"
            }`}
          >
            <span>Yearly</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                billingTab === "yearly" ? "bg-[#10130D] text-[#B7F36B] font-bold" : "bg-[#1B1F1A] text-[#A5AAA1]"
              }`}
            >
              Save PKR {yearlySavings.toLocaleString()}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setBillingTab("lifetime")}
            className={`px-3 sm:px-4 py-2 rounded-xl transition-all cursor-pointer ${
              billingTab === "lifetime"
                ? "bg-[#B7F36B] text-[#10130D] font-bold shadow-[2px_2px_8px_rgba(0,0,0,0.4)]"
                : "text-[#A5AAA1] hover:text-[#F7F8F5]"
            }`}
          >
            Lifetime &amp; VIP Access
          </button>
        </div>
      </div>

      {/* 4. Complete Plans Grid: ALL 5 Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
        {/* ================= PLAN 1: FREE ================= */}
        {(billingTab === "all" || billingTab === "monthly") && (
          <div
            id="plan-card-free"
            className={`flex flex-col justify-between rounded-3xl p-6 sm:p-7 border bg-[#141714] shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.025)] transition-all relative ${
              isFreeUser
                ? "border-[#B7F36B]/50 ring-1 ring-[#B7F36B]/20"
                : "border-[#30362E] hover:border-[#30362E]/80"
            }`}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-[#F7F8F5] tracking-tight">FREE</h3>
                  <p className="text-xs text-[#A5AAA1] mt-0.5">Best for trying SnapFind</p>
                </div>
                {isFreeUser && (
                  <span className="px-2.5 py-1 rounded-xl bg-[#1B1F1A] border border-[#30362E] text-[10px] font-bold text-[#B7F36B]">
                    ✓ Current Plan
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="space-y-1">
                <div className="text-3xl sm:text-4xl font-bold text-[#F7F8F5]">PKR 0</div>
                <p className="text-xs text-[#A5AAA1]">Free forever • No credit card required</p>
              </div>

              {/* Benefits */}
              <div className="pt-4 border-t border-[#30362E] space-y-3">
                <p className="text-xs font-semibold text-[#A5AAA1] uppercase tracking-wider">Included Benefits</p>
                <ul className="space-y-2.5 text-xs sm:text-sm text-[#A5AAA1]">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span className="font-semibold text-[#F7F8F5]">250 lifetime AI-indexed screenshots</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span>On-device OCR text extraction</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span>Natural language &amp; visual search</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span>Collections &amp; smart albums</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span>Trash &amp; restore management</span>
                  </li>
                </ul>
              </div>

              {/* Limitations */}
              <div className="pt-3 border-t border-[#30362E] space-y-2">
                <p className="text-[11px] font-semibold text-[#777E74] uppercase tracking-wider">Plan Limit</p>
                <ul className="space-y-1.5 text-xs text-[#777E74]">
                  <li className="flex items-start gap-2">
                    <span className="text-[#777E74] font-bold">•</span>
                    <span>250 lifetime AI-indexed screenshots limit</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* CTA Button */}
            <div className="pt-6">
              {isFreeUser ? (
                <button
                  id="free-plan-current-btn"
                  type="button"
                  disabled
                  className="w-full py-3.5 px-4 rounded-xl bg-[#1B1F1A] border border-[#30362E] text-[#777E74] text-xs font-bold text-center cursor-default"
                >
                  ✓ Current Plan
                </button>
              ) : (
                <button
                  id="switch-to-free-btn"
                  type="button"
                  onClick={() => {
                    if (onNavigate) onNavigate("gallery");
                  }}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-[#F7F8F5] text-xs font-bold transition cursor-pointer shadow-[2px_2px_8px_rgba(0,0,0,0.3)]"
                >
                  Included in Your Account
                </button>
              )}
            </div>
          </div>
        )}

        {/* ================= PLAN 2: PRO MONTHLY ================= */}
        {(billingTab === "all" || billingTab === "monthly") && (
          <div
            id="plan-card-pro-monthly"
            className={`flex flex-col justify-between rounded-3xl p-6 sm:p-7 border bg-[#141714] shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.025)] transition-all relative ${
              isPaidMonthlyPro
                ? "border-[#B7F36B] ring-1 ring-[#B7F36B]/40"
                : "border-[#30362E] hover:border-[#30362E]/80"
            }`}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-[#F7F8F5] tracking-tight">PRO MONTHLY</h3>
                    <span className="px-2 py-0.5 rounded-full bg-[#1B1F1A] border border-[#30362E] text-[10px] font-bold text-[#B7F36B] uppercase tracking-wider">
                      Coming Soon
                    </span>
                  </div>
                  <p className="text-xs text-[#A5AAA1] mt-0.5">Best for flexible monthly usage</p>
                </div>
                {isPaidMonthlyPro && (
                  <span className="px-2.5 py-1 rounded-xl bg-[#1B1F1A] border border-[#30362E] text-[10px] font-bold text-[#B7F36B]">
                    ✓ Current Plan
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-bold text-[#F7F8F5]">PKR {monthlyPrice.toLocaleString()}</span>
                  <span className="text-xs text-[#A5AAA1]">/ month</span>
                </div>
                <p className="text-xs text-[#777E74]">Recurring monthly • Cancel anytime</p>
              </div>

              {/* Benefits */}
              <div className="pt-4 border-t border-[#30362E] space-y-3">
                <p className="text-xs font-semibold text-[#A5AAA1] uppercase tracking-wider">Pro Monthly Features</p>
                <ul className="space-y-2.5 text-xs sm:text-sm text-[#A5AAA1]">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span className="font-semibold text-[#F7F8F5]">2,500 AI-indexed screenshots / month</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span className="font-semibold text-[#F7F8F5]">Natural language multimodal AI search</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span>Advanced search filters &amp; date range</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span>QR, Barcode &amp; URL auto-intelligence</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span>Cloud sync &amp; multi-device backup</span>
                  </li>
                </ul>
              </div>

              {/* Limitations */}
              <div className="pt-3 border-t border-[#30362E] space-y-2">
                <p className="text-[11px] font-semibold text-[#777E74] uppercase tracking-wider">Billing Terms</p>
                <ul className="space-y-1.5 text-xs text-[#777E74]">
                  <li className="flex items-start gap-2">
                    <span className="text-[#777E74] font-bold">•</span>
                    <span>2,500 AI-indexed screenshots per month quota</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#777E74] font-bold">•</span>
                    <span>Recurring monthly billing</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* CTA Button */}
            <div className="pt-6">
              {isPaidMonthlyPro ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3.5 px-4 rounded-xl bg-[#1B1F1A] border border-[#30362E] text-[#B7F36B] text-xs font-bold text-center cursor-default"
                >
                  ✓ Current Plan Active
                </button>
              ) : (
                <button
                  id="subscribe-monthly-btn"
                  type="button"
                  onClick={() => handlePaidPlanClick("Pro Monthly (PKR 249/mo)")}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-[#F7F8F5] hover:text-[#B7F36B] text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-[2px_2px_8px_rgba(0,0,0,0.3)]"
                >
                  <Clock className="w-4 h-4 text-[#B7F36B]" />
                  <span>Coming Soon • PKR {monthlyPrice.toLocaleString()}/mo</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ================= PLAN 3: PRO YEARLY (BEST VALUE) ================= */}
        {(billingTab === "all" || billingTab === "yearly") && (
          <div
            id="plan-card-pro-yearly"
            className={`flex flex-col justify-between rounded-3xl p-6 sm:p-7 border bg-[#141714] shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.025)] transition-all relative ${
              isPaidYearlyPro
                ? "border-[#B7F36B] ring-1 ring-[#B7F36B]/40"
                : "border-[#30362E] hover:border-[#30362E]/80"
            }`}
          >
            {/* Top Badge: BEST VALUE */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-0.5 rounded-full bg-[#B7F36B] text-[#10130D] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-[2px_2px_8px_rgba(0,0,0,0.4)]">
              <Star className="w-3 h-3 fill-current" />
              <span>BEST VALUE • SAVE PKR {yearlySavings.toLocaleString()}</span>
            </div>

            <div className="space-y-5 pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-[#F7F8F5] tracking-tight">PRO YEARLY</h3>
                    <span className="px-2 py-0.5 rounded-full bg-[#1B1F1A] border border-[#30362E] text-[10px] font-bold text-[#B7F36B] uppercase tracking-wider">
                      Coming Soon
                    </span>
                  </div>
                  <p className="text-xs text-[#A5AAA1] mt-0.5 font-medium">Best value for regular users</p>
                </div>
                {isPaidYearlyPro && (
                  <span className="px-2.5 py-1 rounded-xl bg-[#1B1F1A] border border-[#30362E] text-[10px] font-bold text-[#B7F36B]">
                    ✓ Current Plan
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-bold text-[#F7F8F5]">PKR {yearlyPrice.toLocaleString()}</span>
                  <span className="text-xs text-[#A5AAA1]">/ year</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#B7F36B] font-semibold">
                    ~PKR {Math.round(yearlyPrice / 12)}/mo
                  </span>
                  <span className="text-xs text-[#777E74]">
                    (Saves PKR {yearlySavings.toLocaleString()} vs monthly)
                  </span>
                </div>
              </div>

              {/* Benefits */}
              <div className="pt-4 border-t border-[#30362E] space-y-3">
                <p className="text-xs font-semibold text-[#A5AAA1] uppercase tracking-wider">Yearly Benefits</p>
                <ul className="space-y-2.5 text-xs sm:text-sm text-[#A5AAA1]">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span className="font-semibold text-[#F7F8F5]">30,000 AI-indexed screenshots / year</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span className="font-semibold text-[#F7F8F5]">Everything in Pro Monthly</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span className="font-semibold text-[#F7F8F5]">Priority AI vision processing</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span>Priority OCR &amp; search indexing</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span>Full cloud backup &amp; multi-device sync</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span>Priority customer support</span>
                  </li>
                </ul>
              </div>

              {/* Limitations */}
              <div className="pt-3 border-t border-[#30362E] space-y-2">
                <p className="text-[11px] font-semibold text-[#777E74] uppercase tracking-wider">Billing Terms</p>
                <ul className="space-y-1.5 text-xs text-[#777E74]">
                  <li className="flex items-start gap-2">
                    <span className="text-[#777E74] font-bold">•</span>
                    <span>30,000 annual AI-indexed screenshots allowance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#777E74] font-bold">•</span>
                    <span>Recurring yearly payment</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* CTA Button */}
            <div className="pt-6">
              {isPaidYearlyPro ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3.5 px-4 rounded-xl bg-[#1B1F1A] border border-[#30362E] text-[#B7F36B] text-xs font-bold text-center cursor-default"
                >
                  ✓ Current Plan Active
                </button>
              ) : (
                <button
                  id="subscribe-yearly-btn"
                  type="button"
                  onClick={() => handlePaidPlanClick("Pro Yearly (PKR 1,999/yr)")}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-[#F7F8F5] hover:text-[#B7F36B] text-xs font-bold transition cursor-pointer shadow-[2px_2px_8px_rgba(0,0,0,0.3)] flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4 text-[#B7F36B]" />
                  <span>Coming Soon • PKR {yearlyPrice.toLocaleString()}/yr</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ================= PLAN 4: PRO LIFETIME ================= */}
        {(billingTab === "all" || billingTab === "lifetime") && (
          <div
            id="plan-card-pro-lifetime"
            className={`flex flex-col justify-between rounded-3xl p-6 sm:p-7 border bg-[#141714] shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.025)] transition-all relative ${
              isPaidLifetimePro
                ? "border-[#B7F36B] ring-1 ring-[#B7F36B]/40"
                : "border-[#30362E] hover:border-[#30362E]/80"
            }`}
          >
            {/* Top Pill */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-0.5 rounded-full bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-[2px_2px_8px_rgba(0,0,0,0.4)]">
              <Gem className="w-3 h-3 fill-current" />
              <span>ONE-TIME PAYMENT • PAY ONCE</span>
            </div>

            <div className="space-y-5 pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-[#F7F8F5] tracking-tight">PRO LIFETIME</h3>
                    <span className="px-2 py-0.5 rounded-full bg-[#1B1F1A] border border-[#30362E] text-[10px] font-bold text-[#B7F36B] uppercase tracking-wider">
                      Coming Soon
                    </span>
                  </div>
                  <p className="text-xs text-[#A5AAA1] mt-0.5">Best for users who want to pay once</p>
                </div>
                {isPaidLifetimePro && (
                  <span className="px-2.5 py-1 rounded-xl bg-[#1B1F1A] border border-[#30362E] text-[10px] font-bold text-[#B7F36B]">
                    💎 Active
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="space-y-1">
                <div className="text-3xl sm:text-4xl font-bold text-[#F7F8F5]">
                  PKR {lifetimePrice.toLocaleString()}
                </div>
                <p className="text-xs text-[#777E74]">One-time payment • No recurring fees forever</p>
              </div>

              {/* Benefits */}
              <div className="pt-4 border-t border-[#30362E] space-y-3">
                <p className="text-xs font-semibold text-[#A5AAA1] uppercase tracking-wider">Lifetime Inclusions</p>
                <ul className="space-y-2.5 text-xs sm:text-sm text-[#A5AAA1]">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span className="font-semibold text-[#F7F8F5]">100,000 AI-indexed screenshots</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span className="font-semibold text-[#F7F8F5]">Everything in Pro</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span className="font-semibold text-[#F7F8F5]">No recurring fees forever</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span className="font-semibold text-[#F7F8F5]">Permanent Lifetime Pro access</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span>Future Pro features included</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span>Permanently tied to user account</span>
                  </li>
                </ul>
              </div>

              {/* Limitations */}
              <div className="pt-3 border-t border-[#30362E] space-y-2">
                <p className="text-[11px] font-semibold text-[#777E74] uppercase tracking-wider">Terms</p>
                <ul className="space-y-1.5 text-xs text-[#777E74]">
                  <li className="flex items-start gap-2">
                    <span className="text-[#777E74] font-bold">•</span>
                    <span>100,000 lifetime AI-indexed screenshots quota</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#777E74] font-bold">•</span>
                    <span>One-time payment • No recurring subscriptions</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* CTA Button */}
            <div className="pt-6">
              {isPaidLifetimePro ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3.5 px-4 rounded-xl bg-[#1B1F1A] border border-[#30362E] text-[#B7F36B] text-xs font-bold text-center cursor-default"
                >
                  💎 Lifetime Pro Active
                </button>
              ) : (
                <button
                  id="get-pro-lifetime-btn"
                  type="button"
                  onClick={() => handlePaidPlanClick("Pro Lifetime (PKR 5,999 once)")}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-[#F7F8F5] hover:text-[#B7F36B] text-xs font-bold transition cursor-pointer shadow-[2px_2px_8px_rgba(0,0,0,0.3)] flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4 text-[#B7F36B]" />
                  <span>Coming Soon • PKR {lifetimePrice.toLocaleString()}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ================= PLAN 5: VIP ACCESS PLAN (FREE 150K QUOTA - 50 VIP SEATS) ================= */}
        <div
          id="plan-card-founder"
          className={`flex flex-col justify-between rounded-3xl p-6 sm:p-7 border bg-[#141714] shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.025)] transition-all relative ${
            billingTab === "all" ? "md:col-span-2 lg:col-span-2" : ""
          } ${
            isFounder
              ? "border-[#B7F36B] ring-1 ring-[#B7F36B]/40"
              : "border-[#30362E] hover:border-[#30362E]/80"
          }`}
        >
          {/* Top Tag */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-0.5 rounded-full bg-[#B7F36B] text-[#10130D] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[2px_2px_8px_rgba(0,0,0,0.4)] whitespace-nowrap">
            <Crown className="w-3.5 h-3.5 fill-current" />
            <span>VIP PROGRAM • 100% FREE • {totalVipSeats} VIP SEATS TOTAL</span>
          </div>

          <div className="space-y-5 pt-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-[#F7F8F5] tracking-tight">VIP ACCESS</h3>
                  <Crown className="w-5 h-5 text-[#B7F36B]" />
                </div>
                <p className="text-xs text-[#A5AAA1] mt-0.5 font-medium">
                  Strictly limited to {totalVipSeats} VIP User seats • 100% Free Lifetime VIP Program
                </p>
              </div>
              {isFounder && (
                <span className="px-3 py-1 rounded-xl bg-[#1B1F1A] border border-[#30362E] text-xs font-bold text-[#B7F36B] flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 fill-[#B7F36B]" />
                  <span>{founderNumber ? `VIP Seat #${founderNumber} Active` : "VIP Seat Active"}</span>
                </span>
              )}
            </div>

            {/* Price */}
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-bold text-[#B7F36B]">
                  FREE (PKR 0)
                </span>
                <span className="text-xs font-bold text-[#B7F36B] bg-[#1B1F1A] px-2.5 py-0.5 rounded-full border border-[#30362E]">
                  No Payment Required
                </span>
              </div>
              <p className="text-xs text-[#777E74]">
                Lifetime Free VIP Access • {totalVipSeats} total VIP seats • Instant 1-click allocation
              </p>
            </div>

            {/* AUTHORITATIVE 50-SEAT VIP COUNTER */}
            <div
              id="founder-availability-tracker"
              className="p-4 rounded-2xl bg-[#0D0F0D] border border-[#30362E] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)] space-y-2.5"
            >
              {isLoadingVipStats && !hasValidVipStats ? (
                <div className="flex items-center justify-between gap-3 py-2 text-xs text-[#A5AAA1]">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#B7F36B]" />
                    <span>Loading live VIP seat availability...</span>
                  </div>
                  <span className="text-[11px] font-mono text-[#777E74]">{totalVipSeats} total VIP seats</span>
                </div>
              ) : !hasValidVipStats ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#F7F8F5]">
                      <AlertCircle className="w-4 h-4 text-[#B7F36B] shrink-0" />
                      <span>VIP seat availability temporarily unavailable</span>
                    </div>
                    <p className="text-[11px] text-[#A5AAA1]">
                      {vipStatsError || "Unable to verify live seat occupancy right now."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => refreshFounderStats()}
                    className="px-3 py-1.5 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-xs font-bold text-[#F7F8F5] flex items-center gap-1.5 transition cursor-pointer shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#B7F36B]" />
                    <span>Retry</span>
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs sm:text-sm gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#B7F36B]" />
                      <span className="font-bold text-[#F7F8F5]">
                        {spotsClaimed} / {totalVipSeats} occupied
                      </span>
                    </div>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        (spotsRemaining as number) > 0
                          ? "bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E]"
                          : "bg-[#1B1F1A] text-[#A5AAA1] border border-[#30362E]"
                      }`}
                    >
                      {vipSeatAvailabilityLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div className="px-2.5 py-1.5 rounded-xl bg-[#141714] border border-[#30362E]">
                      <span className="text-[#777E74] block">Total VIP seats</span>
                      <span className="font-bold font-mono text-[#F7F8F5]">{totalVipSeats}</span>
                    </div>
                    <div className="px-2.5 py-1.5 rounded-xl bg-[#141714] border border-[#30362E]">
                      <span className="text-[#777E74] block">Occupied seats</span>
                      <span className="font-bold font-mono text-[#F7F8F5]">{spotsClaimed}</span>
                    </div>
                    <div className="px-2.5 py-1.5 rounded-xl bg-[#141714] border border-[#30362E]">
                      <span className="text-[#777E74] block">Available seats</span>
                      <span className="font-bold font-mono text-[#B7F36B]">{spotsRemaining}</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-[#141714] overflow-hidden p-0.5 border border-[#30362E] shadow-[inset_1px_1px_3px_rgba(0,0,0,0.6)]">
                    <div
                      className="h-full bg-[#B7F36B] rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, ((spotsClaimed as number) / totalVipSeats) * 100))}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-[#A5AAA1]">
                    {(spotsRemaining as number) > 0
                      ? `${totalVipSeats} total VIP seats • ${spotsClaimed} occupied • ${spotsRemaining} available right now.`
                      : "All 50 VIP seats have been occupied."}
                  </p>
                </>
              )}
            </div>

            {/* Grid of VIP Inclusions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#30362E]">
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-[#A5AAA1] uppercase tracking-wider">VIP Access Inclusions</p>
                <ul className="space-y-2 text-xs sm:text-sm text-[#A5AAA1]">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span className="font-semibold text-[#F7F8F5]">150,000 AI-indexed screenshots lifetime</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span className="font-semibold text-[#F7F8F5]">Lifetime Free Pro access (No payment required)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span className="font-semibold text-[#F7F8F5]">Permanent VIP Badge (#1–#50)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span className="font-semibold text-[#F7F8F5]">Permanent VIP User status</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-[#A5AAA1] uppercase tracking-wider">VIP Program Privileges</p>
                <ul className="space-y-2 text-xs sm:text-sm text-[#A5AAA1]">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span>Early access to major new features</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span>Official VIP User recognition &amp; VIP Badge</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span>VIP priority processing queue</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                    <span>Direct priority customer support</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Eligibility Limits */}
            <div className="pt-2 border-t border-[#30362E] space-y-1.5">
              <p className="text-[11px] font-semibold text-[#777E74] uppercase tracking-wider">Eligibility Limits</p>
              <p className="text-xs text-[#777E74]">
                • Hard maximum of 50 VIP seats. Seat allocation is atomic, deduplicated, and verified on the server.
              </p>
            </div>
          </div>

          {/* VIP CTA Button */}
          <div className="pt-6">
            {isFounder ? (
              <div className="p-3.5 rounded-2xl bg-[#1B1F1A] border border-[#30362E] text-center space-y-0.5 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3)]">
                <div className="text-xs font-bold text-[#B7F36B] flex items-center justify-center gap-1.5">
                  <Crown className="w-4 h-4 fill-[#B7F36B]" />
                  <span>
                    {founderNumber ? `VIP Seat #${founderNumber} of 50` : "VIP Seat Verified"} • Lifetime Free Pro Active
                  </span>
                </div>
                <p className="text-[11px] text-[#A5AAA1]">150,000 AI-indexed screenshots • VIP User</p>
              </div>
            ) : authLoading ? (
              <button
                type="button"
                disabled
                className="w-full py-3.5 px-4 rounded-xl bg-[#1B1F1A] text-[#A5AAA1] text-xs font-bold flex items-center justify-center gap-2 border border-[#30362E] opacity-80 cursor-wait"
              >
                <RefreshCw className="w-4 h-4 animate-spin text-[#B7F36B]" />
                <span>Verifying Account Status...</span>
              </button>
            ) : !hasValidVipStats ? (
              <button
                type="button"
                onClick={() => refreshFounderStats()}
                disabled={isLoadingVipStats}
                className="w-full py-3.5 px-4 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] text-[#F7F8F5] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer border border-[#30362E] disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-[#B7F36B] ${isLoadingVipStats ? "animate-spin" : ""}`} />
                <span>{isLoadingVipStats ? "Checking VIP Seat Availability..." : "Retry VIP Seat Check"}</span>
              </button>
            ) : (spotsRemaining as number) <= 0 ? (
              <button
                type="button"
                disabled
                className="w-full py-3.5 px-4 rounded-xl bg-[#1B1F1A] text-[#777E74] text-xs font-bold text-center cursor-not-allowed border border-[#30362E]"
              >
                All 50 VIP Seats Occupied
              </button>
            ) : (
              <button
                id="claim-founder-spot-btn"
                type="button"
                onClick={handleClaimFreeFounder}
                disabled={isClaimingFounder}
                className="w-full py-3.5 px-4 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-[2px_2px_8px_rgba(0,0,0,0.4)] disabled:opacity-50"
              >
                {isClaimingFounder ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#10130D]" />
                    <span>Allocating VIP Seat...</span>
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4 text-[#10130D] fill-current" />
                    <span>Claim Free VIP Seat ({spotsRemaining} Available)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. Complete Plan Comparison Matrix Table */}
      <div id="plan-comparison-section" className="space-y-6 pt-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#F7F8F5] tracking-tight">
            Detailed Plan Comparison
          </h2>
          <p className="text-xs sm:text-sm text-[#A5AAA1]">
            Compare all features across Free, Monthly, Yearly, Lifetime, and VIP Access tiers.
          </p>
        </div>

        <div className="rounded-3xl border border-[#30362E] bg-[#141714] overflow-hidden shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.025)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-[#30362E] bg-[#0D0F0D] text-[#F7F8F5]">
                  <th className="p-4 sm:p-5 font-bold text-xs uppercase tracking-wider text-[#A5AAA1] sticky left-0 bg-[#0D0F0D] z-10">
                    Feature
                  </th>
                  <th className="p-4 sm:p-5 font-bold text-center">
                    <div>Free</div>
                    <div className="text-[10px] text-[#777E74] font-normal">PKR 0</div>
                  </th>
                  <th className="p-4 sm:p-5 font-bold text-center">
                    <div>Monthly</div>
                    <div className="text-[10px] text-[#A5AAA1] font-bold">PKR 249 / mo (Coming Soon)</div>
                  </th>
                  <th className="p-4 sm:p-5 font-bold text-center bg-[#1B1F1A]/80 border-x border-[#30362E]">
                    <div className="text-[#B7F36B]">Yearly</div>
                    <div className="text-[10px] text-[#B7F36B] font-bold">PKR 1,999 / yr (Coming Soon)</div>
                  </th>
                  <th className="p-4 sm:p-5 font-bold text-center">
                    <div>Lifetime</div>
                    <div className="text-[10px] text-[#A5AAA1] font-bold">PKR 5,999 once (Coming Soon)</div>
                  </th>
                  <th className="p-4 sm:p-5 font-bold text-center bg-[#1B1F1A]/80 border-l border-[#30362E]">
                    <div className="text-[#B7F36B]">VIP User</div>
                    <div className="text-[10px] text-[#B7F36B] font-bold">FREE (50 VIP Seats)</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30362E] text-[#A5AAA1]">
                {/* Row 1: Screenshot limit */}
                <tr className="hover:bg-white/[0.02] transition">
                  <td className="p-4 sm:p-5 font-semibold text-[#F7F8F5] sticky left-0 bg-[#141714] z-10">
                    AI-Indexed Screenshots Limit
                  </td>
                  <td className="p-4 sm:p-5 text-center text-[#777E74] font-medium">250 lifetime</td>
                  <td className="p-4 sm:p-5 text-center text-[#F7F8F5] font-bold">2,500 / month</td>
                  <td className="p-4 sm:p-5 text-center text-[#B7F36B] font-bold bg-[#1B1F1A]/40 border-x border-[#30362E]">
                    30,000 / year
                  </td>
                  <td className="p-4 sm:p-5 text-center text-[#F7F8F5] font-bold">100,000 lifetime</td>
                  <td className="p-4 sm:p-5 text-center text-[#B7F36B] font-bold bg-[#1B1F1A]/40 border-l border-[#30362E]">
                    150,000 lifetime
                  </td>
                </tr>

                {/* Row 2: OCR Extraction */}
                <tr className="hover:bg-white/[0.02] transition">
                  <td className="p-4 sm:p-5 font-semibold text-[#F7F8F5] sticky left-0 bg-[#141714] z-10">
                    On-Device OCR Text Extraction
                  </td>
                  <td className="p-4 sm:p-5 text-center text-[#B7F36B] font-bold">✓ Included</td>
                  <td className="p-4 sm:p-5 text-center text-[#B7F36B] font-bold">✓ Included</td>
                  <td className="p-4 sm:p-5 text-center text-[#B7F36B] font-bold bg-[#1B1F1A]/40 border-x border-[#30362E]">
                    ✓ Included
                  </td>
                  <td className="p-4 sm:p-5 text-center text-[#B7F36B] font-bold">✓ Included</td>
                  <td className="p-4 sm:p-5 text-center text-[#B7F36B] font-bold bg-[#1B1F1A]/40 border-l border-[#30362E]">
                    ✓ Included
                  </td>
                </tr>

                {/* Row 3: Multimodal AI Search */}
                <tr className="hover:bg-white/[0.02] transition">
                  <td className="p-4 sm:p-5 font-semibold text-[#F7F8F5] sticky left-0 bg-[#141714] z-10">
                    Multimodal AI Search
                  </td>
                  <td className="p-4 sm:p-5 text-center text-[#777E74]">Basic only</td>
                  <td className="p-4 sm:p-5 text-center text-[#F7F8F5] font-bold">✓ Full AI</td>
                  <td className="p-4 sm:p-5 text-center text-[#B7F36B] font-bold bg-[#1B1F1A]/40 border-x border-[#30362E]">
                    ✓ Full AI (Priority)
                  </td>
                  <td className="p-4 sm:p-5 text-center text-[#F7F8F5] font-bold">✓ Full AI</td>
                  <td className="p-4 sm:p-5 text-center text-[#B7F36B] font-bold bg-[#1B1F1A]/40 border-l border-[#30362E]">
                    ✓ Full AI (Priority)
                  </td>
                </tr>

                {/* Row 4: Cloud Sync & Backup */}
                <tr className="hover:bg-white/[0.02] transition">
                  <td className="p-4 sm:p-5 font-semibold text-[#F7F8F5] sticky left-0 bg-[#141714] z-10">
                    Cloud Sync &amp; Multi-Device
                  </td>
                  <td className="p-4 sm:p-5 text-center text-[#777E74]">Local only</td>
                  <td className="p-4 sm:p-5 text-center text-[#F7F8F5] font-bold">✓ Included</td>
                  <td className="p-4 sm:p-5 text-center text-[#B7F36B] font-bold bg-[#1B1F1A]/40 border-x border-[#30362E]">
                    ✓ Included
                  </td>
                  <td className="p-4 sm:p-5 text-center text-[#F7F8F5] font-bold">✓ Included</td>
                  <td className="p-4 sm:p-5 text-center text-[#B7F36B] font-bold bg-[#1B1F1A]/40 border-l border-[#30362E]">
                    ✓ Included
                  </td>
                </tr>

                {/* Row 5: Founder Badge & Rank */}
                <tr className="hover:bg-white/[0.02] transition">
                  <td className="p-4 sm:p-5 font-semibold text-[#F7F8F5] sticky left-0 bg-[#141714] z-10">
                    VIP Badge &amp; Seat Number
                  </td>
                  <td className="p-4 sm:p-5 text-center text-[#777E74]">-</td>
                  <td className="p-4 sm:p-5 text-center text-[#777E74]">-</td>
                  <td className="p-4 sm:p-5 text-center text-[#777E74] bg-[#1B1F1A]/40 border-x border-[#30362E]">-</td>
                  <td className="p-4 sm:p-5 text-center text-[#777E74]">-</td>
                  <td className="p-4 sm:p-5 text-center text-[#B7F36B] font-bold bg-[#1B1F1A]/40 border-l border-[#30362E]">
                    Rank #1-50
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 6. Transparency & Trust FAQ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="p-5 rounded-2xl bg-[#141714] border border-[#30362E] shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.025)] space-y-2">
          <div className="flex items-center gap-2 text-[#F7F8F5] font-bold text-sm">
            <Lock className="w-4 h-4 text-[#B7F36B]" />
            <span>Secure &amp; Private</span>
          </div>
          <p className="text-xs text-[#A5AAA1] leading-relaxed">
            All screenshot OCR indexing and processing happens locally on your device with high-grade privacy protection.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#141714] border border-[#30362E] shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.025)] space-y-2">
          <div className="flex items-center gap-2 text-[#F7F8F5] font-bold text-sm">
            <Clock className="w-4 h-4 text-[#B7F36B]" />
            <span>Payment Gateway in Progress</span>
          </div>
          <p className="text-xs text-[#A5AAA1] leading-relaxed">
            Paid checkouts are currently in preparation. Claim an available free VIP Seat or enjoy the 250 AI-indexed screenshot Free tier.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#141714] border border-[#30362E] shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.025)] space-y-2">
          <div className="flex items-center gap-2 text-[#F7F8F5] font-bold text-sm">
            <Crown className="w-4 h-4 text-[#B7F36B]" />
            <span>Real Database Scarcity</span>
          </div>
          <p className="text-xs text-[#A5AAA1] leading-relaxed">
            VIP seats are strictly limited to 50 members backed by atomic verification.
          </p>
        </div>
      </div>

      {/* 7. Payment History & Transaction Status */}
      <PaymentHistoryCard
        user={user}
        isDark={isDark}
        onOpenUpgradeModal={() => handlePaidPlanClick("Pro Lifetime (PKR 5,999 once)")}
      />

      {/* 8. Coming Soon Informational Modal for Paid Plans */}
      {showComingSoonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#141714] border border-[#30362E] p-6 sm:p-7 text-center space-y-5 shadow-[8px_8px_24px_rgba(0,0,0,0.85)] relative">
            <button
              type="button"
              onClick={() => setShowComingSoonModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-[#A5AAA1] hover:text-[#F7F8F5] hover:bg-[#1B1F1A] transition cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-[#1B1F1A] border border-[#30362E] mx-auto flex items-center justify-center text-[#B7F36B] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4)]">
              <Clock className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-[#F7F8F5]">Payment Integration Coming Soon</h3>
              <p className="text-xs text-[#A5AAA1] leading-relaxed">
                Direct online payment for <span className="font-semibold text-[#F7F8F5]">{comingSoonPlanName}</span> is currently under active integration. No credit card charges or fake transactions are accepted.
              </p>
              {hasValidVipStats && (spotsRemaining as number) > 0 && (
                <p className="text-xs text-[#B7F36B] bg-[#1B1F1A] p-3 rounded-xl border border-[#30362E] leading-relaxed font-medium">
                  You can claim an available <span className="font-bold text-[#F7F8F5]">Free VIP Seat</span> right now ({spotsRemaining} of {totalVipSeats} available) for 150,000 AI-indexed screenshots with zero payment required.
                </p>
              )}
            </div>

            <div className="space-y-3 pt-2">
              {!isFounder && hasValidVipStats && (spotsRemaining as number) > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowComingSoonModal(false);
                    handleClaimFreeFounder();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-[2px_2px_8px_rgba(0,0,0,0.4)]"
                >
                  <Crown className="w-4 h-4 text-[#10130D] fill-current" />
                  <span>Claim Free VIP Seat ({spotsRemaining} Available)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowComingSoonModal(false)}
                className="w-full py-3 px-4 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] text-[#F7F8F5] border border-[#30362E] text-xs font-bold transition cursor-pointer shadow-[2px_2px_8px_rgba(0,0,0,0.3)]"
              >
                Back to Plans
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Auth Required Modal for Unauthenticated Users */}
      {showAuthRequiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#141714] border border-[#30362E] p-6 sm:p-7 text-center space-y-5 shadow-[8px_8px_24px_rgba(0,0,0,0.85)] relative">
            <button
              type="button"
              onClick={() => setShowAuthRequiredModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-[#A5AAA1] hover:text-[#F7F8F5] hover:bg-[#1B1F1A] transition cursor-pointer"
              aria-label="Close auth required dialog"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-[#1B1F1A] border border-[#30362E] mx-auto flex items-center justify-center text-[#B7F36B] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4)]">
              <Lock className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-[#F7F8F5]">Sign In Required</h3>
              <p className="text-xs text-[#A5AAA1] leading-relaxed">
                Please sign in to continue with your purchase of the <span className="font-semibold text-[#F7F8F5]">{authModalPlanName}</span>. Your subscription will be securely linked to your account.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAuthRequiredModal(false);
                  if (onOpenAuth) onOpenAuth();
                }}
                className="w-full py-3 px-4 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-[2px_2px_8px_rgba(0,0,0,0.4)]"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAuthRequiredModal(false);
                  if (onOpenAuth) onOpenAuth();
                }}
                className="w-full py-3 px-4 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] text-[#F7F8F5] border border-[#30362E] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-[2px_2px_8px_rgba(0,0,0,0.3)]"
              >
                <UserPlus className="w-4 h-4 text-[#B7F36B]" />
                <span>Create Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Review Modal */}
      {isAdmin && (
        <AdminPaymentRequestsModal
          isOpen={showAdminModal}
          onClose={() => setShowAdminModal(false)}
          user={user}
          isDark={isDark}
          addToast={addToast}
        />
      )}
    </div>
  );
};

export default PricingPageView;
