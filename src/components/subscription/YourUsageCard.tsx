import React, { useState, useEffect } from "react";
import {
  Sparkles,
  HardDrive,
  Layers,
  Cloud,
  Calendar,
  RefreshCw,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  Info,
} from "lucide-react";
import { motion } from "motion/react";
import { ScreenshotItem, UserProfile } from "../../types";
import { UsageService, UsageMetrics } from "../../services/billing/UsageService";
import { ProBadge } from "./ProBadge";
import { FounderBadge } from "./FounderBadge";
import { useEntitlement } from "../../hooks/useEntitlement";

interface YourUsageCardProps {
  screenshots?: ScreenshotItem[];
  user?: UserProfile | null;
  isDark?: boolean;
  onOpenUpgrade?: (featureKey?: string) => void;
  onSyncNow?: () => void;
  compact?: boolean;
  className?: string;
  showDetailedBreakdown?: boolean;
}

export const YourUsageCard: React.FC<YourUsageCardProps> = ({
  screenshots = [],
  user,
  isDark = true,
  onOpenUpgrade,
  onSyncNow,
  compact = false,
  className = "",
}) => {
  const { entitlement, isPro, isFounder, promptUpgrade } = useEntitlement();
  const [metrics, setMetrics] = useState<UsageMetrics>(() =>
    UsageService.computeMetrics(screenshots, user?.id)
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Compute live metrics when screenshots, user, or entitlements change
  useEffect(() => {
    const updated = UsageService.computeMetrics(screenshots, user?.id);
    setMetrics(updated);

    // Subscribe to background usage updates
    const unsubscribe = UsageService.subscribe((newMetrics) => {
      setMetrics(newMetrics);
    });

    return () => unsubscribe();
  }, [screenshots, user?.id, entitlement]);

  // Initial and manual sync with authoritative server
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const serverData = await UsageService.syncWithServer(user?.id);
      if (serverData) {
        const updated = UsageService.computeMetrics(screenshots, user?.id, serverData.usage);
        setMetrics(updated);
      }
    } catch (err) {
      console.warn("Usage sync failed:", err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleUpgradeClick = () => {
    if (onOpenUpgrade) {
      onOpenUpgrade("aiScans");
    } else {
      promptUpgrade({
        feature: "aiScans",
        title: "Higher Processing Limits & Storage",
        subtitle:
          "Upgrade to SnapFind Pro for unlimited indexed screenshots, unlimited AI vision analyses, and encrypted multi-device cloud storage.",
      });
    }
  };

  return (
    <div
      id="your-usage-card"
      className={`rounded-2xl border transition-all ${
        isDark
          ? "bg-[#1E293B] border-[#334155] text-[#F1F5F9] shadow-xl shadow-black/40"
          : "bg-white border-zinc-200 text-zinc-900 shadow-sm"
      } ${compact ? "p-4" : "p-6"} ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#334155]">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isDark ? "bg-[#2C3531] border border-[#334155] text-[#D1E8E2]" : "bg-zinc-100 text-zinc-800"
            }`}
          >
            <Zap className="w-5 h-5 text-[#D1E8E2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-[#F1F5F9]">Your Usage</h2>
              {isFounder ? (
                <FounderBadge founderNumber={metrics.founderNumber} size="sm" isDark={isDark} />
              ) : isPro ? (
                <ProBadge size="sm" isDark={isDark} />
              ) : (
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    isDark
                      ? "bg-[#2C3531] text-[#D1E8E2] border border-[#334155]"
                      : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                  }`}
                >
                  Free Plan
                </span>
              )}
            </div>
            <p className="text-xs text-[#94A3B8]">
              Authoritative capacity and monthly limits
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleRefresh}
            title="Refresh authoritative server usage"
            disabled={isRefreshing}
            className={`p-2 rounded-lg text-xs font-medium transition-colors ${
              isDark
                ? "hover:bg-[#243347] text-[#94A3B8] hover:text-[#F1F5F9]"
                : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#D1E8E2]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Grid of Usage Metrics */}
      <div className="space-y-4">
        {/* Metric 1: AI Analysis */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-medium text-[#D1E8E2]">
              <Sparkles className="w-3.5 h-3.5 text-[#D1E8E2]" />
              <span>AI Analysis</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[#F1F5F9]">
                {metrics.aiAnalysesUsed.toLocaleString()}
              </span>
              <span className="text-[#94A3B8]">/</span>
              <span className="text-[#94A3B8] font-medium">
                {metrics.aiAnalysesLimit.toLocaleString()}
              </span>
              <span className="text-[10px] text-[#94A3B8] font-normal">
                ({metrics.aiAnalysesPercent}%)
              </span>
            </div>
          </div>

          {/* Visual Progress Bar in Cyber Teal */}
          <div className="relative w-full h-2.5 bg-[#2C3531] rounded-full overflow-hidden border border-[#334155]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, metrics.aiAnalysesPercent)}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className={`h-full rounded-full ${
                metrics.aiAnalysesPercent >= 90
                  ? "bg-rose-500"
                  : metrics.aiAnalysesPercent >= 75
                  ? "bg-[#D9B08C]"
                  : "bg-[#116466]"
              }`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#94A3B8] font-mono">
            <span>
              {metrics.aiAnalysesRemaining > 0
                ? `${metrics.aiAnalysesRemaining.toLocaleString()} scans remaining`
                : "Monthly limit reached"}
            </span>
            <span>Resets on {metrics.nextResetDateFormatted}</span>
          </div>
        </div>

        {/* Metric 2: Storage */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-medium text-[#D1E8E2]">
              <HardDrive className="w-3.5 h-3.5 text-[#D1E8E2]" />
              <span>Storage</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[#F1F5F9]">
                {metrics.storageUsedFormatted}
              </span>
              <span className="text-[#94A3B8]">/</span>
              <span className="text-[#94A3B8] font-medium">
                {metrics.storageLimitFormatted}
              </span>
              <span className="text-[10px] text-[#94A3B8] font-normal">
                ({metrics.storagePercent}%)
              </span>
            </div>
          </div>

          <div className="relative w-full h-2.5 bg-[#2C3531] rounded-full overflow-hidden border border-[#334155]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, metrics.storagePercent)}%` }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
              className={`h-full rounded-full ${
                metrics.storagePercent >= 90
                  ? "bg-rose-500"
                  : metrics.storagePercent >= 75
                  ? "bg-[#D9B08C]"
                  : "bg-[#116466]"
              }`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#94A3B8] font-mono">
            <span>{metrics.storageRemainingFormatted} available space</span>
            <span>Local vault &amp; cache</span>
          </div>
        </div>

        {/* Metric 3: Indexed Screenshots */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-medium text-[#D1E8E2]">
              <Layers className="w-3.5 h-3.5 text-[#D1E8E2]" />
              <span>AI-indexed screenshots</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[#F1F5F9]">
                {metrics.screenshotsIndexed.toLocaleString()}
              </span>
              <span className="text-[#94A3B8]">/</span>
              <span className="text-[#94A3B8] font-medium">
                {metrics.screenshotsLimit.toLocaleString()}
              </span>
              <span className="text-[10px] text-[#94A3B8] font-normal">
                ({metrics.screenshotsPercent}%)
              </span>
            </div>
          </div>

          <div className="relative w-full h-2.5 bg-[#2C3531] rounded-full overflow-hidden border border-[#334155]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, metrics.screenshotsPercent)}%` }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
              className={`h-full rounded-full ${
                metrics.screenshotsPercent >= 100
                  ? "bg-rose-500"
                  : metrics.screenshotsPercent >= 80
                  ? "bg-[#D9B08C]"
                  : "bg-[#116466]"
              }`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#94A3B8] font-mono">
            <span>
              {metrics.screenshotsRemaining > 0
                ? `${metrics.screenshotsRemaining.toLocaleString()} AI-indexed screenshots remaining`
                : "You've reached your plan's AI-indexing limit"}
            </span>
            <span>Multimodal visual memory</span>
          </div>

          {metrics.screenshotsPercent >= 100 && (
            <div className="mt-2 p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center justify-between">
              <span>You've reached your plan's AI-indexing limit ({metrics.screenshotsIndexed} / {metrics.screenshotsLimit} used).</span>
              {!isPro && (
                <button
                  onClick={handleUpgradeClick}
                  className="px-2 py-1 bg-[#116466] hover:bg-[#116466]/90 text-[#F1F5F9] rounded-lg text-[11px] font-bold"
                >
                  Upgrade
                </button>
              )}
            </div>
          )}
        </div>

        {/* Metric 4: Cloud Sync Usage */}
        <div
          className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
            isDark ? "bg-[#2C3531]/60 border-[#334155]" : "bg-zinc-50 border-zinc-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                metrics.isCloudSyncEnabled
                  ? "bg-[#116466]/30 text-[#D1E8E2]"
                  : "bg-[#1E293B] text-[#94A3B8]"
              }`}
            >
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-[#F1F5F9] flex items-center gap-1.5">
                <span>Cloud Sync</span>
                {metrics.isCloudSyncEnabled ? (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#116466]/30 text-[#D1E8E2] font-mono font-medium border border-[#116466]/50">
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1E293B] text-[#94A3B8] font-mono font-medium border border-[#334155]">
                    Pro Only
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#94A3B8]">
                {metrics.isCloudSyncEnabled
                  ? `${metrics.cloudSyncCount} / ${metrics.cloudSyncTotal} screenshots synced to encrypted cloud`
                  : "Local-only storage. Upgrade to sync across devices."}
              </p>
            </div>
          </div>

          {metrics.isCloudSyncEnabled && onSyncNow && (
            <button
              onClick={onSyncNow}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                isDark
                  ? "bg-[#1E293B] border-[#334155] text-[#F1F5F9] hover:bg-[#243347]"
                  : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Sync Now
            </button>
          )}
        </div>
      </div>

      {/* Quota Integrity & Reset Date Footer */}
      <div className="mt-4 pt-3 border-t border-[#334155] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-[#94A3B8]">
          <Calendar className="w-3.5 h-3.5 text-[#D1E8E2]" />
          <span>
            Next reset:{" "}
            <strong className="text-[#F1F5F9] font-semibold">
              {metrics.nextResetDateFormatted}
            </strong>{" "}
            ({metrics.daysUntilReset} {metrics.daysUntilReset === 1 ? "day" : "days"} left)
          </span>
        </div>

        {/* Free Plan Upgrade Callout */}
        {!isPro && (
          <button
            onClick={handleUpgradeClick}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#116466] hover:bg-[#116466]/90 text-[#F1F5F9] text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-[#116466]/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Upgrade to Pro (PKR 249/mo)</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Pro / Founder Verified Badge */}
        {isPro && (
          <div className="flex items-center gap-1.5 text-[#D1E8E2] text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-[#116466]" />
            <span>
              {isFounder ? "Founder VIP Entitlement Active" : "Pro Capacity Active (10,000 items)"}
            </span>
          </div>
        )}
      </div>

      {/* Honest Capacity Note */}
      <div className="mt-2.5 pt-2 border-t border-[#334155]/60 text-[10px] text-[#94A3B8] flex items-center gap-1.5">
        <Info className="w-3 h-3 shrink-0 text-[#D1E8E2]" />
        <span>
          Usage metrics are synchronized with authoritative server records. Offline actions are
          securely queued and reconciled automatically.
        </span>
      </div>
    </div>
  );
};

export default YourUsageCard;
