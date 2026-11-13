import React from "react";
import { WifiOff, AlertTriangle } from "lucide-react";

interface OfflineBannerProps {
  isDark: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ isDark }) => {
  return (
    <div
      className={`px-4 py-2.5 rounded-2xl border text-xs flex items-center justify-between shadow-sm transition-all ${
        isDark
          ? "bg-[#1B1F1A] border-[#30362E] text-[#F7F8F5]"
          : "bg-amber-50 border-amber-200 text-amber-800"
      }`}
    >
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="font-semibold">Offline Mode Active:</span>
        <span className="opacity-90">
          Using local storage index &amp; on-device OCR engine. Cloud sync will resume when connection restores.
        </span>
      </div>
      <div className="hidden sm:flex items-center gap-1 font-mono text-[10px] opacity-75 bg-amber-500/10 px-2 py-0.5 rounded-md">
        <AlertTriangle className="w-3 h-3 text-amber-400" />
        <span>Local Mode</span>
      </div>
    </div>
  );
};
