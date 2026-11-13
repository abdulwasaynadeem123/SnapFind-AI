import React, { useState, useMemo } from "react";
import {
  Search,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  UserPlus,
  LogIn,
  RotateCcw,
  Tag,
  FileText,
  CreditCard,
  Utensils,
  Plane,
  QrCode,
  ShoppingBag,
} from "lucide-react";
import { ScreenshotItem, SearchResultMatch, CategoryType } from "../types";
import { INITIAL_SAMPLE_SCREENSHOTS } from "../data/sampleScreenshots";
import { instantKeywordSearch } from "../services/api";
import { ScreenshotCard } from "./ScreenshotCard";
import { PageHeroHeader } from "./PageHeroHeader";

interface DemoViewProps {
  onOpenAuth: () => void;
  onLoadSamplesToVault: () => void;
  onNavigateToGallery: () => void;
  onSelectScreenshot: (item: ScreenshotItem) => void;
  initialQuery?: string;
}

const DEMO_PRESET_QUERIES = [
  { label: "Show the passport screenshot I saved last week", icon: FileText, cat: "Passport" },
  { label: "Find the pizza recipe I downloaded", icon: Utensils, cat: "Recipe" },
  { label: "Show electricity bill due amount", icon: CreditCard, cat: "Electricity Bill" },
  { label: "Find flight ticket confirmation", icon: Plane, cat: "Ticket & Travel" },
  { label: "Hardware store purchase receipt", icon: ShoppingBag, cat: "Receipt & Invoice" },
  { label: "Scan to pay QR code", icon: QrCode, cat: "QR Code" },
];

export const DemoView: React.FC<DemoViewProps> = ({
  onOpenAuth,
  onLoadSamplesToVault,
  onNavigateToGallery,
  onSelectScreenshot,
  initialQuery = "",
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>("All");

  const demoScreenshots = useMemo(() => INITIAL_SAMPLE_SCREENSHOTS, []);

  // Filter and search against synthetic demo dataset
  const searchMatches = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return instantKeywordSearch(q, demoScreenshots);
  }, [query, demoScreenshots]);

  const matchMap = useMemo(() => {
    return new Map<string, SearchResultMatch>(searchMatches.map((m) => [m.id, m]));
  }, [searchMatches]);

  const displayItems = useMemo(() => {
    let items = demoScreenshots;

    if (query.trim()) {
      const matchIds = new Set(searchMatches.map((m) => m.id));
      items = items.filter((item) => matchIds.has(item.id));
    }

    if (selectedCategory !== "All") {
      items = items.filter((item) => item.category === selectedCategory);
    }

    return items;
  }, [demoScreenshots, query, searchMatches, selectedCategory]);

  const categories: { label: CategoryType; count: number }[] = [
    { label: "All", count: demoScreenshots.length },
    { label: "Passport", count: demoScreenshots.filter((s) => s.category === "Passport").length },
    { label: "Electricity Bill", count: demoScreenshots.filter((s) => s.category === "Electricity Bill").length },
    { label: "Recipe", count: demoScreenshots.filter((s) => s.category === "Recipe").length },
    { label: "Ticket & Travel", count: demoScreenshots.filter((s) => s.category === "Ticket & Travel").length },
    { label: "Receipt & Invoice", count: demoScreenshots.filter((s) => s.category === "Receipt & Invoice").length },
    { label: "QR Code", count: demoScreenshots.filter((s) => s.category === "QR Code").length },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto select-text">
      {/* Page Hero Header */}
      <PageHeroHeader
        type="demo"
        title="Demo gallery"
        isDark={true}
        actions={
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <button
              onClick={onNavigateToGallery}
              type="button"
              className="px-3.5 py-2 min-h-[44px] rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-[#F7F8F5] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_8px_rgba(0,0,0,0.4)]"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate whitespace-nowrap">Exit Demo</span>
            </button>
            <button
              onClick={onLoadSamplesToVault}
              type="button"
              className="px-3.5 py-2 min-h-[44px] rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_8px_rgba(0,0,0,0.4)] border border-[#B7F36B]"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
              <span className="truncate whitespace-nowrap">Copy to Vault</span>
            </button>
          </div>
        }
      />

      {/* Interactive Search Controls */}
      <div className="p-5 rounded-2xl border border-[#30362E] bg-[#141714] space-y-4 shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.025)]">
        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777E74]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try searching: 'passport', 'pizza recipe', '$148.65', 'flight to Tokyo', 'hardware'..."
            className="w-full pl-10 pr-10 py-3 rounded-xl border border-[#30362E] bg-[#0D0F0D] text-[#F7F8F5] placeholder-[#777E74] text-sm focus:border-[#B7F36B] focus:outline-none transition-colors shadow-[inset_3px_3px_6px_rgba(0,0,0,0.65)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A5AAA1] hover:text-[#F7F8F5] p-1 text-xs font-bold"
            >
              Clear
            </button>
          )}
        </div>

        {/* Quick Query Pills */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-[#A5AAA1] uppercase tracking-wider">
            Quick Natural Language Tests:
          </span>
          <div className="flex flex-wrap gap-2">
            {DEMO_PRESET_QUERIES.map((preset) => {
              const Icon = preset.icon;
              const isSelected = query.toLowerCase() === preset.label.toLowerCase();
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setQuery(preset.label);
                    setSelectedCategory("All");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    isSelected
                      ? "border-[#B7F36B] bg-[#B7F36B] text-[#10130D] font-bold shadow-[2px_2px_8px_rgba(0,0,0,0.4)]"
                      : "border-[#30362E] bg-[#1B1F1A] text-[#A5AAA1] hover:text-[#F7F8F5] hover:border-[#30362E]/80 shadow-[2px_2px_6px_rgba(0,0,0,0.4)]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>"{preset.label}"</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#30362E]">
          {categories.map((cat) => (
            <button
              key={cat.label}
              type="button"
              onClick={() => setSelectedCategory(cat.label)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                selectedCategory === cat.label
                  ? "bg-[#B7F36B] text-[#10130D] font-bold shadow-[2px_2px_8px_rgba(0,0,0,0.4)]"
                  : "bg-[#1B1F1A] border border-[#30362E] text-[#A5AAA1] hover:text-[#F7F8F5] hover:bg-[#222720]"
              }`}
            >
              <span>{cat.label}</span>
              <span className="ml-1.5 opacity-70 text-[10px]">({cat.count})</span>
            </button>
          ))}

          {(query || selectedCategory !== "All") && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSelectedCategory("All");
              }}
              className="ml-auto inline-flex items-center gap-1 text-xs text-[#A5AAA1] hover:text-[#B7F36B] hover:underline font-medium cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-[#A5AAA1] px-1">
        <span>
          Showing <strong className="text-[#F7F8F5]">{displayItems.length}</strong> of {demoScreenshots.length} sample screenshots
          {query && ` matching "${query}"`}
        </span>
        <span className="text-[11px] text-[#B7F36B] flex items-center gap-1 font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" /> Demo Sandbox Active
        </span>
      </div>

      {/* Grid of Demo Screenshots (1, 2, or 4 columns - NO 3-card rows) */}
      {displayItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-5">
          {displayItems.map((item) => (
            <div key={item.id} className="relative group">
              <div className="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-md bg-[#080908] border border-[#30362E] text-[#A5AAA1] font-mono text-[9px] font-bold uppercase tracking-wider pointer-events-none">
                Demo Sample
              </div>
              <ScreenshotCard
                item={item}
                matchInfo={matchMap.get(item.id)}
                isDark={true}
                onSelect={onSelectScreenshot}
                onToggleFavorite={() => {}}
                onDelete={() => {}}
                onCopyText={() => {}}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center space-y-4 max-w-md mx-auto p-8 rounded-2xl border border-[#30362E] bg-[#141714] shadow-[6px_6px_16px_rgba(0,0,0,0.65)]">
          <div className="w-12 h-12 rounded-xl bg-[#1B1F1A] border border-[#30362E] flex items-center justify-center mx-auto text-[#B7F36B]">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#F7F8F5]">No demo screenshots matched</h3>
            <p className="text-xs text-[#A5AAA1] mt-1">
              Try searching for "passport", "bill", "recipe", "travel", "receipt", or "qr".
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSelectedCategory("All");
            }}
            className="px-4 py-2 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] font-bold text-xs transition-colors cursor-pointer shadow-[2px_2px_8px_rgba(0,0,0,0.4)]"
          >
            Show All 6 Demo Files
          </button>
        </div>
      )}

    </div>
  );
};
