import React, { useState, useEffect, useCallback } from 'react';
import {
  Camera,
  ShieldCheck,
  AlertCircle,
  Settings,
  CheckCircle2,
  X,
  Pause,
  Play,
  Crown,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { nativeMediaScanner, PermissionStatus } from '../services/nativeMediaScanner';
import { processingQueue } from '../services/processingQueue';

interface GalleryPermissionModalProps {
  userId?: string;
  onManualUploadClick?: () => void;
  onOpenPricing?: () => void;
  onOpenVipClaim?: () => void;
}

export const GalleryPermissionModal: React.FC<GalleryPermissionModalProps> = ({
  userId,
  onManualUploadClick,
  onOpenPricing,
  onOpenVipClaim,
}) => {
  const [status, setStatus] = useState<PermissionStatus>(() =>
    nativeMediaScanner.getPermissionStatus()
  );
  const [summary, setSummary] = useState(() =>
    processingQueue.getIndexingProgressSummary(
      userId,
      nativeMediaScanner.getPermissionStatus().totalDiscoveredInScan
    )
  );
  const [isDismissed, setIsDismissed] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const refreshSummary = useCallback(
    (discoveredTotal?: number) => {
      const total =
        typeof discoveredTotal === 'number'
          ? discoveredTotal
          : nativeMediaScanner.getPermissionStatus().totalDiscoveredInScan;
      setSummary(processingQueue.getIndexingProgressSummary(userId, total));
    },
    [userId]
  );

  useEffect(() => {
    const unsubPerm = nativeMediaScanner.subscribePermission((newStatus) => {
      setStatus(newStatus);
      // If permission was revoked, re-surface the banner even if previously dismissed
      if (newStatus.revokedNotice) {
        setIsDismissed(false);
      }
      refreshSummary(newStatus.totalDiscoveredInScan);
    });

    const unsubQueue = processingQueue.subscribe(() => {
      refreshSummary();
    });

    const handleProcessedOrQuota = () => refreshSummary();
    window.addEventListener('snapfind_screenshot_processed', handleProcessedOrQuota);
    window.addEventListener('snapfind_quota_exceeded', handleProcessedOrQuota);

    return () => {
      unsubPerm();
      unsubQueue();
      window.removeEventListener('snapfind_screenshot_processed', handleProcessedOrQuota);
      window.removeEventListener('snapfind_quota_exceeded', handleProcessedOrQuota);
    };
  }, [refreshSummary]);

  const handleAllowClick = async () => {
    setIsRequesting(true);
    try {
      if (status.permissionState === 'denied' || status.permissionState === 'partial') {
        await nativeMediaScanner.openSettings();
      } else {
        await nativeMediaScanner.requestPermission();
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const handleCheckAgain = async () => {
    setIsRequesting(true);
    try {
      const updated = await nativeMediaScanner.checkPermission();
      if (updated.granted) {
        processingQueue.resumeQueue();
        await nativeMediaScanner.scanScreenshots();
        await nativeMediaScanner.startMonitoring();
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const isDenied = status.permissionState === 'denied';
  const isPartial = status.permissionState === 'partial';
  const showPermissionBanner =
    status.isNativePlatform &&
    status.permissionState !== 'unsupported' &&
    status.permissionState !== 'granted' &&
    (!isDismissed || isDenied);

  const showIndexingBanner =
    !summary.isLimitReached &&
    (status.isScanningGallery || summary.isIndexing || (summary.pendingCount > 0 && summary.isPaused));

  const showLimitBanner = summary.isLimitReached;

  if (!showPermissionBanner && !showIndexingBanner && !showLimitBanner) {
    return null;
  }

  const progressTotal = Math.max(1, summary.totalCount);
  const progressPercent = Math.min(100, Math.round((summary.indexedCount / progressTotal) * 100));

  return (
    <div className="space-y-3 mb-4">
      {/* 1. Native Android Gallery Permission Banner */}
      {showPermissionBanner && (
        <div
          id="gallery-permission-banner"
          className="rounded-2xl border border-[#30362E] bg-[#141714] p-4 text-[#F7F8F5] shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.025)] transition-all"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1B1F1A] border border-[#30362E] text-[#B7F36B]">
                {isDenied ? (
                  <AlertCircle className="h-5 w-5 text-[#B7F36B]" />
                ) : isPartial ? (
                  <CheckCircle2 className="h-5 w-5 text-[#B7F36B]" />
                ) : (
                  <Camera className="h-5 w-5 text-[#B7F36B]" />
                )}
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#F7F8F5]">
                  {status.revokedNotice
                    ? 'Photo Access Was Revoked'
                    : isDenied
                    ? 'Photo Access Needed'
                    : isPartial
                    ? 'Selected Photos Access'
                    : 'Automatic Screenshot Indexing'}
                </h4>
                <p className="text-xs leading-relaxed text-[#A5AAA1]">
                  {status.revokedNotice ? (
                    <>
                      Automatic gallery scanning has been paused safely because photo permission was revoked. Your already-indexed screenshots remain intact. Re-enable photo access in App Settings to resume automatic indexing.
                    </>
                  ) : isDenied ? (
                    <>
                      SnapFind needs photo access to automatically find and index your screenshots up to your account limit. Enable Photos &amp; Media permission in your device settings to activate automatic indexing.
                    </>
                  ) : isPartial ? (
                    <>
                      SnapFind currently has access only to selected photos. Grant full photo access in device settings to automatically detect and index all new screenshots.
                    </>
                  ) : (
                    <>
                      Allow photo access so SnapFind can automatically scan your existing screenshots and index new screenshots in the background up to your account limit.
                    </>
                  )}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    id="btn-allow-gallery-permission"
                    type="button"
                    onClick={handleAllowClick}
                    disabled={isRequesting}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#B7F36B] px-3.5 py-1.5 text-xs font-bold text-[#10130D] transition-colors hover:bg-[#A5E65A] active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isDenied ? (
                      <>
                        <Settings className="h-3.5 w-3.5 text-[#10130D]" />
                        Open App Settings
                      </>
                    ) : isPartial ? (
                      <>
                        <Settings className="h-3.5 w-3.5 text-[#10130D]" />
                        Grant Full Access
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5 text-[#10130D]" />
                        Allow Photo Access
                      </>
                    )}
                  </button>

                  {isDenied && (
                    <button
                      type="button"
                      onClick={handleCheckAgain}
                      disabled={isRequesting}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#30362E] bg-[#1B1F1A] px-3 py-1.5 text-xs font-bold text-[#F7F8F5] transition-colors hover:bg-[#222720] disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Check Again
                    </button>
                  )}

                  {onManualUploadClick && (
                    <button
                      id="btn-manual-photo-picker"
                      type="button"
                      onClick={onManualUploadClick}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#30362E] bg-[#1B1F1A] px-3 py-1.5 text-xs font-bold text-[#F7F8F5] transition-colors hover:bg-[#222720] cursor-pointer"
                    >
                      Pick Screenshots Manually
                    </button>
                  )}

                  {!isDenied && (
                    <button
                      id="btn-dismiss-permission-banner"
                      type="button"
                      onClick={() => setIsDismissed(true)}
                      className="rounded-xl px-2.5 py-1.5 text-xs text-[#777E74] transition-colors hover:text-[#A5AAA1] cursor-pointer"
                    >
                      Not Now
                    </button>
                  )}
                </div>
              </div>
            </div>

            {!isDenied && (
              <button
                type="button"
                aria-label="Dismiss banner"
                onClick={() => setIsDismissed(true)}
                className="rounded-xl p-1 text-[#777E74] hover:bg-[#1B1F1A] hover:text-[#A5AAA1] transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. Live Screenshot Indexing Progress Banner */}
      {showIndexingBanner && (
        <div
          id="gallery-indexing-progress-banner"
          className="rounded-2xl border border-[#30362E] bg-[#141714] p-4 text-[#F7F8F5]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#B7F36B]" />
                <p className="text-sm font-bold text-[#F7F8F5]">
                  {status.isScanningGallery
                    ? 'Scanning gallery for screenshots...'
                    : summary.isPaused
                    ? `Indexing paused — Indexed ${summary.indexedCount} of ${summary.totalCount} screenshots.`
                    : `Indexed ${summary.indexedCount} of ${summary.totalCount} screenshots.`}
                </p>
              </div>
              <p className="text-xs text-[#A5AAA1]">
                Indexed screenshots become searchable immediately as OCR and AI tagging complete.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {summary.isPaused ? (
                <button
                  type="button"
                  onClick={() => processingQueue.resumeQueue()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#B7F36B] px-3 py-1.5 text-xs font-bold text-[#080908] hover:bg-[#A5E65A] cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5" />
                  Resume Indexing
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => processingQueue.pauseQueue()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#30362E] bg-[#1B1F1A] px-3 py-1.5 text-xs font-semibold text-[#F7F8F5] hover:bg-[#222720] cursor-pointer"
                >
                  <Pause className="h-3.5 w-3.5" />
                  Pause
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#0D0F0D] border border-[#30362E]">
            <div
              className="h-full rounded-full bg-[#B7F36B] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* 3. Account Indexing Limit Reached Banner */}
      {showLimitBanner && (
        <div
          id="gallery-indexing-limit-banner"
          role="status"
          className="rounded-2xl border border-[#B7F36B]/50 bg-[#141714] p-4 text-[#F7F8F5]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#30362E] bg-[#1B1F1A] text-[#B7F36B]">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#F7F8F5]">
                  Indexing Limit Reached ({summary.indexedCount.toLocaleString()} / {summary.limit.toLocaleString()} screenshots)
                </h4>
                <p className="text-xs leading-relaxed text-[#A5AAA1]">
                  Automatic indexing has been paused so your account limit is not exceeded. Your{' '}
                  {summary.indexedCount.toLocaleString()} already-indexed screenshots remain safe and searchable.
                  {summary.limitPausedCount > 0
                    ? ` ${summary.limitPausedCount} additional screenshot${summary.limitPausedCount === 1 ? '' : 's'} will index automatically once you upgrade.`
                    : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onOpenVipClaim && (
                <button
                  type="button"
                  onClick={onOpenVipClaim}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#B7F36B] px-3.5 py-2 text-xs font-bold text-[#080908] hover:bg-[#A5E65A] cursor-pointer"
                >
                  <Crown className="h-3.5 w-3.5" />
                  Claim Free VIP Seat
                </button>
              )}
              {onOpenPricing && (
                <button
                  type="button"
                  onClick={onOpenPricing}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#30362E] bg-[#1B1F1A] px-3.5 py-2 text-xs font-bold text-[#F7F8F5] hover:bg-[#222720] cursor-pointer"
                >
                  Upgrade Plan
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
