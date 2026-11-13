import React, { useState, useEffect } from 'react';
import { Camera, ShieldCheck, AlertCircle, Settings, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { nativeMediaScanner, PermissionStatus, GalleryPermissionState } from '../services/nativeMediaScanner';
import { Capacitor } from '@capacitor/core';

interface GalleryPermissionModalProps {
  onManualUploadClick?: () => void;
}

export const GalleryPermissionModal: React.FC<GalleryPermissionModalProps> = ({ onManualUploadClick }) => {
  const [status, setStatus] = useState<PermissionStatus>({
    granted: false,
    permissionState: 'prompt',
  });
  const [isDismissed, setIsDismissed] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    // Check initial permission state and subscribe to changes
    const unsubscribe = nativeMediaScanner.subscribePermission((newStatus) => {
      setStatus(newStatus);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // If granted or dismissed by user for this session, don't display
  if (status.granted && status.permissionState === 'granted') {
    return null;
  }

  // Only show native prompt/banner on native platform or when testing permission states
  if (!Capacitor.isNativePlatform() && isDismissed) {
    return null;
  }

  if (isDismissed && status.permissionState !== 'denied') {
    return null;
  }

  const handleAllowClick = async () => {
    setIsRequesting(true);
    try {
      if (status.permissionState === 'denied') {
        await nativeMediaScanner.openSettings();
      } else {
        await nativeMediaScanner.requestPermission();
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const isPartial = status.permissionState === 'partial';
  const isDenied = status.permissionState === 'denied';

  return (
    <div
      id="gallery-permission-banner"
      className="mb-4 rounded-2xl border border-[#30362E] bg-[#141714] p-4 text-[#F7F8F5] shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.025)] transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1B1F1A] border border-[#30362E] text-[#B7F36B] shadow-[inset_1px_1px_3px_rgba(0,0,0,0.4)]">
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
              {isDenied
                ? 'Photo Access Needed'
                : isPartial
                ? 'Selected Photos Access'
                : 'Automatic Screenshot Detection'}
            </h4>
            <p className="text-xs leading-relaxed text-[#A5AAA1]">
              {isDenied ? (
                <>
                  SnapFind needs access to your photos so it can find and index your screenshots. Since
                  permission was denied, please enable it in your device settings.
                </>
              ) : isPartial ? (
                <>
                  SnapFind can currently only access photos you selected. To automatically detect all new
                  screenshots, grant full photo access in settings.
                </>
              ) : (
                <>SnapFind needs access to your photos so it can find and index your screenshots.</>
              )}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                id="btn-allow-gallery-permission"
                type="button"
                onClick={handleAllowClick}
                disabled={isRequesting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#B7F36B] px-3.5 py-1.5 text-xs font-bold text-[#10130D] transition-colors hover:bg-[#A5E65A] active:scale-95 disabled:opacity-50 shadow-[2px_2px_8px_rgba(0,0,0,0.4)]"
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

              {onManualUploadClick && (
                <button
                  id="btn-manual-photo-picker"
                  type="button"
                  onClick={onManualUploadClick}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#30362E] bg-[#1B1F1A] px-3 py-1.5 text-xs font-bold text-[#F7F8F5] transition-colors hover:bg-[#222720] shadow-[2px_2px_8px_rgba(0,0,0,0.3)]"
                >
                  Pick Screenshots Manually
                </button>
              )}

              <button
                id="btn-dismiss-permission-banner"
                type="button"
                onClick={() => setIsDismissed(true)}
                className="rounded-xl px-2.5 py-1.5 text-xs text-[#777E74] transition-colors hover:text-[#A5AAA1]"
              >
                Not Now
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-label="Dismiss banner"
          onClick={() => setIsDismissed(true)}
          className="rounded-xl p-1 text-[#777E74] hover:bg-[#1B1F1A] hover:text-[#A5AAA1] transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
