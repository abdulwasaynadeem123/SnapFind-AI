import React, { useState } from "react";
import { AlertCircle, Sparkles, X, ArrowRight, Clock, HardDrive } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../context/AuthContext";
import { getResetDateString } from "./featureUpgradeConfig";
import { UsageProgress } from "./UsageProgress";
import { UpgradeModal } from "./UpgradeModal";

export interface UsageLimitBannerProps {
  used: number;
  limit: number;
  type?: "aiScans" | "screenshots";
  onUpgradeClick?: () => void;
  isDark?: boolean;
  className?: string;
}

export const UsageLimitBanner: React.FC<UsageLimitBannerProps> = ({
  used,
  limit,
  type = "aiScans",
  onUpgradeClick,
  isDark = true,
  className = "",
}) => {
  const { isPro, entitlement } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isFounder = Boolean(entitlement?.isFounder);
  if (isPro || isFounder || isDismissed) return null;

  const percent = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  // Show banner only if usage is 80% or more (approaching or exceeded)
  if (percent < 80) return null;

  const isExceeded = used >= limit;
  const unit = type === "aiScans" ? "AI vision scans" : "screenshots";
  const resetDate = getResetDateString();

  const title = isExceeded
    ? type === "aiScans"
      ? "You've reached your free monthly AI processing limit."
      : "You've reached your free screenshot indexing limit."
    : type === "aiScans"
    ? "You're approaching your monthly AI scan limit."
    : "You're approaching your screenshot limit.";

  const handleOpenUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className={`rounded-2xl p-4 sm:p-5 border relative overflow-hidden transition-all shadow-md ${
            isDark
              ? isExceeded
                ? "bg-rose-950/30 border-rose-500/30 text-white"
                : "bg-[#1E293B] border-[#D9B08C]/40 text-[#F1F5F9]"
              : isExceeded
              ? "bg-rose-50 border-rose-200 text-slate-900"
              : "bg-amber-50 border-amber-200 text-slate-900"
          } ${className}`}
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <div
                className={`p-2.5 rounded-xl border shrink-0 ${
                  isExceeded
                    ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                    : "bg-[#D9B08C]/15 border-[#D9B08C]/30 text-[#D9B08C]"
                }`}
              >
                {type === "aiScans" ? (
                  <Sparkles className="w-5 h-5" />
                ) : (
                  <HardDrive className="w-5 h-5" />
                )}
              </div>

              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold tracking-tight">{title}</h4>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      isExceeded
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        : "bg-[#D9B08C]/20 text-[#D9B08C] border border-[#D9B08C]/30"
                    }`}
                  >
                    {percent}% Used
                  </span>
                </div>

                <p className={`text-xs ${isDark ? "text-[#94A3B8]" : "text-slate-600"}`}>
                  Used{" "}
                  <strong className="font-mono text-[#F1F5F9]">
                    {used.toLocaleString()} / {limit.toLocaleString()} {unit}
                  </strong>
                  . Free quota resets on <strong className="font-mono text-[#F1F5F9]">{resetDate}</strong>.
                  Normal searching remains available.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 justify-end">
              <button
                type="button"
                onClick={handleOpenUpgrade}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#116466] hover:bg-[#116466]/90 text-[#F1F5F9] shadow-sm shadow-[#116466]/20 flex items-center gap-1.5 transition-all active:scale-98 cursor-pointer"
              >
                <span>Upgrade to Pro</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsDismissed(true)}
                className={`p-2 rounded-xl text-xs transition-all cursor-pointer ${
                  isDark
                    ? "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#243347]"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-200"
                }`}
                aria-label="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <UpgradeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        feature={type === "aiScans" ? "aiLimit" : "screenshotQuota"}
        usageInfo={{
          used,
          limit,
          resetDate,
          unit,
        }}
        isDark={isDark}
      />
    </>
  );
};
