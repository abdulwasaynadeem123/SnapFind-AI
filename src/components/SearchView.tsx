import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  SlidersHorizontal,
  RotateCcw,
  Play,
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
      {/* Search Hero Header */}
      {!hasSearched && (
        <PageHeroHeader
          type="search"
          title="Search your screenshots"
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
            <p className="text-xs sm:text-sm text-[#A5AAA1] font-medium">
              {displayItems.length === 1
                ? "1 result found"
                : `${displayItems.length} results found`}
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-[#A5AAA1] font-medium">
              {screenshots.length} total screenshots in vault
            </p>
          )}
        </div>

        {/* ONE Filter Button with Active Count Badge */}
        <button
          id="snapfind-open-filters-btn"
          type="button"
          onClick={() => setIsFilterPanelOpen(true)}
          className={`flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            activeFiltersCount > 0
              ? "bg-[#B7F36B] text-[#10130D] font-bold border-[#B7F36B] shadow-[2px_2px_8px_rgba(0,0,0,0.5)]"
              : "bg-[#141714] border-[#30362E] text-[#A5AAA1] hover:text-[#F7F8F5] hover:bg-[#1B1F1A] hover:border-[#B7F36B]"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate whitespace-nowrap">Filters</span>
          {activeFiltersCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-md bg-[#0D0F0D] text-[#B7F36B] text-[10px] font-mono font-bold border border-[#30362E]">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* 3. Empty Search State (When no search has been performed) */}
      {!hasSearched && (
        <div className="py-12 sm:py-16 text-center space-y-4 max-w-lg mx-auto">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-[#F7F8F5] truncate whitespace-nowrap">
              Find anything you've saved
            </h2>
            <p className="text-xs sm:text-sm text-[#A5AAA1] leading-relaxed truncate whitespace-nowrap">
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
                className="px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-semibold border border-[#30362E] bg-[#141714] hover:bg-[#1B1F1A] text-[#A5AAA1] hover:text-[#F7F8F5] hover:border-[#B7F36B] transition-all cursor-pointer flex items-center gap-1.5 shadow-[2px_2px_6px_rgba(0,0,0,0.4)]"
              >
                <span className="truncate whitespace-nowrap">"{example}"</span>
                <ArrowRight className="w-3 h-3 text-[#B7F36B] shrink-0" />
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
              <div className="w-14 h-14 rounded-2xl bg-[#141714] border border-[#30362E] flex items-center justify-center mx-auto text-[#B7F36B] shadow-[6px_6px_16px_rgba(0,0,0,0.65)]">
                <Search className="w-7 h-7 text-[#B7F36B]" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base sm:text-lg font-bold text-[#F7F8F5] truncate whitespace-nowrap">
                  Your screenshot vault is empty
                </h3>
                <p className="text-xs text-[#A5AAA1] max-w-md mx-auto leading-relaxed">
                  You have not added any screenshots to your vault yet. Upload your own screenshots or explore the interactive demo with 6 pre-indexed sample files.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {onOpenDemo && (
                  <button
                    type="button"
                    onClick={() => onOpenDemo(query)}
                    className="px-4 py-2.5 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 active:scale-98 shadow-[2px_2px_8px_rgba(0,0,0,0.5)] border border-[#B7F36B]"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Try Query in Demo</span>
                  </button>
                )}
                {onOpenImport && (
                  <button
                    type="button"
                    onClick={onOpenImport}
                    className="px-4 py-2.5 rounded-xl border border-[#30362E] bg-[#141714] hover:bg-[#1B1F1A] text-[#F7F8F5] hover:border-[#B7F36B] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Upload Screenshots
                  </button>
                )}
                {onLoadSamplePack && (
                  <button
                    type="button"
                    onClick={onLoadSamplePack}
                    className="px-4 py-2.5 rounded-xl border border-[#30362E] bg-[#141714] hover:bg-[#1B1F1A] text-[#A5AAA1] hover:text-[#F7F8F5] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Load 6 Sample Files
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Scenario B: Vault has screenshots, but this search returned 0 matches */
            <>
              <div className="w-12 h-12 rounded-2xl bg-[#141714] border border-[#30362E] flex items-center justify-center mx-auto text-[#B7F36B] shadow-[4px_4px_12px_rgba(0,0,0,0.5)]">
                <FilterX className="w-6 h-6 text-[#B7F36B]" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-semibold text-[#F7F8F5]">
                  No matching screenshots found for "{query}"
                </h3>
                <p className="text-xs text-[#A5AAA1] max-w-md mx-auto leading-relaxed">
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
                  className="px-4 py-2 rounded-xl border border-[#30362E] text-xs font-semibold text-[#A5AAA1] hover:text-[#F7F8F5] hover:bg-[#141714] transition-colors cursor-pointer"
                >
                  Clear Search
                </button>
                <button
                  type="button"
                  onClick={() => setIsFilterPanelOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] text-xs font-bold shadow-[2px_2px_8px_rgba(0,0,0,0.5)] border border-[#B7F36B] transition-colors cursor-pointer active:scale-98"
                >
                  Adjust Filters
                </button>
                {onOpenDemo && (
                  <button
                    type="button"
                    onClick={() => onOpenDemo(query)}
                    className="px-4 py-2 rounded-xl border border-[#30362E] text-[#A5AAA1] hover:text-[#F7F8F5] hover:bg-[#141714] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Search in Public Demo
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* 5. Clean Responsive Results Grid (1, 2, or 4 columns - NO 3-card rows) */}
      {displayItems.length > 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
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
