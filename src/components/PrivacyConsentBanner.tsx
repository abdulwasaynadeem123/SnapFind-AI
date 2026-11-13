import React, { useState, useEffect } from "react";
import { ShieldCheck, X } from "lucide-react";
import { analytics, AnalyticsConsentStatus } from "../services/analytics";

interface PrivacyConsentBannerProps {
  isDark?: boolean;
}

export const PrivacyConsentBanner: React.FC<PrivacyConsentBannerProps> = ({ isDark = true }) => {
  const [consentStatus, setConsentStatus] = useState<AnalyticsConsentStatus>("granted");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if Google Analytics is configured and consent hasn't been set yet
    if (analytics.isConfigured()) {
      const current = analytics.getConsent();
      setConsentStatus(current);
      if (current === "unset") {
        setVisible(true);
      } else if (current === "granted") {
        analytics.init();
      }
    }
  }, []);

  const handleAccept = () => {
    analytics.setConsent("granted");
    setConsentStatus("granted");
    setVisible(false);
  };

  const handleDecline = () => {
    analytics.setConsent("denied");
    setConsentStatus("denied");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Privacy and Cookie Consent"
      className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div
        className={`p-4 sm:p-5 rounded-2xl border shadow-[8px_8px_24px_rgba(0,0,0,0.8)] ${
          isDark
            ? "bg-[#141714] border-[#30362E] text-[#F7F8F5]"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-[#1B1F1A] text-[#B7F36B] shrink-0 border border-[#30362E]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-1">
            <h4 className="text-sm font-bold tracking-tight">Privacy &amp; Cookie Preferences</h4>
            <p className="text-xs text-[#A5AAA1] leading-relaxed">
              SnapFind AI uses privacy-focused, zero-PII telemetry to analyze public site performance. We never track your personal screenshots, search queries, or OCR contents.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDecline}
            aria-label="Dismiss consent notice"
            className="text-[#777E74] hover:text-[#F7F8F5] transition-colors p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2.5 pt-3 border-t border-[#30362E]">
          <button
            type="button"
            onClick={handleDecline}
            className="px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold text-[#A5AAA1] hover:text-[#F7F8F5] transition-colors cursor-pointer"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="px-4 py-2 min-h-[40px] rounded-xl text-xs font-bold bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] shadow-sm transition-colors cursor-pointer"
          >
            Accept Telemetry
          </button>
        </div>
      </div>
    </div>
  );
};
