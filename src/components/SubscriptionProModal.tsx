import React, { useState, useEffect } from "react";
import {
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg rounded-3xl bg-[#141714] border border-[#30362E] text-[#F7F8F5] shadow-[8px_8px_24px_rgba(0,0,0,0.85)] overflow-hidden my-6"
        >
          {/* Close Button */}
          <button
            id="close-pro-modal-btn"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl bg-[#1B1F1A] border border-[#30362E] text-[#A5AAA1] hover:text-[#F7F8F5] hover:bg-[#222720] transition cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6 sm:p-8 space-y-6 relative z-10">
            {/* Crown / Icon & Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-[#1B1F1A] border border-[#30362E] text-[#B7F36B] mb-1 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.4)]">
                <Crown className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <h3 className="text-2xl font-bold tracking-tight text-[#F7F8F5]">
                  Unlock SnapFind Lifetime Pro
                </h3>
                <p className="text-xs text-[#A5AAA1] max-w-sm mx-auto">
                  Unlimited screenshots, on-device OCR, AI search, and permanent lifetime access.
                </p>
              </div>

              {initialFeature && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1B1F1A] border border-[#30362E] text-xs text-[#B7F36B] font-medium mt-1">
                  <span>Required for: <strong>{initialFeature}</strong></span>
                </div>
              )}
            </div>

            {/* Founder Status Banner if active */}
            {isFounder ? (
              <div className="p-4 rounded-2xl bg-[#1B1F1A] border border-[#30362E] text-[#B7F36B] space-y-1.5 text-center shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3)]">
                <div className="flex items-center justify-center gap-2 font-bold text-sm">
                  <Crown className="w-4 h-4 text-[#B7F36B]" />
                  <span>Founder VIP #{founderNumber || "VIP"} Active</span>
                </div>
                <p className="text-xs text-[#A5AAA1]">
                  You already have permanent complimentary Lifetime Pro access!
                </p>
              </div>
            ) : (
              /* Lifetime Pro Pricing & Payment Options */
              <div className="space-y-4">
                {/* Lifetime Deal Card */}
                <div className="p-5 rounded-2xl bg-[#0D0F0D] border border-[#30362E] space-y-3 relative overflow-hidden shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#1B1F1A] border border-[#30362E] text-[#B7F36B]">
                        One-Time Payment
                      </span>
                      <span className="text-xs font-bold text-[#A5AAA1]">Lifetime Pass</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-[#F7F8F5]">PKR 7,999</span>
                      <span className="text-[10px] text-[#777E74] block font-medium">No recurring fees</span>
                    </div>
                  </div>

                  <ul className="space-y-2 text-xs text-[#A5AAA1] pt-2 border-t border-[#30362E]">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#B7F36B] shrink-0" />
                      <span><strong className="text-[#F7F8F5]">25,000 screenshots</strong> (Free limit: 70)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#B7F36B] shrink-0" />
                      <span>Permanent Lifetime Access • Never expires</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#B7F36B] shrink-0" />
                      <span>On-device OCR &amp; AI vision search</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#B7F36B] shrink-0" />
                      <span>Encrypted cloud backup &amp; multi-device sync</span>
                    </li>
                  </ul>
                </div>

                {/* Supported Payment Methods Note */}
                <div className="p-3.5 rounded-xl bg-[#0D0F0D] border border-[#30362E] space-y-2">
                  <span className="text-[11px] font-bold text-[#777E74] uppercase tracking-wider block">
                    Supported Manual Payment Methods:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-[#141714] border border-[#30362E] text-[#F7F8F5] flex items-center gap-2 shadow-[2px_2px_8px_rgba(0,0,0,0.3)]">
                      <Smartphone className="w-4 h-4 shrink-0 text-[#B7F36B]" />
                      <div>
                        <p className="font-bold">Easypaisa</p>
                        <p className="text-[10px] text-[#A5AAA1]">Mobile Wallet</p>
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-[#141714] border border-[#30362E] text-[#F7F8F5] flex items-center gap-2 shadow-[2px_2px_8px_rgba(0,0,0,0.3)]">
                      <Building2 className="w-4 h-4 shrink-0 text-[#B7F36B]" />
                      <div>
                        <p className="font-bold">Bank Transfer</p>
                        <p className="text-[10px] text-[#A5AAA1]">IBFT / Raast</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary CTA */}
                <button
                  id="pay-with-easypaisa-or-bank-btn"
                  onClick={handleOpenManualPayment}
                  className="w-full py-4 px-4 rounded-xl font-bold text-sm bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] flex items-center justify-center gap-2 shadow-[2px_2px_8px_rgba(0,0,0,0.4)] transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.98]"
                >
                  <Crown className="w-4 h-4 text-[#10130D]" />
                  <span>Get Lifetime Pro for PKR 7,999</span>
                  <ArrowRight className="w-4 h-4 text-[#10130D]" />
                </button>
              </div>
            )}

            <p className="text-[11px] text-center text-[#777E74] pt-1">
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
