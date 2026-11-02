import React, { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  CalendarDays,
  Clock,
  Sun,
  Archive,
  Sparkles,
  Search,
  Filter,
  CheckSquare,
  Square,
  Copy,
  Layers,
  ArrowUp,
  Image as ImageIcon,
  Smartphone,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import { ScreenshotItem, CategoryType } from "../types";
import { ScreenshotCard } from "./ScreenshotCard";
import { PageHeroHeader } from "./PageHeroHeader";

interface TimelineViewProps {
  screenshots: ScreenshotItem[];
  isDark: boolean;
  onSelectScreenshot: (item: ScreenshotItem) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteScreenshot: (id: string) => void;
  onCopyText: (text: string) => void;
  addToast: (msg: { title: string; description?: string; type: "success" | "error" | "info" }) => void;
}

export type TimelineGroupMode = "month_year" | "day" | "smart_buckets";

export interface TimelineGroup {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  items: ScreenshotItem[];
}

export function parseScreenshotDate(item: ScreenshotItem): Date {
  const raw = item.createdAt || item.created_at || (item as any).indexedAt || (item as any).date_created || item.dateModified;
  if (!raw) return new Date(0);
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  screenshots,
  isDark,
  onSelectScreenshot,
  onToggleFavorite,
  onDeleteScreenshot,
  onCopyText,
  addToast,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | "All">("All");
  const [selectedSourceApp, setSelectedSourceApp] = useState<string>("All");
  const [groupMode, setGroupMode] = useState<TimelineGroupMode>("month_year");
  const [jumpDate, setJumpDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hideEmptyGroups, setHideEmptyGroups] = useState(true);

  // Extract all unique source apps available in screenshots
  const availableSourceApps = useMemo(() => {
    const set = new Set<string>();
    screenshots.forEach((s) => {
      const app = s.source_app || s.sourceApp;
      if (app && app.trim().length > 0) {
        set.add(app.trim());
      }
    });
    return Array.from(set).sort();
  }, [screenshots]);

  // Filtered Screenshots
  const filteredScreenshots = useMemo(() => {
    return screenshots.filter((item) => {
      // Category filter
      if (selectedCategory !== "All" && item.category !== selectedCategory) {
        return false;
      }

      // Source App filter
      if (selectedSourceApp !== "All") {
        const itemApp = (item.source_app || item.sourceApp || "").toLowerCase();
        if (!itemApp.includes(selectedSourceApp.toLowerCase())) return false;
      }

      // Date Range filter
      const itemTime = parseScreenshotDate(item).getTime();
      if (startDate) {
        const start = new Date(startDate).getTime();
        if (itemTime < start) return false;
      }
      if (endDate) {
        // Include up to end of the selected day
        const end = new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1;
        if (itemTime > end) return false;
      }

      // Text search
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      return (
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.fullText.toLowerCase().includes(q) ||
        (item.source_app && item.source_app.toLowerCase().includes(q)) ||
        (item.sourceApp && item.sourceApp.toLowerCase().includes(q)) ||
        (item.keyEntities && item.keyEntities.some((e) => e.toLowerCase().includes(q))) ||
        (item.tags && item.tags.some((t) => t.toLowerCase().includes(q)))
      );
    });
  }, [screenshots, searchQuery, selectedCategory, selectedSourceApp, startDate, endDate]);

  // Dynamic Grouping
  const groups = useMemo(() => {
    const sorted = [...filteredScreenshots].sort((a, b) => {
      return parseScreenshotDate(b).getTime() - parseScreenshotDate(a).getTime();
    });

    if (groupMode === "month_year") {
      // Group by Year and Month (e.g., "October 2026")
      const monthMap = new Map<string, { title: string; subtitle: string; items: ScreenshotItem[] }>();

      sorted.forEach((sc) => {
        const d = parseScreenshotDate(sc);
        const year = d.getFullYear() || new Date().getFullYear();
        const monthName = d.toLocaleString("en-US", { month: "long" });
        const key = `${year}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const title = `${monthName} ${year}`;

        if (!monthMap.has(key)) {
          monthMap.set(key, {
            title,
            subtitle: `${monthName} archive`,
            items: [],
          });
        }
        monthMap.get(key)!.items.push(sc);
      });

      return Array.from(monthMap.entries()).map(([key, data]) => ({
        id: key,
        title: data.title,
        subtitle: `${data.items.length} ${data.items.length === 1 ? "capture" : "captures"}`,
        icon: Calendar,
        items: data.items,
      }));
    } else if (groupMode === "day") {
      // Group day-by-day (e.g., "Thursday, Oct 30, 2026")
      const dayMap = new Map<string, { title: string; subtitle: string; items: ScreenshotItem[] }>();

      sorted.forEach((sc) => {
        const d = parseScreenshotDate(sc);
        const key = d.toISOString().split("T")[0];
        const title = d.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        if (!dayMap.has(key)) {
          dayMap.set(key, {
            title,
            subtitle: key,
            items: [],
          });
        }
        dayMap.get(key)!.items.push(sc);
      });

      return Array.from(dayMap.entries()).map(([key, data]) => ({
        id: key,
        title: data.title,
        subtitle: `${data.items.length} ${data.items.length === 1 ? "item" : "items"}`,
        icon: CalendarDays,
        items: data.items,
      }));
    } else {
      // Smart Buckets: Today, Yesterday, Last 7 Days, Last Month, Older
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
      const startOf7Days = startOfToday - 6 * 24 * 60 * 60 * 1000;
      const startOf30Days = startOfToday - 29 * 24 * 60 * 60 * 1000;

      const todayItems: ScreenshotItem[] = [];
      const yesterdayItems: ScreenshotItem[] = [];
      const last7DaysItems: ScreenshotItem[] = [];
      const lastMonthItems: ScreenshotItem[] = [];
      const olderItems: ScreenshotItem[] = [];

      sorted.forEach((sc) => {
        const time = parseScreenshotDate(sc).getTime();
        if (time >= startOfToday) {
          todayItems.push(sc);
        } else if (time >= startOfYesterday) {
          yesterdayItems.push(sc);
        } else if (time >= startOf7Days) {
          last7DaysItems.push(sc);
        } else if (time >= startOf30Days) {
          lastMonthItems.push(sc);
        } else {
          olderItems.push(sc);
        }
      });

      const formatDateStr = (d: Date) =>
        d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

      const list: TimelineGroup[] = [
        {
          id: "today",
          title: "Today",
          subtitle: formatDateStr(now),
          icon: Sun,
          items: todayItems,
        },
        {
          id: "yesterday",
          title: "Yesterday",
          subtitle: formatDateStr(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
          icon: Clock,
          items: yesterdayItems,
        },
        {
          id: "last-7-days",
          title: "Last 7 Days",
          subtitle: "Past week captures",
          icon: CalendarDays,
          items: last7DaysItems,
        },
        {
          id: "last-month",
          title: "Last Month",
          subtitle: "Past 30 days captures",
          icon: Calendar,
          items: lastMonthItems,
        },
        {
          id: "older",
          title: "Older Memories",
          subtitle: "Archived screenshots",
          icon: Archive,
          items: olderItems,
        },
      ];

      return hideEmptyGroups ? list.filter((g) => g.items.length > 0) : list;
    }
  }, [filteredScreenshots, groupMode, hideEmptyGroups]);

  const handleJumpToDate = (targetDateStr: string) => {
    if (!targetDateStr) return;
    setJumpDate(targetDateStr);

    const targetTime = new Date(targetDateStr).getTime();
    if (isNaN(targetTime)) return;

    // Switch to calendar or day mode to view target date directly
    if (groupMode === "smart_buckets") {
      setGroupMode("month_year");
    }

    // Attempt to scroll to target group
    const targetKey = targetDateStr.slice(0, 7); // "YYYY-MM"
    setTimeout(() => {
      const el = document.getElementById(`timeline-group-${targetKey}`) || document.getElementById(`timeline-group-${targetDateStr}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("All");
    setSelectedSourceApp("All");
    setStartDate("");
    setEndDate("");
    setJumpDate("");
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleBatchCopyOCR = () => {
    const selectedItems = screenshots.filter((s) => selectedIds.includes(s.id));
    const combined = selectedItems
      .map((s, idx) => `--- Screenshot ${idx + 1}: ${s.title} ---\n${s.fullText || s.summary}`)
      .join("\n\n");

    navigator.clipboard.writeText(combined);
    addToast({
      title: "Batch Copied",
      description: `Copied OCR text of ${selectedIds.length} screenshot(s) to clipboard.`,
      type: "success",
    });
  };

  const hasActiveFilters =
    Boolean(searchQuery) ||
    selectedCategory !== "All" ||
    selectedSourceApp !== "All" ||
    Boolean(startDate) ||
    Boolean(endDate);

  return (
    <div className="space-y-6 pb-16">
      {/* 3D Chronological Timeline Hero Header */}
      <PageHeroHeader
        type="timeline"
        title="Chronological Timeline"
        subtitle="Explore your indexed screenshots organized naturally by time periods with calendar grouping, date jumps, and source app filtering."
        isDark={isDark}
        actions={
          <div className="w-full lg:w-auto flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
            {/* View Mode Switcher */}
            <div className="inline-flex items-center p-1 rounded-2xl bg-[#1E293B] border border-[#334155]">
              <button
                onClick={() => setGroupMode("month_year")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  groupMode === "month_year"
                    ? "bg-[#116466] text-[#F1F5F9] shadow-sm"
                    : "text-[#D1E8E2]/70 hover:text-white"
                }`}
              >
                Month & Year
              </button>
              <button
                onClick={() => setGroupMode("day")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  groupMode === "day"
                    ? "bg-[#116466] text-[#F1F5F9] shadow-sm"
                    : "text-[#D1E8E2]/70 hover:text-white"
                }`}
              >
                Day by Day
              </button>
              <button
                onClick={() => setGroupMode("smart_buckets")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  groupMode === "smart_buckets"
                    ? "bg-[#116466] text-[#F1F5F9] shadow-sm"
                    : "text-[#D1E8E2]/70 hover:text-white"
                }`}
              >
                Smart Buckets
              </button>
            </div>
          </div>
        }
      />

      {/* Filter & Jump Toolbar */}
      <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4 space-y-3 shadow-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#D1E8E2]/50 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search timeline photos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-xl text-xs bg-[#0B0F19] border border-[#334155] text-[#F1F5F9] placeholder-[#D1E8E2]/40 focus:outline-none focus:border-[#116466] focus:ring-1 focus:ring-[#116466] transition"
            />
          </div>

          {/* Jump to Date */}
          <div className="relative flex items-center gap-2">
            <label className="text-[11px] font-medium text-[#D1E8E2]/70 shrink-0">Jump to:</label>
            <input
              type="date"
              value={jumpDate}
              onChange={(e) => handleJumpToDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-[#0B0F19] border border-[#334155] text-[#F1F5F9] focus:outline-none focus:border-[#116466] cursor-pointer"
            />
          </div>

          {/* Category Dropdown */}
          <div className="relative flex items-center gap-2">
            <label className="text-[11px] font-medium text-[#D1E8E2]/70 shrink-0">Category:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as CategoryType | "All")}
              className="w-full px-3 py-2 rounded-xl text-xs bg-[#0B0F19] border border-[#334155] text-[#F1F5F9] focus:outline-none focus:border-[#116466] cursor-pointer"
            >
              <option value="All">All Categories</option>
              <option value="Receipt & Invoice">Receipt & Invoice</option>
              <option value="Financial">Financial</option>
              <option value="Ticket & Travel">Ticket & Travel</option>
              <option value="Chat & Message">Chat & Message</option>
              <option value="E-Commerce">E-Commerce</option>
              <option value="Electricity Bill">Electricity Bill</option>
              <option value="Code & Dev">Code & Dev</option>
              <option value="Admission & Certificate">Admission & Certificate</option>
              <option value="Recipe">Recipe</option>
              <option value="Passport">Passport</option>
              <option value="Notes & Ideas">Notes & Ideas</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Source App Filter */}
          <div className="relative flex items-center gap-2">
            <label className="text-[11px] font-medium text-[#D1E8E2]/70 shrink-0">App:</label>
            <select
              value={selectedSourceApp}
              onChange={(e) => setSelectedSourceApp(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-[#0B0F19] border border-[#334155] text-[#F1F5F9] focus:outline-none focus:border-[#116466] cursor-pointer"
            >
              <option value="All">All Apps</option>
              {availableSourceApps.map((app) => (
                <option key={app} value={app}>
                  {app}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Range & Clear Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[#334155]/50">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-[#D1E8E2]/60">Date Range:</span>
            <input
              type="date"
              placeholder="From"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1 rounded-lg text-xs bg-[#0B0F19] border border-[#334155] text-[#F1F5F9]"
            />
            <span className="text-xs text-[#D1E8E2]/40">to</span>
            <input
              type="date"
              placeholder="To"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1 rounded-lg text-xs bg-[#0B0F19] border border-[#334155] text-[#F1F5F9]"
            />

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-2.5 py-1 rounded-lg text-xs bg-[#334155]/60 hover:bg-[#334155] text-[#D1E8E2] flex items-center gap-1 transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Selection Actions */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 p-1 rounded-xl bg-[#116466]/20 border border-[#116466]/40">
              <span className="text-xs font-bold text-[#D1E8E2] px-2">
                {selectedIds.length} Selected
              </span>
              <button
                onClick={handleBatchCopyOCR}
                className="px-2.5 py-1 rounded-lg bg-[#116466] hover:bg-[#116466]/80 text-[#F1F5F9] text-xs font-semibold flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy OCR</span>
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="px-2 py-1 text-xs text-[#D1E8E2]/60 hover:text-white"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Timeline Stream */}
      {groups.length === 0 ? (
        <div className="p-12 rounded-3xl border border-dashed border-[#334155] text-center space-y-3 bg-[#1E293B]/40">
          <ImageIcon className="w-10 h-10 text-[#D1E8E2]/30 mx-auto" />
          <h3 className="text-sm font-semibold text-[#F1F5F9]">No screenshots found in this timeline</h3>
          <p className="text-xs text-[#D1E8E2]/60 max-w-sm mx-auto">
            Try adjusting your search query, date range, or app filter.
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-3.5 py-1.5 rounded-xl bg-[#116466] text-[#F1F5F9] text-xs font-semibold hover:bg-[#116466]/80 transition cursor-pointer"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {groups.map((group) => {
            const IconComponent = group.icon;
            const hasItems = group.items.length > 0;

            return (
              <div
                key={group.id}
                id={`timeline-group-${group.id}`}
                className="space-y-4 scroll-mt-24"
              >
                {/* STICKY DATE HEADER (Google Photos / Cyber Teal Style) */}
                <div className="sticky top-0 z-30 px-5 py-3.5 rounded-2xl border border-[#334155] bg-[#0B0F19]/90 backdrop-blur-xl shadow-lg flex items-center justify-between transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[#116466]/20 border border-[#116466]/40 text-[#D1E8E2]">
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-[#F1F5F9] tracking-tight">{group.title}</h2>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#116466]/30 text-[#D1E8E2] border border-[#116466]/50">
                          {group.items.length} {group.items.length === 1 ? "item" : "items"}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#D1E8E2]/60 font-medium">{group.subtitle}</p>
                    </div>
                  </div>

                  {/* Quick Select All in Group */}
                  {hasItems && (
                    <button
                      onClick={() => {
                        const groupItemIds = group.items.map((i) => i.id);
                        const allSelected = groupItemIds.every((id) => selectedIds.includes(id));
                        if (allSelected) {
                          setSelectedIds((prev) => prev.filter((id) => !groupItemIds.includes(id)));
                        } else {
                          setSelectedIds((prev) => Array.from(new Set([...prev, ...groupItemIds])));
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-xs font-semibold text-[#D1E8E2] flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-[#116466]" />
                      <span className="hidden sm:inline">Select Group</span>
                    </button>
                  )}
                </div>

                {/* Group Photo Grid */}
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.03,
                      },
                    },
                  }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
                >
                  {group.items.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <ScreenshotCard
                        key={item.id}
                        item={item}
                        isDark={isDark}
                        isSelected={isSelected}
                        isSelectionMode={selectedIds.length > 0}
                        onSelect={() => onSelectScreenshot(item)}
                        onToggleSelect={toggleSelect}
                        onToggleFavorite={() => onToggleFavorite(item.id)}
                        onDelete={() => onDeleteScreenshot(item.id)}
                        onCopyText={(txt) => {
                          onCopyText(txt);
                          addToast({
                            title: "Text Copied",
                            description: "Copied OCR text to clipboard.",
                            type: "info",
                          });
                        }}
                      />
                    );
                  })}
                </motion.div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Scroll to Top button */}
      <button
        onClick={scrollToTop}
        className="fixed bottom-20 right-6 z-40 p-3 rounded-full bg-[#116466] hover:bg-[#116466]/80 text-[#F1F5F9] shadow-2xl shadow-[#116466]/50 transition-all cursor-pointer hover:scale-110"
        title="Scroll to top"
      >
        <ArrowUp className="w-5 h-5" />
      </button>
    </div>
  );
};
