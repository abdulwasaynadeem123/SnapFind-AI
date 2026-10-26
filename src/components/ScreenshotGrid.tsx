import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  CheckSquare,
  Square,
  Trash2,
  Star,
  FolderInput,
  X,
  Copy,
  LayoutGrid,
  Grid3X3,
  List,
  Sparkles,
  Download,
  Share2,
  RefreshCw,
  CheckCircle2,
  Layers,
  FileText,
  FileCode,
  SlidersHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ScreenshotItem, SearchResultMatch, CategoryType } from "../types";
import { ScreenshotCard } from "./ScreenshotCard";
import { PaginationControls } from "./PaginationControls";
import { preloadImages } from "../services/imageCache";
import { PageHeroHeader } from "./PageHeroHeader";

interface ScreenshotGridProps {
  screenshots: ScreenshotItem[];
  searchResults: SearchResultMatch[];
  searchQuery: string;
  selectedCategory: CategoryType;
  setSelectedCategory: (cat: CategoryType) => void;
  isDark: boolean;
  onSelect: (item: ScreenshotItem) => void;
  onToggleFavorite: (id: string) => void;
  onMoveCategory?: (id: string, newCategory: CategoryType) => void;
  onDelete: (id: string) => void;
  onBatchDelete?: (ids: string[]) => void;
  onBatchFavorite?: (ids: string[], isFavorite: boolean) => void;
  onBatchMoveCategory?: (ids: string[], newCategory: CategoryType) => void;
  onBatchExport?: (ids: string[], format: "json" | "txt" | "md") => void;
  onBatchShare?: (ids: string[]) => void;
  onBatchReindex?: (ids: string[]) => void;
  onCopyText: (text: string) => void;
  onOpenImport: () => void;
  onOpenDemo?: () => void;
  onLoadSamplePack?: () => void;
}

const ALL_CATEGORIES: CategoryType[] = [
  "All",
  "Favorites",
  "Passport",
  "Electricity Bill",
  "Recipe",
  "QR Code",
  "Ticket & Travel",
  "Receipt & Invoice",
  "Notes & Ideas",
  "Chat & Message",
  "Code & Dev",
  "E-Commerce",
  "Admission & Certificate",
  "Financial",
  "Other",
];

const TARGET_MOVE_CATEGORIES: CategoryType[] = [
  "Passport",
  "Electricity Bill",
  "Recipe",
  "QR Code",
  "Ticket & Travel",
  "Receipt & Invoice",
  "Notes & Ideas",
  "Chat & Message",
  "Code & Dev",
  "E-Commerce",
  "Admission & Certificate",
  "Financial",
  "Other",
];

export const ScreenshotGrid: React.FC<ScreenshotGridProps> = ({
  screenshots,
  searchResults,
  searchQuery,
  selectedCategory,
  setSelectedCategory,
  isDark,
  onSelect,
  onToggleFavorite,
  onMoveCategory,
  onDelete,
  onBatchDelete,
  onBatchFavorite,
  onBatchMoveCategory,
  onBatchExport,
  onBatchShare,
  onBatchReindex,
  onCopyText,
  onOpenImport,
  onOpenDemo,
  onLoadSamplePack,
}) => {
  const [sortMode, setSortMode] = useState<"recent" | "oldest" | "category" | "title">("recent");
  const [viewLayout, setViewLayout] = useState<"grid" | "compact" | "list">("grid");
  const [localSearch, setLocalSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Modals state
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [targetCategory, setTargetCategory] = useState<CategoryType>("Passport");
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);

  // Reset pagination on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, sortMode, searchQuery, localSearch]);

  // Clear selection if category or query changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedCategory, searchQuery]);

  // Handle single item selection toggle
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle select all items in view
  const handleToggleSelectAll = () => {
    if (selectedIds.size === paginatedItems.length && paginatedItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedItems.map((item) => item.id)));
    }
  };

  // Select all matching items across all pages
  const handleSelectAllFiltered = () => {
    setSelectedIds(new Set(filtered.map((item) => item.id)));
  };

  // Invert selection
  const handleInvertSelection = () => {
    const next = new Set<string>();
    paginatedItems.forEach((item) => {
      if (!selectedIds.has(item.id)) {
        next.add(item.id);
      }
    });
    setSelectedIds(next);
  };

  // Filter screenshots by Category / Favorites
  let filtered = screenshots.filter((item) => {
    if (selectedCategory === "All") return true;
    if (selectedCategory === "Favorites") return item.isFavorite;
    return item.category === selectedCategory;
  });

  // Local Keyword Search inside Gallery
  if (localSearch.trim()) {
    const term = localSearch.toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term) ||
        item.summary.toLowerCase().includes(term) ||
        item.fullText.toLowerCase().includes(term) ||
        item.tags.some((t) => t.toLowerCase().includes(term))
    );
  }

  // Map match info from AI search
  const matchMap = new Map<string, SearchResultMatch>();
  searchResults.forEach((r) => matchMap.set(r.id, r));

  // If active AI search query, filter & sort by search match
  if (searchQuery.trim()) {
    if (searchResults.length > 0) {
      const matchIds = new Set(searchResults.map((r) => r.id));
      filtered = filtered.filter((item) => matchIds.has(item.id));

      // Sort by search score descending
      filtered.sort((a, b) => {
        const scoreA = matchMap.get(a.id)?.score || 0;
        const scoreB = matchMap.get(b.id)?.score || 0;
        return scoreB - scoreA;
      });
    } else {
      // Fallback simple query filter
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          item.fullText.toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
  } else {
    // Standard sorting
    if (sortMode === "recent") {
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortMode === "oldest") {
      filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortMode === "category") {
      filtered.sort((a, b) => a.category.localeCompare(b.category));
    } else if (sortMode === "title") {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    }
  }

  // Preload images for current items
  useEffect(() => {
    if (filtered.length > 0) {
      preloadImages(filtered.slice(0, 24).map((f) => f.imageUrl));
    }
  }, [filtered]);

  // Calculate paginated subset
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const paginatedItems = filtered.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  // Bulk Actions
  const handleExecuteBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (onBatchDelete) {
      onBatchDelete(ids);
    } else {
      ids.forEach((id) => onDelete(id));
    }
    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
  };

  const handleExecuteBulkFavorite = (isFav: boolean) => {
    const ids = Array.from(selectedIds);
    if (onBatchFavorite) {
      onBatchFavorite(ids, isFav);
    } else {
      ids.forEach((id) => onToggleFavorite(id));
    }
    setSelectedIds(new Set());
  };

  const handleExecuteBulkMove = () => {
    const ids = Array.from(selectedIds);
    if (onBatchMoveCategory) {
      onBatchMoveCategory(ids, targetCategory);
    } else if (onMoveCategory) {
      ids.forEach((id) => onMoveCategory(id, targetCategory));
    }
    setSelectedIds(new Set());
    setShowBulkMoveModal(false);
  };

  const handleExecuteBulkCopyText = () => {
    const ids = Array.from(selectedIds);
    const selectedItems = screenshots.filter((s) => ids.includes(s.id));
    const combinedText = selectedItems
      .map((s) => `--- ${s.title} (${s.category}) ---\n${s.fullText || s.summary}`)
      .join("\n\n");
    onCopyText(combinedText);
  };

  const handleExecuteExport = (format: "json" | "txt" | "md") => {
    const ids = Array.from(selectedIds);
    if (onBatchExport) {
      onBatchExport(ids, format);
    } else {
      handleExecuteBulkCopyText();
    }
    setShowExportModal(false);
    setSelectedIds(new Set());
  };

  const handleExecuteShare = () => {
    const ids = Array.from(selectedIds);
    if (onBatchShare) {
      onBatchShare(ids);
    } else {
      handleExecuteBulkCopyText();
    }
  };

  const handleExecuteReindex = () => {
    const ids = Array.from(selectedIds);
    setIsReindexing(true);
    setTimeout(() => {
      if (onBatchReindex) {
        onBatchReindex(ids);
      }
      setIsReindexing(false);
      setSelectedIds(new Set());
    }, 800);
  };

  return (
    <div className="space-y-6 relative">
      {/* 3D Gallery Hero Header */}
      {!searchQuery && (
        <PageHeroHeader
          type="gallery"
          title="Visual Knowledge Vault"
          subtitle="Explore, organize, and retrieve your screenshots with multi-select actions, categorized filtering, and OCR text extraction."
          isDark={isDark}
        />
      )}

      {/* Category Pills & Interactive Filters Toolbar */}
      <div className="space-y-4 pb-4 border-b border-[#334155]">
        {/* Category Pills */}
        <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex items-center gap-2">
            {ALL_CATEGORIES.map((cat) => {
              const isFavPill = cat === "Favorites";
              const isSelectedCat = selectedCategory === cat;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelectedCat
                      ? "bg-[#116466] text-[#F1F5F9] border border-[#116466] font-bold shadow-[0_0_12px_rgba(17,100,102,0.3)]"
                      : "bg-[#1E293B] border border-[#334155] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#116466] hover:bg-[#243347]"
                  }`}
                >
                  {isFavPill && <Star className={`w-3.5 h-3.5 ${isSelectedCat ? "text-[#D9B08C] fill-[#D9B08C]" : "text-[#D9B08C] fill-none"}`} />}
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Gallery Controls & Selection Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Quick Search inside Gallery */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Filter vault..."
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs font-medium border border-[#334155] bg-[#1E293B] text-[#F1F5F9] placeholder-[#94A3B8]/60 focus:border-[#116466] focus:outline-none transition-colors"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F1F5F9] p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right Toolbar Actions */}
          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
            {/* Multi-Select Toggle Button */}
            <button
              type="button"
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                if (isSelectionMode) setSelectedIds(new Set());
              }}
              className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                isSelectionMode || selectedIds.size > 0
                  ? "bg-[#116466] text-[#F1F5F9] border-[#116466] font-bold shadow-[0_0_12px_rgba(17,100,102,0.3)]"
                  : "bg-[#1E293B] border-[#334155] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#116466]"
              }`}
            >
              {selectedIds.size > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              <span>{isSelectionMode ? "Exit Multi-Select" : "Multi-Select"}</span>
            </button>

            {/* Select Quick Tools */}
            {(isSelectionMode || selectedIds.size > 0) && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="px-2.5 py-1.5 rounded-lg border border-[#334155] bg-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9] text-xs font-medium transition-colors"
                  title="Select / deselect items on current page"
                >
                  {selectedIds.size === paginatedItems.length && paginatedItems.length > 0
                    ? "Deselect Page"
                    : "Select Page"}
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="px-2.5 py-1.5 rounded-lg border border-[#334155] bg-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9] text-xs font-medium transition-colors"
                  title="Select all matching items"
                >
                  Select All ({filtered.length})
                </button>
              </div>
            )}

            {/* Layout View Switcher */}
            <div className="flex items-center p-0.5 rounded-lg border border-[#334155] bg-[#1E293B]">
              <button
                type="button"
                onClick={() => setViewLayout("grid")}
                className={`p-1.5 rounded-md transition-all ${
                  viewLayout === "grid" ? "bg-[#116466] text-[#F1F5F9]" : "text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
                title="Default Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewLayout("compact")}
                className={`p-1.5 rounded-md transition-all ${
                  viewLayout === "compact" ? "bg-[#116466] text-[#F1F5F9]" : "text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
                title="Compact Grid View"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewLayout("list")}
                className={`p-1.5 rounded-md transition-all ${
                  viewLayout === "list" ? "bg-[#116466] text-[#F1F5F9]" : "text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Sort Select */}
            <select
              value={sortMode}
              onChange={(e: any) => setSortMode(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#334155] text-xs font-medium bg-[#1E293B] text-[#F1F5F9] focus:border-[#116466] outline-none cursor-pointer"
            >
              <option value="recent">Sort: Most Recent</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="category">Sort: Category</option>
              <option value="title">Sort: Title (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid Content */}
      {filtered.length > 0 ? (
        <>
          <motion.div
            layout
            className={
              viewLayout === "compact"
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-5"
                : viewLayout === "list"
                ? "grid grid-cols-1 gap-3.5"
                : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6"
            }
          >
            {paginatedItems.map((item) => (
              <ScreenshotCard
                key={item.id}
                item={item}
                matchInfo={matchMap.get(item.id)}
                isDark={isDark}
                isSelected={selectedIds.has(item.id)}
                isSelectionMode={isSelectionMode || selectedIds.size > 0}
                onSelect={onSelect}
                onToggleSelect={handleToggleSelect}
                onToggleFavorite={onToggleFavorite}
                onMoveCategory={onMoveCategory}
                onDelete={onDelete}
                onCopyText={onCopyText}
              />
            ))}
          </motion.div>

          {/* Pagination Controls */}
          <PaginationControls
            currentPage={safePage}
            totalPages={totalPages}
            totalItems={filtered.length}
            itemsPerPage={itemsPerPage}
            onPageChange={(p) => setCurrentPage(p)}
            onItemsPerPageChange={(num) => setItemsPerPage(num)}
            isDark={isDark}
          />
        </>
      ) : (
        /* Empty State */
        <div className="text-center py-16 px-4 rounded-3xl border border-[#334155] bg-[#1E293B]/95 backdrop-blur-md flex flex-col items-center justify-center text-[#F1F5F9] space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#2C3531] border border-[#334155] flex items-center justify-center text-[#D1E8E2]">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-lg font-bold tracking-tight text-[#F1F5F9]">
              {screenshots.length === 0
                ? "Your Screenshot Vault is Ready."
                : "No matching screenshots found."}
            </h3>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              {screenshots.length === 0
                ? "Upload or drag screenshots to index text, extract amounts, and categorize them automatically."
                : searchQuery || localSearch
                ? "No screenshots matched your current filter. Try clearing terms or explore other categories."
                : "We'll organize and index your screenshots automatically with privacy protection."}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {(searchQuery || localSearch || selectedCategory !== "All") && screenshots.length > 0 && (
              <button
                onClick={() => {
                  setSelectedCategory("All");
                  setLocalSearch("");
                }}
                className="px-4 py-2.5 rounded-xl border border-[#334155] bg-[#1E293B] hover:bg-[#243347] text-xs font-semibold text-[#94A3B8] hover:text-[#F1F5F9] transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            )}
            <button
              onClick={onOpenImport}
              className="px-5 py-2.5 rounded-2xl bg-[#116466] hover:bg-[#157F81] text-[#F1F5F9] text-xs font-bold shadow-lg shadow-[#116466]/20 border border-[#116466] transition-all cursor-pointer"
            >
              Upload Screenshot
            </button>
            {screenshots.length === 0 && onOpenDemo && (
              <button
                onClick={onOpenDemo}
                className="px-4 py-2.5 rounded-2xl border border-[#334155] text-[#F1F5F9] hover:bg-[#243347] text-xs font-semibold transition-all cursor-pointer"
              >
                Try Interactive Demo
              </button>
            )}
            {screenshots.length === 0 && onLoadSamplePack && (
              <button
                onClick={onLoadSamplePack}
                className="px-4 py-2.5 rounded-2xl border border-[#334155] hover:bg-[#243347] text-[#94A3B8] hover:text-[#F1F5F9] text-xs font-semibold transition-all cursor-pointer"
              >
                Load 6 Sample Files
              </button>
            )}
          </div>
        </div>
      )}

      {/* Premium Floating Selection Dock with Spring Physics */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 70, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 70, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-3xl p-3 sm:p-4 rounded-3xl border shadow-2xl backdrop-blur-2xl bg-[#2C3531]/95 border-[#334155] text-[#F1F5F9] flex flex-col md:flex-row items-center justify-between gap-3.5"
          >
            {/* Dock Header: Counter & Selection Helpers */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start px-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#116466] opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#116466]" />
                </span>
                <span className="font-extrabold text-sm tracking-tight flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-lg bg-[#1E293B] text-[#D1E8E2] border border-[#334155] font-mono text-xs">
                    {selectedIds.size}
                  </span>
                  <span>Selected</span>
                </span>
              </div>

              {/* Quick Select Buttons */}
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  onClick={handleInvertSelection}
                  className="px-2 py-1 rounded-lg bg-[#1E293B] hover:bg-[#243347] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#334155] transition-all cursor-pointer"
                  title="Invert current selection"
                >
                  Invert
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-2 py-1 rounded-lg bg-[#1E293B] hover:bg-[#243347] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#334155] transition-all cursor-pointer"
                  title="Clear selection"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Action Dock Buttons (All 7 Actions) */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none justify-start md:justify-end">
              {/* 1. Delete Action */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-all shrink-0 cursor-pointer shadow-sm"
                title="Delete selected screenshots (Move to Trash)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </motion.button>

              {/* 2. Favorite Action */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => handleExecuteBulkFavorite(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#D9B08C]/20 hover:bg-[#D9B08C]/30 text-[#D9B08C] border border-[#D9B08C]/40 text-xs font-semibold transition-all shrink-0 cursor-pointer shadow-sm"
                title="Add selected to Favorites"
              >
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>Favorite</span>
              </motion.button>

              {/* 3. Move Collection / Category Action */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setShowBulkMoveModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#116466]/30 hover:bg-[#116466]/40 text-[#D1E8E2] border border-[#116466]/60 text-xs font-semibold transition-all shrink-0 cursor-pointer shadow-sm"
                title="Move selected to collection or category"
              >
                <FolderInput className="w-3.5 h-3.5" />
                <span>Move Collection</span>
              </motion.button>

              {/* 4. Export Action */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#1E293B] hover:bg-[#243347] text-[#F1F5F9] border border-[#334155] hover:border-[#116466] text-xs font-semibold transition-all shrink-0 cursor-pointer shadow-sm"
                title="Export selected (JSON, TXT, MD)"
              >
                <Download className="w-3.5 h-3.5 text-[#D1E8E2]" />
                <span>Export</span>
              </motion.button>

              {/* 5. Share Action */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                onClick={handleExecuteShare}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#1E293B] hover:bg-[#243347] text-[#F1F5F9] border border-[#334155] hover:border-[#116466] text-xs font-semibold transition-all shrink-0 cursor-pointer shadow-sm"
                title="Share selected items summary"
              >
                <Share2 className="w-3.5 h-3.5 text-[#D1E8E2]" />
                <span>Share</span>
              </motion.button>

              {/* 6. Copy OCR Action */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                onClick={handleExecuteBulkCopyText}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#116466]/40 hover:bg-[#116466]/50 text-[#D1E8E2] border border-[#116466]/60 text-xs font-semibold transition-all shrink-0 cursor-pointer shadow-sm"
                title="Copy full concatenated OCR text"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy OCR</span>
              </motion.button>

              {/* 7. Reindex Action */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                onClick={handleExecuteReindex}
                disabled={isReindexing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#1E293B] hover:bg-[#243347] text-[#F1F5F9] border border-[#334155] hover:border-[#116466] text-xs font-semibold transition-all shrink-0 cursor-pointer shadow-sm disabled:opacity-50"
                title="Re-run AI Vision indexing on selected items"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReindexing ? "animate-spin text-[#D1E8E2]" : "text-[#94A3B8]"}`} />
                <span>{isReindexing ? "Scanning..." : "Reindex"}</span>
              </motion.button>

              {/* Close Dock Button */}
              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-2 rounded-2xl hover:bg-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9] transition-all ml-1 shrink-0 cursor-pointer"
                title="Close dock"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Move Collection Modal */}
      {showBulkMoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-5 bg-[#1E293B] border-[#334155] text-[#F1F5F9]"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <FolderInput className="w-5 h-5 text-[#D1E8E2]" />
                <span>Move {selectedIds.size} Screenshots</span>
              </h3>
              <button onClick={() => setShowBulkMoveModal(false)} className="text-[#94A3B8] hover:text-[#F1F5F9] p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Choose target collection or category for all {selectedIds.size} selected screenshot items:
            </p>

            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
              {TARGET_MOVE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setTargetCategory(cat)}
                  className={`p-3 rounded-2xl border text-xs font-semibold text-left transition-all flex items-center justify-between cursor-pointer ${
                    targetCategory === cat
                      ? "bg-[#116466] text-[#F1F5F9] border-[#116466] shadow-md shadow-[#116466]/30"
                      : "bg-[#2C3531] border-[#334155] text-[#94A3B8] hover:border-[#116466] hover:text-[#F1F5F9]"
                  }`}
                >
                  <span>{cat}</span>
                  {targetCategory === cat && <CheckCircle2 className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowBulkMoveModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#243347] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteBulkMove}
                className="px-5 py-2.5 rounded-xl bg-[#116466] hover:bg-[#157F81] text-[#F1F5F9] text-xs font-bold shadow-lg shadow-[#116466]/20 border border-[#116466] cursor-pointer"
              >
                Confirm Move
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Bulk Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-5 bg-[#1E293B] border-[#334155] text-[#F1F5F9]"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Download className="w-5 h-5 text-[#D1E8E2]" />
                <span>Export {selectedIds.size} Selected Items</span>
              </h3>
              <button onClick={() => setShowExportModal(false)} className="text-[#94A3B8] hover:text-[#F1F5F9] p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Select the export format for your selected screenshots metadata and extracted OCR text:
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleExecuteExport("json")}
                className="w-full p-4 rounded-2xl border text-left flex items-start gap-3 bg-[#2C3531] border-[#334155] hover:border-[#116466] transition-all cursor-pointer"
              >
                <FileCode className="w-6 h-6 text-[#D1E8E2] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-xs text-[#F1F5F9]">JSON Metadata Bundle (.json)</div>
                  <div className="text-[11px] text-[#94A3B8] mt-0.5">
                    Complete raw JSON object containing titles, tags, OCR text, and AI confidence scores.
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleExecuteExport("txt")}
                className="w-full p-4 rounded-2xl border text-left flex items-start gap-3 bg-[#2C3531] border-[#334155] hover:border-[#116466] transition-all cursor-pointer"
              >
                <FileText className="w-6 h-6 text-[#D1E8E2] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-xs text-[#F1F5F9]">Text Digest (.txt)</div>
                  <div className="text-[11px] text-[#94A3B8] mt-0.5">
                    Concatenated plain-text document with clear headings for all OCR text.
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleExecuteExport("md")}
                className="w-full p-4 rounded-2xl border text-left flex items-start gap-3 bg-[#2C3531] border-[#334155] hover:border-[#116466] transition-all cursor-pointer"
              >
                <Sparkles className="w-6 h-6 text-[#D1E8E2] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-xs text-[#F1F5F9]">Markdown Document (.md)</div>
                  <div className="text-[11px] text-[#94A3B8] mt-0.5">
                    Formatted Markdown report with summaries, key facts, and code blocks.
                  </div>
                </div>
              </button>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#243347] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm p-6 rounded-3xl border shadow-2xl space-y-4 bg-[#1E293B] border-[#334155] text-[#F1F5F9]"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-lg">Move {selectedIds.size} Screenshots to Trash?</h3>
              <p className="text-xs text-[#94A3B8] mt-1">
                Selected screenshots will be moved to Trash. You can restore them anytime within 30 days.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#243347] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteBulkDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-500/20 cursor-pointer"
              >
                Move to Trash
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
