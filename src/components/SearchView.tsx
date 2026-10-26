import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  ArrowRight,
  FilterX,
} from "lucide-react";
import { ScreenshotItem, SearchResultMatch, CategoryType, SearchHistoryItem } from "../types";
import { ScreenshotCard } from "./ScreenshotCard";
import { instantKeywordSearch } from "../services/api";
import { PaginationControls } from "./PaginationControls";
import { SearchBar } from "./SearchBar";
import { PageHeroHeader } from "./PageHeroHeader";
import {
  SearchFilterPanel,
  FilterState,
  DateFilterType,
  SortOptionType,
  ProcessingStatusType,
  FileTypeFilter,
} from "./SearchFilterPanel";

interface SearchViewProps {
  screenshots: ScreenshotItem[];
  searchResults: SearchResultMatch[];
  query: string;
  setQuery: (q: string) => void;
  onExecuteSearch: (q: string) => void;
  selectedCategory: CategoryType;
  setSelectedCategory: (cat: CategoryType) => void;
  isDark: boolean;
  isSearching: boolean;
  onSelectScreenshot: (item: ScreenshotItem) => void;
  onToggleFavorite: (id: string) => void;
  onMoveCategory?: (id: string, newCategory: CategoryType) => void;
  onDelete: (id: string) => void;
  onCopyText: (text: string) => void;
  searchHistory?: SearchHistoryItem[];
  onDeleteHistoryItem?: (id: string) => void;
  onClearHistory?: () => void;
  onOpenImport?: () => void;
  onOpenDemo?: (query?: string) => void;
  onLoadSamplePack?: () => void;
}

const EXAMPLE_SEARCHES = [
  "Find my passport",
  "Show shopping receipts",
  "Find my resume",
];

export const SearchView: React.FC<SearchViewProps> = ({
  screenshots,
  query,
  setQuery,
  onExecuteSearch,
  selectedCategory,
  setSelectedCategory,
  isDark,
  isSearching,
  onSelectScreenshot,
  onToggleFavorite,
  onMoveCategory,
  onDelete,
  onCopyText,
  searchHistory = [],
  onDeleteHistoryItem,
  onOpenImport,
  onOpenDemo,
  onLoadSamplePack,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Consolidated Filter State
  const [filters, setFilters] = useState<FilterState>({
    category: selectedCategory || "All",
    date: "all",
    onlyFavorites: false,
    hasOcrText: false,
    aiAnalyzed: false,
    processingStatus: "all",
    fileType: "all",
    sortBy: "relevance",
  });

  // Sync external category prop with internal filter state
  useEffect(() => {
    if (selectedCategory && selectedCategory !== filters.category) {
      setFilters((prev) => ({ ...prev, category: selectedCategory }));
    }
  }, [selectedCategory]);

  const handleUpdateFilters = (newFilters: Partial<FilterState>) => {
    setFilters((prev) => {
      const updated = { ...prev, ...newFilters };
      if (newFilters.category && newFilters.category !== selectedCategory) {
        setSelectedCategory(newFilters.category);
      }
      return updated;
    });
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFilters({
      category: "All",
      date: "all",
      onlyFavorites: false,
      hasOcrText: false,
      aiAnalyzed: false,
      processingStatus: "all",
      fileType: "all",
      sortBy: "relevance",
    });
    setSelectedCategory("All");
    setCurrentPage(1);
  };

  // Count active non-default filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.category !== "All") count++;
    if (filters.date !== "all") count++;
    if (filters.onlyFavorites) count++;
    if (filters.hasOcrText) count++;
    if (filters.aiAnalyzed) count++;
    if (filters.processingStatus !== "all") count++;
    if (filters.fileType !== "all") count++;
    if (filters.sortBy !== "relevance") count++;
    return count;
  }, [filters]);

  // Compute instantaneous keyword search results
  const activeMatches = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return instantKeywordSearch(q, screenshots);
  }, [query, screenshots]);

  const screenshotMap = useMemo(() => {
    return new Map<string, ScreenshotItem>(screenshots.map((s) => [s.id, s]));
  }, [screenshots]);

  const matchMap = useMemo(() => {
    return new Map<string, SearchResultMatch>(activeMatches.map((r) => [r.id, r]));
  }, [activeMatches]);

  // Filter & Sort Results
  const displayItems = useMemo(() => {
    const rawList = query.trim()
      ? activeMatches
          .map((m) => screenshotMap.get(m.id))
          .filter((s): s is ScreenshotItem => Boolean(s))
      : screenshots;

    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    return rawList
      .filter((item) => {
        // Exclude deleted items
        if (item.isDeleted || item.is_deleted) return false;

        // 1. Category
        if (filters.category !== "All" && item.category !== filters.category) {
          return false;
        }

        // 2. Only Favorites
        if (filters.onlyFavorites && !item.isFavorite && !item.favorite) {
          return false;
        }

        // 3. Has OCR text
        if (filters.hasOcrText && !item.ocr_text?.trim() && (!item.fullText || item.fullText.trim().length < 5)) {
          return false;
        }

        // 4. AI Analyzed
        if (filters.aiAnalyzed && (!item.tags || item.tags.length === 0) && !item.summary) {
          return false;
        }

        // 5. Processing Status
        const isFullyIndexed = Boolean(item.summary && (item.ocr_text || item.fullText));
        if (filters.processingStatus === "indexed" && !isFullyIndexed) {
          return false;
        }
        if (filters.processingStatus === "pending" && isFullyIndexed) {
          return false;
        }

        // 6. File Type
        if (filters.fileType !== "all") {
          const name = (item.fileName || item.file_name || "").toLowerCase();
          const uri = (item.imageUrl || item.image_uri || "").toLowerCase();
          if (filters.fileType === "png" && !name.endsWith(".png") && !uri.includes("png")) return false;
          if (filters.fileType === "jpeg" && !name.endsWith(".jpg") && !name.endsWith(".jpeg") && !uri.includes("jpeg")) return false;
          if (filters.fileType === "webp" && !name.endsWith(".webp") && !uri.includes("webp")) return false;
        }

        // 7. Date Filter
        if (filters.date !== "all") {
          const itemTime = new Date(item.createdAt).getTime();
          const diff = now - itemTime;
          if (filters.date === "today" && diff > ONE_DAY_MS) return false;
          if (filters.date === "week" && diff > 7 * ONE_DAY_MS) return false;
          if (filters.date === "month" && diff > 30 * ONE_DAY_MS) return false;
          if (filters.date === "year" && diff > 365 * ONE_DAY_MS) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (filters.sortBy === "relevance" && query.trim()) {
          const scoreA = matchMap.get(a.id)?.score || 0;
          const scoreB = matchMap.get(b.id)?.score || 0;
          return scoreB - scoreA;
        }
        if (filters.sortBy === "newest") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (filters.sortBy === "oldest") {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (filters.sortBy === "ocrScore") {
          return (b.ocrAccuracyScore || 0.8) - (a.ocrAccuracyScore || 0.8);
        }
        return 0;
      });
  }, [query, activeMatches, screenshots, filters, matchMap, screenshotMap]);

  // Pagination
  const totalPages = Math.ceil(displayItems.length / itemsPerPage) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return displayItems.slice(start, start + itemsPerPage);
  }, [displayItems, currentPage, itemsPerPage]);

  const hasSearched = query.trim().length > 0;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-16 px-3 sm:px-4 md:px-0 select-none">
      {/* 3D Search Hero Header */}
      {!hasSearched && (
        <PageHeroHeader
          type="search"
          title="Natural-Language Neural Search"
          subtitle="Search across all captured text, visual entities, receipts, code snippets, dates, and context in natural human language."
          isDark={isDark}
        />
      )}

      {/* 1. Main Search Bar at Top */}
      <div className="w-full pt-1">
        <SearchBar
          query={query}
          setQuery={setQuery}
          onExecuteSearch={onExecuteSearch}
          isDark={isDark}
          isSearching={isSearching}
          screenshots={screenshots}
          searchHistory={searchHistory}
          onDeleteHistoryItem={onDeleteHistoryItem}
          placeholder="Search screenshots by text, objects, dates, or natural language..."
        />
      </div>

      {/* 2. Top Controls Bar: Results Count & Filter Button */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div>
          {hasSearched ? (
            <p className="text-xs sm:text-sm text-[#94A3B8] font-medium">
              {displayItems.length === 1
                ? "1 result found"
                : `${displayItems.length} results found`}
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-[#94A3B8] font-medium">
              {screenshots.length} total screenshots in vault
            </p>
          )}
        </div>

        {/* ONE Filter Button with Active Count Badge */}
        <button
          id="snapfind-open-filters-btn"
          type="button"
          onClick={() => setIsFilterPanelOpen(true)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            activeFiltersCount > 0
              ? "bg-[#116466] text-[#F1F5F9] font-bold border-[#116466] shadow-[0_0_12px_rgba(17,100,102,0.3)]"
              : "bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#243347] hover:border-[#116466]"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filters</span>
          {activeFiltersCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-md bg-[#2C3531] text-[#D1E8E2] text-[10px] font-mono font-bold">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* 3. Empty Search State (When no search has been performed) */}
      {!hasSearched && (
        <div className="py-12 sm:py-16 text-center space-y-6 max-w-lg mx-auto">
          <div className="space-y-2">
            <div className="inline-block px-2.5 py-1 rounded-full bg-[#1E293B] border border-[#334155] text-[#D1E8E2] font-mono text-[10px] font-bold tracking-wider uppercase mb-1">
              [NATURAL_LANGUAGE // RETRIEVAL]
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#F1F5F9]">
              Find anything you've saved.
            </h2>
            <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
              Search screenshots using words, descriptions, receipt amounts, or natural language.
            </p>
          </div>

          {/* Minimal Subtle Example Searches */}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {EXAMPLE_SEARCHES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setQuery(example);
                  onExecuteSearch(example);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-medium border border-[#334155] bg-[#1E293B] hover:bg-[#243347] text-[#94A3B8] hover:text-[#D1E8E2] hover:border-[#116466] transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>"{example}"</span>
                <ArrowRight className="w-3 h-3 text-[#D1E8E2]" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. No Result State: Clear distinction between Empty Vault and Zero Search Matches */}
      {hasSearched && displayItems.length === 0 && (
        <div className="py-16 text-center space-y-4 max-w-lg mx-auto">
          {screenshots.length === 0 ? (
            /* Scenario A: Empty Vault */
            <>
              <div className="w-14 h-14 rounded-2xl bg-[#1E293B] border border-[#334155] flex items-center justify-center mx-auto text-[#D1E8E2]">
                <Sparkles className="w-7 h-7 text-[#D1E8E2]" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-[#F1F5F9]">
                  Your screenshot vault is empty
                </h3>
                <p className="text-xs text-[#94A3B8] max-w-md mx-auto leading-relaxed">
                  You have not added any screenshots to your vault yet. Upload your own screenshots or explore the interactive demo with 6 pre-indexed sample files.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {onOpenDemo && (
                  <button
                    type="button"
                    onClick={() => onOpenDemo(query)}
                    className="px-4 py-2.5 rounded-xl bg-[#116466] hover:bg-[#157F81] text-[#F1F5F9] text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 active:scale-98 shadow-[0_0_12px_rgba(17,100,102,0.3)] border border-[#116466]"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Try Query in Interactive Demo</span>
                  </button>
                )}
                {onOpenImport && (
                  <button
                    type="button"
                    onClick={onOpenImport}
                    className="px-4 py-2.5 rounded-xl border border-[#334155] bg-[#1E293B] hover:bg-[#243347] text-[#F1F5F9] hover:border-[#116466] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Upload Screenshots
                  </button>
                )}
                {onLoadSamplePack && (
                  <button
                    type="button"
                    onClick={onLoadSamplePack}
                    className="px-4 py-2.5 rounded-xl border border-[#334155] bg-[#1E293B] hover:bg-[#243347] text-[#94A3B8] hover:text-[#F1F5F9] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Load 6 Sample Files
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Scenario B: Vault has screenshots, but this search returned 0 matches */
            <>
              <div className="w-12 h-12 rounded-2xl bg-[#1E293B] border border-[#334155] flex items-center justify-center mx-auto text-[#D9B08C]">
                <FilterX className="w-6 h-6 text-[#D9B08C]" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-semibold text-[#F1F5F9]">
                  No matching screenshots found for "{query}"
                </h3>
                <p className="text-xs text-[#94A3B8] max-w-md mx-auto leading-relaxed">
                  We scanned {screenshots.length} screenshot{screenshots.length > 1 ? "s" : ""} in your vault, but none matched. Check your spelling, try broader keywords, or reset category filters.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    onExecuteSearch("");
                  }}
                  className="px-4 py-2 rounded-xl border border-[#334155] text-xs font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1E293B] transition-colors cursor-pointer"
                >
                  Clear Search
                </button>
                <button
                  type="button"
                  onClick={() => setIsFilterPanelOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#116466] hover:bg-[#157F81] text-[#F1F5F9] text-xs font-semibold shadow-[0_0_12px_rgba(17,100,102,0.3)] border border-[#116466] transition-colors cursor-pointer active:scale-98"
                >
                  Adjust Filters
                </button>
                {onOpenDemo && (
                  <button
                    type="button"
                    onClick={() => onOpenDemo(query)}
                    className="px-4 py-2 rounded-xl border border-[#334155] text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1E293B] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Search in Public Demo
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* 5. Clean Responsive Results Grid */}
      {displayItems.length > 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-5">
            {paginatedItems.map((item) => (
              <ScreenshotCard
                key={item.id}
                item={item}
                matchInfo={matchMap.get(item.id)}
                isDark={isDark}
                onSelect={onSelectScreenshot}
                onToggleFavorite={onToggleFavorite}
                onMoveCategory={onMoveCategory}
                onDelete={onDelete}
                onCopyText={onCopyText}
              />
            ))}
          </div>

          {/* Pagination Controls if more than itemsPerPage */}
          {totalPages > 1 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={displayItems.length}
              itemsPerPage={itemsPerPage}
              onPageChange={(page) => {
                setCurrentPage(page);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onItemsPerPageChange={(num) => {
                setItemsPerPage(num);
                setCurrentPage(1);
              }}
              isDark={isDark}
            />
          )}
        </div>
      )}

      {/* Filter Slide-over Drawer / Mobile Bottom Sheet */}
      <SearchFilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        filters={filters}
        onUpdateFilters={handleUpdateFilters}
        onClearFilters={handleClearFilters}
        activeCount={activeFiltersCount}
        isDark={isDark}
      />
    </div>
  );
};
