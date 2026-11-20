import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Sparkles,
  Image as ImageIcon,
  Calendar,
  Tag,
  X,
  ArrowUpDown,
  Clock,
  SlidersHorizontal,
  Heart,
  Trash2,
  Loader2,
  Upload,
} from "lucide-react";
import { ScreenshotItem, SearchResultMatch, CategoryType, SearchHistoryItem } from "../types";
import { SearchBar } from "./SearchBar";
import { ScreenshotCard } from "./ScreenshotCard";
import { PaginationControls } from "./PaginationControls";
import { instantKeywordSearch } from "../services/api";
import { PageHeroHeader } from "./PageHeroHeader";

interface SearchViewProps {
  screenshots: ScreenshotItem[];
  searchResults: SearchResultMatch[];
  query: string;
  setQuery: (q: string) => void;
  onExecuteSearch: (q: string) => void;
  selectedCategory: CategoryType;
  setSelectedCategory: (cat: CategoryType) => void;
  isDark?: boolean;
  isSearching?: boolean;
  onSelectScreenshot: (item: ScreenshotItem) => void;
  onToggleFavorite: (id: string) => void;
  onMoveCategory: (id: string, cat: CategoryType) => void;
  onDelete: (id: string) => void;
  onCopyText?: (text: string) => void;
  searchHistory?: SearchHistoryItem[];
  onDeleteHistoryItem?: (id: string) => void;
  onClearHistory?: () => void;
  onOpenImport?: () => void;
  onOpenDemo?: (initialQuery?: string) => void;
  onLoadSamplePack?: () => void;
}

const EXAMPLE_SEARCHES = [
  "receipt",
  "invoice",
  "flight ticket",
  "password",
  "code",
  "bank transfer",
];

const QUICK_CATEGORIES: CategoryType[] = [
  "All",
  "Receipt & Invoice",
  "Ticket & Travel",
  "Financial",
  "Code & Dev",
  "Chat & Message",
  "Notes & Ideas",
  "E-Commerce",
];

const SEARCH_RESULTS_PER_PAGE = 12;

export const SearchView: React.FC<SearchViewProps> = ({
  screenshots,
  searchResults,
  query,
  setQuery,
  onExecuteSearch,
  selectedCategory,
  setSelectedCategory,
  isDark = true,
  isSearching = false,
  onSelectScreenshot,
  onToggleFavorite,
  onMoveCategory,
  onDelete,
  onCopyText,
  searchHistory = [],
  onDeleteHistoryItem,
  onClearHistory,
  onOpenImport,
  onOpenDemo,
  onLoadSamplePack,
}) => {
  const [dateFilter, setDateFilter] = useState<"all" | "7d" | "30d" | "year">("all");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sortBy, setSortBy] = useState<"relevance" | "newest" | "oldest">("relevance");
  const [currentPage, setCurrentPage] = useState(1);

  const trimmedQuery = query.trim();
  const hasSearched = trimmedQuery.length > 0;

  // Merge AI/hybrid searchResults with instantKeywordSearch without breaking the indexing engine
  const { mergedMatches, matchMap } = useMemo(() => {
    if (!hasSearched) {
      return { mergedMatches: [] as SearchResultMatch[], matchMap: new Map<string, SearchResultMatch>() };
    }

    const instantMatches = instantKeywordSearch(trimmedQuery, screenshots);
    const map = new Map<string, SearchResultMatch>();

    // Seed with AI / hybrid searchResults first (if provided by App.tsx)
    for (const m of searchResults || []) {
      if (m && m.id && !map.has(m.id)) {
        map.set(m.id, m);
      }
    }

    // Merge instant keyword matches (preserving OCR snippet & matchedTerms)
    for (const m of instantMatches) {
      const existing = map.get(m.id);
      if (!existing) {
        map.set(m.id, m);
      } else {
        map.set(m.id, {
          ...existing,
          score: Math.max(existing.score || 0, m.score || 0),
          highlightSnippet: existing.highlightSnippet || m.highlightSnippet,
          matchedTerms:
            existing.matchedTerms && existing.matchedTerms.length > 0
              ? existing.matchedTerms
              : m.matchedTerms,
          matchReason: existing.matchReason || m.matchReason,
        });
      }
    }

    const merged = Array.from(map.values()).sort((a, b) => (b.score || 0) - (a.score || 0));
    return { mergedMatches: merged, matchMap: map };
  }, [hasSearched, trimmedQuery, screenshots, searchResults]);

  const displayItems = useMemo(() => {
    const screenshotById = new Map<string, ScreenshotItem>();
    for (const sc of screenshots) {
      screenshotById.set(sc.id, sc);
    }

    let items: ScreenshotItem[] = hasSearched
      ? mergedMatches
          .map((m) => screenshotById.get(m.id))
          .filter((item): item is ScreenshotItem => Boolean(item))
      : [...screenshots];

    if (selectedCategory !== "All") {
      items = items.filter((item) => item.category === selectedCategory);
    }

    if (onlyFavorites) {
      items = items.filter((item) => Boolean(item.isFavorite || item.favorite));
    }

    if (dateFilter !== "all") {
      const now = Date.now();
      const windowMs =
        dateFilter === "7d"
          ? 7 * 24 * 60 * 60 * 1000
          : dateFilter === "30d"
          ? 30 * 24 * 60 * 60 * 1000
          : 365 * 24 * 60 * 60 * 1000;

      items = items.filter((item) => {
        const ts = new Date(item.createdAt || item.date_created || 0).getTime();
        return !Number.isNaN(ts) && now - ts <= windowMs;
      });
    }

    if (sortBy === "newest") {
      items.sort(
        (a, b) =>
          new Date(b.createdAt || b.date_created || 0).getTime() -
          new Date(a.createdAt || a.date_created || 0).getTime()
      );
    } else if (sortBy === "oldest") {
      items.sort(
        (a, b) =>
          new Date(a.createdAt || a.date_created || 0).getTime() -
          new Date(b.createdAt || b.date_created || 0).getTime()
      );
    } else if (hasSearched) {
      items.sort((a, b) => (matchMap.get(b.id)?.score || 0) - (matchMap.get(a.id)?.score || 0));
    }

    return items;
  }, [
    screenshots,
    hasSearched,
    mergedMatches,
    matchMap,
    selectedCategory,
    onlyFavorites,
    dateFilter,
    sortBy,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [trimmedQuery, selectedCategory, dateFilter, onlyFavorites, sortBy, screenshots.length]);

  const totalPages = Math.max(1, Math.ceil(displayItems.length / SEARCH_RESULTS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * SEARCH_RESULTS_PER_PAGE;
    return displayItems.slice(start, start + SEARCH_RESULTS_PER_PAGE);
  }, [displayItems, safePage]);

  const hasActiveFilters = selectedCategory !== "All" || dateFilter !== "all" || onlyFavorites;

  const handleClearSearch = () => {
    setQuery("");
    onExecuteSearch("");
  };

  const handleResetFilters = () => {
    setSelectedCategory("All");
    setDateFilter("all");
    setOnlyFavorites(false);
    setSortBy("relevance");
  };

  const handleRunExample = (example: string) => {
    setQuery(example);
    onExecuteSearch(example);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeroHeader
        type="search"
        title="Search Screenshots"
        subtitle="Find any screenshot instantly by extracted OCR text, descriptions, tags, categories, or keywords."
        isDark={isDark}
      />

      {/* Primary Search Input */}
      <div className="p-4 sm:p-5 rounded-2xl border bg-[#141714] border-[#30362E] space-y-4">
        <SearchBar
          query={query}
          setQuery={setQuery}
          onExecuteSearch={onExecuteSearch}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          isDark={isDark}
          isSearching={isSearching}
          screenshots={screenshots}
          searchHistory={searchHistory}
          onDeleteHistoryItem={onDeleteHistoryItem}
        />

        {/* Filters Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filter by category">
            {QUICK_CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    isActive
                      ? "bg-[#B7F36B] border-[#B7F36B] text-[#080908]"
                      : "bg-[#1B1F1A] border-[#30362E] text-[#A5AAA1] hover:text-[#F7F8F5] hover:border-[#777E74]"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Date, Favorites & Sort Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#777E74]" aria-hidden="true" />
              <label htmlFor="search-date-filter" className="sr-only">
                Filter by date range
              </label>
              <select
                id="search-date-filter"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as "all" | "7d" | "30d" | "year")}
                className="px-2.5 py-1.5 rounded-xl bg-[#0D0F0D] border border-[#30362E] text-xs font-medium text-[#F7F8F5] outline-none focus:border-[#B7F36B] cursor-pointer"
              >
                <option value="all">Any time</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="year">Past year</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setOnlyFavorites((prev) => !prev)}
              aria-pressed={onlyFavorites}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                onlyFavorites
                  ? "bg-[#B7F36B] border-[#B7F36B] text-[#080908]"
                  : "bg-[#0D0F0D] border-[#30362E] text-[#A5AAA1] hover:text-[#F7F8F5]"
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${onlyFavorites ? "fill-[#080908]" : ""}`} />
              <span>Favorites</span>
            </button>

            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#777E74]" aria-hidden="true" />
              <label htmlFor="search-sort-select" className="sr-only">
                Sort search results
              </label>
              <select
                id="search-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "relevance" | "newest" | "oldest")}
                className="px-2.5 py-1.5 rounded-xl bg-[#0D0F0D] border border-[#30362E] text-xs font-medium text-[#F7F8F5] outline-none focus:border-[#B7F36B] cursor-pointer"
              >
                <option value="relevance">Best match</option>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Searches Panel (clearly shown when idle or when history exists) */}
      {!hasSearched && searchHistory.length > 0 && (
        <section
          aria-label="Recent searches"
          className="p-4 sm:p-5 rounded-2xl border bg-[#141714] border-[#30362E] space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#A5AAA1] flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-[#B7F36B]" />
              Recent Searches
            </h2>
            {onClearHistory && (
              <button
                type="button"
                onClick={onClearHistory}
                className="text-xs font-semibold text-[#A5AAA1] hover:text-rose-400 transition-colors cursor-pointer"
              >
                Clear history
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {searchHistory.slice(0, 8).map((item) => (
              <div
                key={item.id}
                className="inline-flex items-center gap-1 rounded-xl bg-[#0D0F0D] border border-[#30362E] hover:border-[#B7F36B] transition-colors"
              >
                <button
                  type="button"
                  onClick={() => handleRunExample(item.query)}
                  className="px-3 py-1.5 text-xs font-medium text-[#F7F8F5] hover:text-[#B7F36B] flex items-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-3 h-3 text-[#777E74]" />
                  <span>{item.query}</span>
                  {typeof item.resultCount === "number" && (
                    <span className="text-[10px] font-mono text-[#777E74]">({item.resultCount})</span>
                  )}
                </button>
                {onDeleteHistoryItem && (
                  <button
                    type="button"
                    aria-label={`Delete recent search "${item.query}"`}
                    onClick={() => onDeleteHistoryItem(item.id)}
                    className="pr-2 pl-1 py-1.5 text-[#777E74] hover:text-rose-400 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active Search Results Header Bar */}
      {(hasSearched || hasActiveFilters) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border bg-[#141714] border-[#30362E]">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-[#F7F8F5]">
            <SlidersHorizontal className="w-4 h-4 text-[#B7F36B] shrink-0" />
            {isSearching && displayItems.length === 0 ? (
              <span className="flex items-center gap-2 text-[#A5AAA1]">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B7F36B]" />
                Searching your screenshots for &ldquo;{trimmedQuery}&rdquo;...
              </span>
            ) : (
              <span>
                <strong className="font-bold text-[#B7F36B]">{displayItems.length}</strong>{" "}
                {displayItems.length === 1 ? "screenshot" : "screenshots"}
                {hasSearched && (
                  <>
                    {" "}
                    matching <strong className="font-semibold">&ldquo;{trimmedQuery}&rdquo;</strong>
                  </>
                )}
              </span>
            )}
            {isSearching && displayItems.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#B7F36B] px-2 py-0.5 rounded-md bg-[#1B1F1A] border border-[#30362E]">
                <Loader2 className="w-3 h-3 animate-spin" /> Refining
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-xs font-semibold text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
              >
                Reset Filters
              </button>
            )}
            {hasSearched && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-3 py-1.5 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-xs font-semibold text-[#B7F36B] flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Clear Search
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results Content */}
      {isSearching && displayItems.length === 0 ? (
        /* Loading Skeleton Grid */
        <div
          role="status"
          aria-live="polite"
          aria-label="Searching screenshots"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl border bg-[#141714] border-[#30362E] overflow-hidden animate-pulse"
            >
              <div className="aspect-[16/10] w-full bg-[#1B1F1A]" />
              <div className="p-3.5 space-y-2.5">
                <div className="h-4 w-3/4 rounded bg-[#1B1F1A]" />
                <div className="h-3 w-full rounded bg-[#1B1F1A]" />
                <div className="h-3 w-2/3 rounded bg-[#1B1F1A]" />
                <div className="pt-2 flex items-center justify-between">
                  <div className="h-3 w-20 rounded bg-[#1B1F1A]" />
                  <div className="h-3 w-12 rounded bg-[#1B1F1A]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : screenshots.length === 0 ? (
        /* Empty Library State */
        <div className="py-14 px-6 text-center rounded-2xl border bg-[#141714] border-[#30362E] space-y-5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#1B1F1A] border border-[#30362E] text-[#B7F36B] flex items-center justify-center">
            <ImageIcon className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-[#F7F8F5]">No screenshots indexed yet</h3>
            <p className="text-sm text-[#A5AAA1] max-w-md mx-auto leading-relaxed">
              Import screenshots to extract searchable OCR text, descriptions, and tags automatically.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {onOpenImport && (
              <button
                type="button"
                onClick={onOpenImport}
                className="px-4 py-2.5 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#080908] text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Import Screenshots
              </button>
            )}
            {onLoadSamplePack && (
              <button
                type="button"
                onClick={onLoadSamplePack}
                className="px-4 py-2.5 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-[#F7F8F5] text-xs font-semibold cursor-pointer"
              >
                Load Sample Pack
              </button>
            )}
            {onOpenDemo && (
              <button
                type="button"
                onClick={() => onOpenDemo(trimmedQuery)}
                className="px-4 py-2.5 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-[#B7F36B] text-xs font-semibold cursor-pointer"
              >
                Try Interactive Demo
              </button>
            )}
          </div>
        </div>
      ) : displayItems.length === 0 ? (
        /* No Matching Results State */
        <div className="py-14 px-6 text-center rounded-2xl border bg-[#141714] border-[#30362E] space-y-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#1B1F1A] border border-[#30362E] text-[#A5AAA1] flex items-center justify-center">
            <Search className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-[#F7F8F5]">No matching screenshots found</h3>
            <p className="text-sm text-[#A5AAA1] max-w-md mx-auto leading-relaxed">
              {hasSearched
                ? `We couldn't find any screenshots matching "${trimmedQuery}"${hasActiveFilters ? " with the active filters" : ""}. Try broader keywords or clear your filters.`
                : "No screenshots match your current filters."}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {hasSearched && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-4 py-2.5 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#080908] text-xs font-bold cursor-pointer"
              >
                Clear Search
              </button>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2.5 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-[#F7F8F5] text-xs font-semibold cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-[#777E74]">Try searching:</span>
            {EXAMPLE_SEARCHES.slice(0, 4).map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => handleRunExample(ex)}
                className="px-3 py-1 rounded-lg bg-[#0D0F0D] border border-[#30362E] hover:border-[#B7F36B] text-xs text-[#A5AAA1] hover:text-[#B7F36B] cursor-pointer"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Matching Screenshots Grid */
        <div className="space-y-5">
          {!hasSearched && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="text-xs text-[#A5AAA1] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#B7F36B]" />
                Showing all <strong className="text-[#F7F8F5]">{displayItems.length}</strong> indexed screenshots
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-[#777E74]">Quick try:</span>
                {EXAMPLE_SEARCHES.slice(0, 4).map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => handleRunExample(ex)}
                    className="px-2.5 py-1 rounded-lg bg-[#141714] border border-[#30362E] hover:border-[#B7F36B] text-[11px] font-medium text-[#A5AAA1] hover:text-[#B7F36B] cursor-pointer"
                  >
                    <Tag className="w-2.5 h-2.5 inline mr-1" />
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedItems.map((item) => (
              <ScreenshotCard
                key={item.id}
                item={item}
                matchInfo={hasSearched ? matchMap.get(item.id) : undefined}
                isDark={isDark}
                onSelect={onSelectScreenshot}
                onToggleFavorite={onToggleFavorite}
                onMoveCategory={onMoveCategory}
                onDelete={onDelete}
                onCopyText={onCopyText}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <PaginationControls
              currentPage={safePage}
              totalPages={totalPages}
              totalItems={displayItems.length}
              itemsPerPage={SEARCH_RESULTS_PER_PAGE}
              onPageChange={setCurrentPage}
              isDark={isDark}
            />
          )}
        </div>
      )}
    </div>
  );
};
