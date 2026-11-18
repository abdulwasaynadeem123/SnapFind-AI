import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Crown, Sparkles, Check, ArrowRight, X, Shield, Zap, Cloud } from "lucide-react";
import { SubscriptionManager } from "../../services/billing/SubscriptionManager";
import { CurrencyService, CANONICAL_PRICING_USD } from "../../services/billing/CurrencyService";
import { useFounder } from "../../context/FounderContext";
import { useAuth } from "../../context/AuthContext";
import { UserProfile } from "../../types";

interface SignupUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToPricing: () => void;
  user?: UserProfile | null;
  addToast?: (toast: { title: string; description?: string; type: "success" | "error" | "info" }) => void;
  onFounderClaimed?: () => void;
  isDark?: boolean;
}

export const SignupUpgradeModal: React.FC<SignupUpgradeModalProps> = ({
  isOpen,
  onClose,
  onNavigateToPricing,
  user,
  addToast,
  onFounderClaimed,
  isDark = true,
}) => {
  const { entitlement, loading: authLoading, refreshEntitlement } = useAuth();
  const [isClaiming, setIsClaiming] = useState(false);
  const {
    claimed: rawClaimed,
    totalSpots = 50,
    remaining: rawRemaining,
    isLoading: isLoadingVip,
    error: vipError,
    refreshFounderStats,
    claimFounderSpot,
  } = useFounder();

  const hasValidVipStats =
    !vipError &&
    typeof rawClaimed === "number" &&
    typeof rawRemaining === "number";
  const claimedSpots = hasValidVipStats ? Math.max(0, Math.min(totalSpots, rawClaimed as number)) : null;
  const remainingSpots = hasValidVipStats ? Math.max(0, totalSpots - (claimedSpots as number)) : null;

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

  useEffect(() => {
    if (isOpen) {
      refreshFounderStats();
    }
  }, [isOpen, refreshFounderStats]);

  const handleClaimFounder = async () => {
    if (!user || user.id === "guest" || user.id.startsWith("local-guest")) {
      addToast?.({
        title: "Sign-In Required",
        description: "Please create an account or sign in to claim your VIP Seat.",
        type: "error",
      });
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
        if (onFounderClaimed) onFounderClaimed();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        addToast?.({
          title: "VIP Allocation Notice",
          description: res.error || "All 50 VIP seats have been occupied. You can upgrade to Pro anytime!",
          type: "info",
        });
      }
    } catch (err: any) {
      addToast?.({
        title: "Claim Failed",
        description: err.message || "Failed to claim VIP Seat.",
        type: "error",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-[#141714] border border-[#30362E] text-[#F7F8F5] shadow-2xl"
        >
          {/* Subtle decorative glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-[#B7F36B]/5 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 right-0 w-60 h-60 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition z-10 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6 sm:p-8 space-y-6 relative z-10">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1B1F1A] border border-[#30362E] text-amber-300 text-xs font-bold tracking-wide">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>WELCOME TO SNAPFIND AI</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#F7F8F5] tracking-tight">
                {isFounder ? (
                  "Welcome, VIP User!"
                ) : hasValidVipStats && (remainingSpots as number) > 0 ? (
                  <>
                    Claim Your Free <span className="text-[#B7F36B]">VIP Seat</span>
                  </>
                ) : (
                  "Choose Your SnapFind AI Plan"
                )}
              </h2>
              <p className="text-xs sm:text-sm text-[#A5AAA1] max-w-md mx-auto">
                {isFounder
                  ? `Your account is permanently upgraded with Lifetime Pro and ${founderNumber ? `VIP Seat #${founderNumber} of 50` : "your VIP Seat"}.`
                  : hasValidVipStats && (remainingSpots as number) > 0
                  ? "Claim 1 of 50 VIP seats for 100% free Lifetime Pro access, 150,000 screenshots, and a permanent VIP Badge."
                  : "Supercharge your workflow with instant OCR, multimodal AI vision search, and cloud sync."}
              </p>
            </div>

            {!isFounder && authLoading ? (
              <div className="rounded-2xl p-4 bg-[#1B1F1A] border border-[#30362E] text-center text-xs text-[#A5AAA1]">
                Verifying your account entitlement...
              </div>
            ) : !isFounder && !hasValidVipStats ? (
              <div className="rounded-2xl p-4 bg-[#1B1F1A] border border-[#30362E] flex items-center justify-between gap-3">
                <span className="text-xs text-[#A5AAA1]">
                  {isLoadingVip ? "Loading live VIP seat availability..." : vipError || "VIP seat availability temporarily unavailable."}
                </span>
                {!isLoadingVip && (
                  <button
                    type="button"
                    onClick={() => refreshFounderStats()}
                    className="px-3 py-1.5 rounded-xl bg-[#B7F36B] text-[#10130D] text-xs font-bold cursor-pointer shrink-0"
                  >
                    Retry
                  </button>
                )}
              </div>
            ) : !isFounder && hasValidVipStats && (remainingSpots as number) > 0 ? (
              <div className="rounded-2xl p-5 bg-[#141714] border border-[#30362E] space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-[#1B1F1A] border border-[#30362E] text-[#B7F36B]">
                      <Crown className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#F7F8F5]">VIP Program Offer</div>
                      <div className="text-xs text-[#B7F36B]">Lifetime Access · PKR 0 Forever</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-[#B7F36B]">
                      {claimedSpots} / {totalSpots} occupied
                    </span>
                    <div className="w-24 bg-[#0D0F0D] rounded-full h-1.5 mt-1 overflow-hidden border border-[#30362E]">
                      <div
                        className="bg-[#B7F36B] h-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(0, ((claimedSpots as number) / totalSpots) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#30362E]">
                  <div className="text-xs font-bold text-[#A5AAA1] uppercase tracking-wider">
                    VIP Access Benefits ({remainingSpots} of {totalSpots} seats available)
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#F7F8F5]">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                      <span>Official VIP Badge (#1–#50) on account</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                      <span>100% Free Lifetime Pro access</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                      <span>150,000 AI-indexed screenshots</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                      <span>Multimodal Vision AI search</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                      <span>Multi-device encrypted cloud sync</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                      <span>Zero subscription fees forever</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={handleClaimFounder}
                  disabled={isClaiming}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] font-bold text-sm flex items-center justify-center gap-2 transition duration-200 cursor-pointer active:scale-[0.98]"
                >
                  <Crown className="w-4 h-4" />
                  <span>{isClaiming ? "Allocating VIP Seat..." : `Claim Free VIP Seat (${remainingSpots} Available)`}</span>
                </button>
              </div>
            ) : isFounder ? (
              <div className="rounded-2xl p-5 bg-[#1B1F1A] border border-[#30362E] text-center space-y-3">
                <Crown className="w-8 h-8 text-[#B7F36B] mx-auto" />
                <div className="text-lg font-bold text-[#B7F36B]">
                  VIP User • {founderNumber ? `VIP Seat #${founderNumber} Active` : "VIP Seat Active"}
                </div>
                <p className="text-xs text-[#A5AAA1]">
                  Your account enjoys permanent Lifetime Pro access. You will never be asked to pay or subscribe.
                </p>
              </div>
            ) : null}

            {/* Plan Overview & Pricing Page Lead */}
            <div className="rounded-2xl p-4 bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold text-white">SnapFind AI Plans Available:</span>
                <span className="text-[#A5AAA1]">Free (250) · Pro (PKR 249/mo or 1,999/yr) · Lifetime (PKR 5,999)</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-[#1B1F1A] border border-[#30362E]">
                  <div className="font-bold text-[#F7F8F5]">Free</div>
                  <div className="text-[11px] text-[#A5AAA1]">250 items</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#1B1F1A] border border-[#30362E]">
                  <div className="font-bold text-[#F7F8F5]">Pro</div>
                  <div className="text-[11px] text-[#A5AAA1]">PKR 249 / mo</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#1B1F1A] border border-[#B7F36B]/50">
                  <div className="font-bold text-[#B7F36B]">Lifetime</div>
                  <div className="text-[11px] text-[#A5AAA1]">PKR 5,999 once</div>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={() => {
                  onClose();
                  onNavigateToPricing();
                }}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#080908] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition duration-200 cursor-pointer shadow-lg shadow-blue-600/20"
              >
                <span>View Full Pricing & Plans</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onClose}
                className="w-full sm:w-auto py-3 px-5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-medium text-xs sm:text-sm transition duration-200 cursor-pointer"
              >
                Continue to App
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
