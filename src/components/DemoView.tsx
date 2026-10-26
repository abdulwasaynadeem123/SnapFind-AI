import React, { useState, useMemo } from "react";
import {
  Search,
  Sparkles,
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
      {/* Demo Notice Banner */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6 text-white space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center shrink-0 border border-zinc-700">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-700 font-mono text-[10px] font-bold uppercase tracking-wider mb-1">
                Interactive Public Demo
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Explore SnapFind Visual Search (Read-Only Demo Mode)
              </h2>
              <p className="text-xs text-zinc-400 max-w-2xl mt-0.5">
                No sign-in required. This demo operates entirely on synthetic sample screenshots with full Vision OCR and keyword indexing. Your personal screenshots remain completely isolated in your private vault.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={onLoadSamplesToVault}
              type="button"
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-zinc-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-zinc-300" />
              <span>Copy to My Vault</span>
            </button>

            <button
              onClick={onOpenAuth}
              type="button"
              className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-98"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Free Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Search Controls */}
      <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-950 space-y-4 shadow-xl">
        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try searching: 'passport', 'pizza recipe', '$148.65', 'flight to Tokyo', 'hardware'..."
            className="w-full pl-10 pr-10 py-3 rounded-xl border border-zinc-800 bg-zinc-900 text-white placeholder-zinc-500 text-sm focus:border-white focus:outline-none transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1 text-xs font-bold"
            >
              Clear
            </button>
          )}
        </div>

        {/* Quick Query Pills */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
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
                      ? "border-white bg-white text-black font-semibold"
                      : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700"
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
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-800">
          {categories.map((cat) => (
            <button
              key={cat.label}
              type="button"
              onClick={() => setSelectedCategory(cat.label)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                selectedCategory === cat.label
                  ? "bg-white text-black font-bold"
                  : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"
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
              className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white hover:underline font-medium cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
        <span>
          Showing <strong className="text-white">{displayItems.length}</strong> of {demoScreenshots.length} sample screenshots
          {query && ` matching "${query}"`}
        </span>
        <span className="text-[11px] text-emerald-400 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> Demo Sandbox Active
        </span>
      </div>

      {/* Grid of Demo Screenshots */}
      {displayItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayItems.map((item) => (
            <div key={item.id} className="relative group">
              <div className="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-md bg-black/90 border border-zinc-700 text-zinc-200 font-mono text-[9px] font-bold uppercase tracking-wider backdrop-blur-sm pointer-events-none">
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
        <div className="py-16 text-center space-y-4 max-w-md mx-auto p-8 rounded-2xl border border-[#30363D] bg-[#171A1D]">
          <div className="w-12 h-12 rounded-xl bg-[#1E2226] border border-[#30363D] flex items-center justify-center mx-auto text-[#A7B0BA]">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#F5F7FA]">No demo screenshots matched</h3>
            <p className="text-xs text-[#A7B0BA] mt-1">
              Try searching for "passport", "bill", "recipe", "travel", "receipt", or "qr".
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSelectedCategory("All");
            }}
            className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-colors cursor-pointer active:scale-98"
          >
            Show All 6 Demo Files
          </button>
        </div>
      )}

      {/* Feature Comparison / Account Upsell Explainer */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8 space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-1.5">
          <h3 className="text-lg font-bold text-white">
            What Requires a SnapFind Account?
          </h3>
          <p className="text-xs text-zinc-400">
            The demo is read-only and publicly accessible. Here is how your experience expands with a free account:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 text-white flex items-center justify-center font-bold text-xs font-mono">
              01
            </div>
            <h4 className="font-semibold text-sm text-white">Private Vault &amp; Uploads</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Upload your own real screenshot images from computer or mobile camera roll, indexed with private local storage.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 text-white flex items-center justify-center font-bold text-xs font-mono">
              02
            </div>
            <h4 className="font-semibold text-sm text-white">PIN Lock &amp; Privacy Shield</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Automatically detect sensitive financial and ID documents. Protect them behind biometric or numeric PIN codes.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 text-white flex items-center justify-center font-bold text-xs font-mono">
              03
            </div>
            <h4 className="font-semibold text-sm text-white">Multi-Device Cloud Sync</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Synchronize your visual index securely across Web and Android, with automatic trash retention and restore.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={onOpenAuth}
            type="button"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer active:scale-98 shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Free Account</span>
          </button>

          <button
            onClick={onNavigateToGallery}
            type="button"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#30363D] bg-[#1E2226] hover:bg-[#262C32] text-[#F5F7FA] text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Go to My Personal Vault</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
