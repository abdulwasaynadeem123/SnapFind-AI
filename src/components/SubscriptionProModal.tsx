import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Check,
  Shield,
  Zap,
  Layers,
  Search,
  X,
  AlertCircle,
  CheckCircle2,
  Crown,
  Smartphone,
  Building2,
  ArrowRight,
  Infinity as InfinityIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { ManualPaymentModal } from "./subscription/ManualPaymentModal";
import { PaymentRequest } from "../types";

interface SubscriptionProModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFeature?: string;
  onOpenAuth?: () => void;
  addToast?: (toast: { title: string; description?: string; type: "success" | "error" | "info" }) => void;
}

export const SubscriptionProModal: React.FC<SubscriptionProModalProps> = ({
  isOpen,
  onClose,
  initialFeature,
  onOpenAuth,
  addToast,
}) => {
  const { user, isPro, refreshEntitlement } = useAuth();
  const [showManualModal, setShowManualModal] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isFounder = Boolean(user?.entitlement?.isFounder);
  const founderNumber = user?.entitlement?.founderNumber;

  const handleOpenManualPayment = () => {
    setShowManualModal(true);
  };

  return (
    <>
      <div
        id="subscription-pro-modal-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg rounded-3xl bg-[#1E293B] border border-[#334155] text-[#F1F5F9] shadow-2xl overflow-hidden my-6"
        >
          {/* Header Ambient Glow */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-[#116466]/20 to-[#D1E8E2]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

          {/* Close Button */}
          <button
            id="close-pro-modal-btn"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6 sm:p-8 space-y-6 relative z-10">
            {/* Crown / Icon & Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-[#116466]/20 border border-[#116466]/40 text-[#D1E8E2] mb-1 shadow-lg shadow-[#116466]/15">
                <Sparkles className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <h3 className="text-2xl font-black tracking-tight text-[#F1F5F9]">
                  Unlock SnapFind Lifetime Pro
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Unlimited screenshots, on-device OCR, AI search, and permanent lifetime access.
                </p>
              </div>

              {initialFeature && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#116466]/20 border border-[#116466]/40 text-xs text-[#D1E8E2] font-medium mt-1">
                  <span>Required for: <strong>{initialFeature}</strong></span>
                </div>
              )}
            </div>

            {/* Founder Status Banner if active */}
            {isFounder ? (
              <div className="p-4 rounded-2xl bg-[#D9B08C]/15 border border-[#D9B08C]/35 text-[#D9B08C] space-y-1.5 text-center">
                <div className="flex items-center justify-center gap-2 font-bold text-sm">
                  <Crown className="w-4 h-4 text-[#D9B08C]" />
                  <span>Founder VIP #{founderNumber || "VIP"} Active</span>
                </div>
                <p className="text-xs text-[#F1F5F9]/80">
                  You already have permanent complimentary Lifetime Pro access!
                </p>
              </div>
            ) : (
              /* Lifetime Pro Pricing & Payment Options */
              <div className="space-y-4">
                {/* Lifetime Deal Card */}
                <div className="p-5 rounded-2xl bg-[#2C3531] border-2 border-[#116466] space-y-3 relative overflow-hidden shadow-xl shadow-[#116466]/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#116466] text-[#D1E8E2]">
                        One-Time Payment
                      </span>
                      <span className="text-xs font-bold text-slate-300">Lifetime Pass</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-[#D1E8E2]">PKR 7,999</span>
                      <span className="text-[10px] text-slate-400 block font-medium">No recurring fees</span>
                    </div>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-200 pt-2 border-t border-[#334155]">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#D1E8E2] shrink-0" />
                      <span><strong>25,000 screenshots</strong> (Free limit: 70)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#D1E8E2] shrink-0" />
                      <span>Permanent Lifetime Access • Never expires</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#D1E8E2] shrink-0" />
                      <span>On-device OCR & Gemini AI search</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#D1E8E2] shrink-0" />
                      <span>Encrypted cloud backup & multi-device sync</span>
                    </li>
                  </ul>
                </div>

                {/* Supported Payment Methods Note */}
                <div className="p-3.5 rounded-xl bg-[#2C3531] border border-[#334155] space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Supported Manual Payment Methods:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-[#116466]/15 border border-[#116466]/30 text-[#D1E8E2] flex items-center gap-2">
                      <Smartphone className="w-4 h-4 shrink-0 text-[#D1E8E2]" />
                      <div>
                        <p className="font-bold">Easypaisa</p>
                        <p className="text-[10px] opacity-80">Mobile Wallet</p>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-[#116466]/15 border border-[#116466]/30 text-[#D1E8E2] flex items-center gap-2">
                      <Building2 className="w-4 h-4 shrink-0 text-[#D1E8E2]" />
                      <div>
                        <p className="font-bold">Bank Transfer</p>
                        <p className="text-[10px] opacity-80">IBFT / Raast</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary CTA */}
                <button
                  id="pay-with-easypaisa-or-bank-btn"
                  onClick={handleOpenManualPayment}
                  className="w-full py-4 px-4 rounded-2xl font-black text-sm bg-[#116466] hover:bg-[#16787b] text-white flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(17,100,102,0.4)] transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.98]"
                >
                  <Sparkles className="w-4 h-4 text-[#D1E8E2] fill-current" />
                  <span>Get Lifetime Pro for PKR 7,999</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <p className="text-[11px] text-center text-slate-400 pt-1">
              Admin manual verification ensures 100% security. No credit card or automated recurring charge.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Step-by-Step Manual Payment Modal */}
      <ManualPaymentModal
        isOpen={showManualModal}
        onClose={() => {
          setShowManualModal(false);
          onClose();
        }}
        user={user}
        isDark={true}
        onOpenAuth={onOpenAuth}
        onPaymentSubmitted={(req) => {
          refreshEntitlement();
          addToast?.({
            title: "Payment Confirmation Submitted",
            description: "Your payment is pending admin review. Lifetime Pro activates upon approval.",
            type: "success",
          });
        }}
        addToast={addToast}
      />
    </>
  );
};
