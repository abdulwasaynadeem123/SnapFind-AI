import React, { useState, useRef, useEffect } from "react";
import { Crown, CheckCircle2, AlertCircle, Loader2, ShieldCheck, Layers, Cloud, X } from "lucide-react";

interface VipSeatInvitationModalProps {
  isOpen: boolean;
  signupNumber?: number;
  totalSpots?: number;
  onClaim: () => Promise<{
    success: boolean;
    founderNumber?: number;
    message?: string;
    error?: string;
  }>;
  onMaybeLater: () => void;
  onCloseAfterClaim: (founderNumber: number) => void;
}

export const VipSeatInvitationModal: React.FC<VipSeatInvitationModalProps> = ({
  isOpen,
  signupNumber,
  totalSpots = 50,
  onClaim,
  onMaybeLater,
  onCloseAfterClaim,
}) => {
  const [isClaiming, setIsClaiming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [claimedNumber, setClaimedNumber] = useState<number | null>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isClaiming) {
        if (claimedNumber !== null) {
          onCloseAfterClaim(claimedNumber);
        } else {
          onMaybeLater();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isClaiming, claimedNumber, onMaybeLater, onCloseAfterClaim]);

  if (!isOpen) return null;

  const safeTotal = totalSpots || 50;

  const handleClaimClick = async () => {
    if (isSubmittingRef.current || isClaiming) return;
    isSubmittingRef.current = true;
    setIsClaiming(true);
    setErrorMsg(null);

    try {
      const result = await onClaim();
      if (result.success && typeof result.founderNumber === "number" && result.founderNumber >= 1) {
        setClaimedNumber(result.founderNumber);
      } else {
        setErrorMsg(
          result.error || "Unable to claim a VIP seat right now. Please try again."
        );
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message || "Unable to claim a VIP seat right now. Please try again."
      );
    } finally {
      isSubmittingRef.current = false;
      setIsClaiming(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vip-invitation-title"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#080908]/85 p-4"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[#30362E] bg-[#141714] p-6 sm:p-7 text-[#F7F8F5] shadow-[0_24px_64px_rgba(0,0,0,0.85)]">
        <button
          type="button"
          onClick={() => {
            if (isClaiming) return;
            if (claimedNumber !== null) {
              onCloseAfterClaim(claimedNumber);
            } else {
              onMaybeLater();
            }
          }}
          disabled={isClaiming}
          aria-label="Close VIP seat invitation"
          className="absolute right-4 top-4 rounded-xl border border-[#30362E] bg-[#1B1F1A] p-2 text-[#A5AAA1] transition-colors hover:bg-[#222720] hover:text-[#F7F8F5] disabled:opacity-50 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {claimedNumber !== null ? (
          <div className="space-y-5 pt-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#B7F36B] bg-[#1B1F1A] text-[#B7F36B]">
              <Crown className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#30362E] bg-[#1B1F1A] px-2.5 py-1 text-xs font-bold text-[#B7F36B]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Lifetime Free Verified</span>
              </div>
              <h2
                id="vip-invitation-title"
                className="text-2xl font-bold tracking-tight text-[#F7F8F5]"
              >
                Lifetime Free Member #{claimedNumber}
              </h2>
              <p className="text-sm leading-relaxed text-[#A5AAA1]">
                Your permanent Lifetime Free Pro access is now active on your account. You have Lifetime Free Pro access with up to 150,000 AI-indexed screenshots.
              </p>
            </div>

            <div className="rounded-xl border border-[#30362E] bg-[#0D0F0D] p-4 space-y-2 text-xs text-[#A5AAA1]">
              <div className="flex items-center justify-between">
                <span>Assigned Seat</span>
                <span className="font-mono font-bold text-[#B7F36B]">
                  Early signup #{signupNumber || claimedNumber} of {safeTotal}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Indexing Limit</span>
                <span className="font-mono font-bold text-[#F7F8F5]">150,000 screenshots</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Cloud Sync &amp; Priority Queue</span>
                <span className="font-semibold text-[#B7F36B]">Unlocked</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onCloseAfterClaim(claimedNumber)}
              className="w-full rounded-xl bg-[#B7F36B] px-4 py-3 text-sm font-bold text-[#080908] transition-colors hover:bg-[#A5E65A] cursor-pointer"
            >
              Continue to SnapFind
            </button>
          </div>
        ) : (
          <div className="space-y-5 pt-1">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#30362E] bg-[#1B1F1A] text-[#B7F36B]">
                <Crown className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#B7F36B]">
                  FIRST {safeTotal} SIGNUPS
                </span>
                <h2
                  id="vip-invitation-title"
                  className="text-xl sm:text-2xl font-bold tracking-tight text-[#F7F8F5]"
                >
                  Claim Lifetime Free
                </h2>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-[#A5AAA1]">
              You are among the first 50 new SnapFind accounts. Claim permanent Pro access at no cost — forever.
            </p>

            {/* VIP Benefits Summary */}
            <div className="space-y-2 text-xs text-[#A5AAA1]">
              <div className="flex items-center gap-2.5">
                <Layers className="h-4 w-4 shrink-0 text-[#B7F36B]" />
                <span>150,000 AI-indexed screenshots lifetime capacity (Free forever)</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Cloud className="h-4 w-4 shrink-0 text-[#B7F36B]" />
                <span>Private cloud sync &amp; priority OCR processing queue</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#B7F36B]" />
                <span>Permanent VIP Member badge (#1–#{safeTotal}) tied to your account</span>
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                aria-live="polite"
                className="flex items-start gap-2.5 rounded-xl border border-rose-700 bg-rose-950 p-3.5 text-xs text-rose-100"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleClaimClick}
                disabled={isClaiming}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#B7F36B] px-4 py-3 text-sm font-bold text-[#080908] transition-colors hover:bg-[#A5E65A] disabled:opacity-50 cursor-pointer"
              >
                {isClaiming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Activating Lifetime Free...</span>
                  </>
                ) : errorMsg ? (
                  <span>Retry Claim</span>
                ) : (
                  <span>Claim Lifetime Free</span>
                )}
              </button>
              <button
                type="button"
                onClick={onMaybeLater}
                disabled={isClaiming}
                className="rounded-xl border border-[#30362E] bg-[#1B1F1A] px-4 py-3 text-sm font-semibold text-[#F7F8F5] transition-colors hover:bg-[#222720] disabled:opacity-50 cursor-pointer"
              >
                Maybe Later
              </button>
            </div>

            <p className="text-[11px] text-[#777E74]">
              If you choose Maybe Later, we'll add a notification so you can return and claim your Lifetime Free offer later.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
