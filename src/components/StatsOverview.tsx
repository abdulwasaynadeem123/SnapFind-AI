import React from "react";
import { Sparkles, ShieldCheck, Bookmark, CreditCard } from "lucide-react";
import { ScreenshotItem, CategoryType } from "../types";

interface StatsOverviewProps {
  screenshots: ScreenshotItem[];
  isDark?: boolean;
  onSelectCategory: (cat: CategoryType) => void;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  screenshots,
  onSelectCategory,
}) => {
  const totalCount = screenshots.length;
  const passportCount = screenshots.filter((s) => s.category === "Passport").length;
  const billCount = screenshots.filter((s) => s.category === "Electricity Bill").length;
  const totalEntities = screenshots.reduce((acc, curr) => acc + (curr.keyEntities?.length || 0), 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 select-none">
      {/* Total Index */}
      <div
        onClick={() => onSelectCategory("All")}
        className="p-3.5 rounded-2xl border border-[#334155] bg-[#1E293B]/95 hover:border-[#116466] hover:bg-[#243347] cursor-pointer transition-all shadow-[0_0_12px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-center justify-between text-[#94A3B8] mb-1 font-mono text-[10px] uppercase tracking-wider">
          <span>Indexed Snaps</span>
          <ShieldCheck className="w-3.5 h-3.5 text-[#D1E8E2]" />
        </div>
        <div className="text-xl font-extrabold font-mono tracking-tight text-[#F1F5F9] tabular-nums">{totalCount}</div>
        <span className="text-[10px] font-mono text-[#D1E8E2] font-medium">100% OCR PROCESSED</span>
      </div>

      {/* Extracted Entities */}
      <div
        className="p-3.5 rounded-2xl border border-[#334155] bg-[#1E293B]/95 hover:border-[#116466] transition-all shadow-[0_0_12px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-center justify-between text-[#94A3B8] mb-1 font-mono text-[10px] uppercase tracking-wider">
          <span>Key Entities</span>
          <Sparkles className="w-3.5 h-3.5 text-[#D1E8E2]" />
        </div>
        <div className="text-xl font-extrabold font-mono tracking-tight text-[#F1F5F9] tabular-nums">{totalEntities}</div>
        <span className="text-[10px] font-mono text-[#94A3B8]/70">DATES, PRICES, CODES</span>
      </div>

      {/* Passports & Travel count */}
      <div
        onClick={() => onSelectCategory("Passport")}
        className="p-3.5 rounded-2xl border border-[#334155] bg-[#1E293B]/95 hover:border-[#116466] hover:bg-[#243347] cursor-pointer transition-all shadow-[0_0_12px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-center justify-between text-[#94A3B8] mb-1 font-mono text-[10px] uppercase tracking-wider">
          <span>Passports</span>
          <Bookmark className="w-3.5 h-3.5 text-[#D9B08C]" />
        </div>
        <div className="text-xl font-extrabold font-mono tracking-tight text-[#F1F5F9] tabular-nums">{passportCount}</div>
        <span className="text-[10px] font-mono text-[#94A3B8] font-medium">AUTO-CATEGORIZED</span>
      </div>

      {/* Electricity Bills count */}
      <div
        onClick={() => onSelectCategory("Electricity Bill")}
        className="p-3.5 rounded-2xl border border-[#334155] bg-[#1E293B]/95 hover:border-[#116466] hover:bg-[#243347] cursor-pointer transition-all shadow-[0_0_12px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-center justify-between text-[#94A3B8] mb-1 font-mono text-[10px] uppercase tracking-wider">
          <span>Bills &amp; Invoices</span>
          <CreditCard className="w-3.5 h-3.5 text-[#D1E8E2]" />
        </div>
        <div className="text-xl font-extrabold font-mono tracking-tight text-[#F1F5F9] tabular-nums">{billCount}</div>
        <span className="text-[10px] font-mono text-[#94A3B8] font-medium">AMOUNTS &amp; DUE DATES</span>
      </div>
    </div>
  );
};

export default StatsOverview;
