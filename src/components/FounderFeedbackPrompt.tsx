import React, { useState, useEffect } from "react";
import { MessageSquarePlus, Rocket, Crown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { FeedbackService } from "../services/feedbackService";

interface FounderFeedbackPromptProps {
  isDark: boolean;
  isFounder: boolean;
  onOpenFeedback: () => void;
  className?: string;
}

export const FounderFeedbackPrompt: React.FC<FounderFeedbackPromptProps> = ({
  isFounder,
  onOpenFeedback,
  className = "",
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isFounder && !FeedbackService.hasDismissedFounderPrompt()) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isFounder]);

  const handleDismiss = () => {
    FeedbackService.dismissFounderPrompt();
    setIsVisible(false);
  };

  const handleGiveFeedback = () => {
    FeedbackService.dismissFounderPrompt();
    setIsVisible(false);
    onOpenFeedback();
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.025)] bg-[#141714] border-[#30362E] text-[#F7F8F5] ${className}`}
      >
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 rounded-xl border shrink-0 bg-[#1B1F1A] border-[#30362E] text-[#B7F36B]">
              <Rocket className="w-5 h-5" />
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-[#B7F36B] flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5" />
                  VIP Program Exclusive
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-bold tracking-tight text-[#F7F8F5]">
                You hold one of SnapFind&apos;s 50 VIP Seats
              </h4>
              <p className="text-xs text-[#A5AAA1]">
                Help us make SnapFind better.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-1 sm:pt-0">
            <button
              onClick={handleDismiss}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-all text-[#A5AAA1] hover:text-[#F7F8F5] hover:bg-[#1B1F1A]"
            >
              Maybe Later
            </button>
            <button
              onClick={handleGiveFeedback}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] transition-all flex items-center gap-1.5 active:scale-95"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span>Give Feedback</span>
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
