import React, { useState, useMemo } from "react";
import {
  Trash2,
  RotateCcw,
  Search,
  X,
  Clock,
  CheckCircle2,
  Trash,
  ShieldAlert,
  ArrowUpDown,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ScreenshotItem } from "../types";
import { PageHeroHeader } from "./PageHeroHeader";

interface TrashViewProps {
  screenshots: ScreenshotItem[];
  isDark: boolean;
  onRestoreScreenshot: (id: string) => void;
  onBatchRestore: (ids: string[]) => void;
  onPermanentDelete: (id: string) => void;
  onBatchPermanentDelete: (ids: string[]) => void;
  onEmptyTrash: () => void;
  onSelectScreenshot: (item: ScreenshotItem) => void;
}

export const TrashView: React.FC<TrashViewProps> = ({
  screenshots,
  isDark,
  onRestoreScreenshot,
  onBatchRestore,
  onPermanentDelete,
  onBatchPermanentDelete,
  onEmptyTrash,
  onSelectScreenshot,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showEmptyConfirmModal, setShowEmptyConfirmModal] = useState(false);
  const [sortBy, setSortBy] = useState<"daysLeft" | "newest" | "title">("daysLeft");

  // Calculate days remaining helper
  const getDaysRemaining = (deletedAt?: string) => {
    if (!deletedAt) return 30;
    const deletedDate = new Date(deletedAt).getTime();
    if (isNaN(deletedDate)) return 30;
    const now = Date.now();
    const elapsedMs = now - deletedDate;
    const daysElapsed = elapsedMs / (1000 * 60 * 60 * 24);
    const daysLeft = Math.max(0, Math.ceil(30 - daysElapsed));
    return daysLeft;
  };

  // Filter master list to deleted items only
  const trashItems = useMemo(() => {
    return screenshots.filter((item) => Boolean(item.isDeleted || item.is_deleted));
  }, [screenshots]);

  // Filter & search inside recently deleted
  const filteredTrash = useMemo(() => {
    let list = [...trashItems];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => {
        const titleMatch = item.title?.toLowerCase().includes(q);
        const textMatch = item.fullText?.toLowerCase().includes(q) || item.ocr_text?.toLowerCase().includes(q);
        const summaryMatch = item.summary?.toLowerCase().includes(q);
        const catMatch = item.category?.toLowerCase().includes(q);
        return titleMatch || textMatch || summaryMatch || catMatch;
      });
    }

    list.sort((a, b) => {
      if (sortBy === "daysLeft") {
        return getDaysRemaining(a.deletedAt) - getDaysRemaining(b.deletedAt);
      }
      if (sortBy === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "title") {
        return (a.title || "").localeCompare(b.title || "");
      }
      return 0;
    });

    return list;
  }, [trashItems, searchQuery, sortBy]);

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredTrash.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTrash.map((f) => f.id));
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Banner */}
      <PageHeroHeader
        type="trash"
        title="Recently Deleted"
        isDark={isDark}
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#1B1F1A] text-[#A5AAA1] border border-[#30362E]">
              {trashItems.length} {trashItems.length === 1 ? "Item" : "Items"}
            </span>

            {trashItems.length > 0 && (
              <button
                type="button"
                onClick={() => setShowEmptyConfirmModal(true)}
                className="px-4 py-2 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-[#F7F8F5] font-bold text-xs flex items-center gap-2 transition-colors shadow-[2px_2px_8px_rgba(0,0,0,0.4)] cursor-pointer shrink-0"
              >
                <Trash className="w-4 h-4 shrink-0" />
                <span className="truncate whitespace-nowrap">Empty Recently Deleted</span>
              </button>
            )}
          </div>
        }
      />

      {/* Controls & Search */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#777E74]" />
            <input
              type="text"
              placeholder="Search recently deleted screenshots..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-10 py-3 rounded-2xl text-xs sm:text-sm font-medium border border-[#30362E] bg-[#0D0F0D] text-[#F7F8F5] placeholder-[#777E74] focus:outline-none focus:border-[#B7F36B] shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="px-3 py-2.5 min-h-[44px] rounded-2xl text-xs font-semibold border border-[#30362E] bg-[#141714] text-[#F7F8F5] hover:border-[#B7F36B] appearance-none pr-8 cursor-pointer focus:outline-none"
              >
                <option value="daysLeft">Expiring Soonest</option>
                <option value="newest">Newest First</option>
                <option value="title">Title A-Z</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-[#A5AAA1] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                if (isSelectionMode) setSelectedIds([]);
              }}
              className={`px-3.5 py-2.5 min-h-[44px] rounded-2xl border text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                isSelectionMode
                  ? "bg-[#B7F36B] text-[#10130D] border-[#B7F36B]"
                  : "bg-[#141714] border-[#30362E] text-[#A5AAA1] hover:text-[#F7F8F5] hover:bg-[#1B1F1A]"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSelectionMode ? "Cancel" : "Select"}</span>
            </button>
          </div>
        </div>

        {/* Batch Action Bar */}
        <AnimatePresence>
          {isSelectionMode && selectedIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3.5 rounded-2xl bg-[#141714] border border-[#30362E] text-[#F7F8F5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[6px_6px_16px_rgba(0,0,0,0.65)]"
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-3 py-1.5 min-h-[36px] rounded-xl bg-[#1B1F1A] hover:bg-[#222720] text-xs font-semibold text-[#F7F8F5] border border-[#30362E] transition-colors cursor-pointer"
                >
                  {selectedIds.length === filteredTrash.length ? "Deselect All" : "Select All"}
                </button>
                <span className="text-xs font-bold text-[#B7F36B]">
                  {selectedIds.length} selected
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    onBatchRestore(selectedIds);
                    setSelectedIds([]);
                  }}
                  className="px-3.5 py-2 min-h-[40px] rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Selected</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onBatchPermanentDelete(selectedIds);
                    setSelectedIds([]);
                  }}
                  className="px-3.5 py-2 min-h-[40px] rounded-xl bg-rose-600 hover:bg-rose-500 text-[#F7F8F5] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Permanently</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Items Grid (1, 2, or 4 columns) */}
      {filteredTrash.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {filteredTrash.map((item) => {
              const daysLeft = getDaysRemaining(item.deletedAt || (item as any).deleted_at);
              const isSelected = selectedIds.includes(item.id);

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.2 }}
                  className={`group relative rounded-2xl border overflow-hidden flex flex-col transition-all duration-200 ${
                    isSelected
                      ? "ring-2 ring-[#B7F36B] border-[#B7F36B] bg-[#1B1F1A]"
                      : "bg-[#141714] border-[#30362E] hover:border-[#B7F36B]/60 shadow-[4px_4px_12px_rgba(0,0,0,0.55)]"
                  }`}
                >
                  {/* Countdown Badge overlay */}
                  <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 ${
                        daysLeft <= 3
                          ? "bg-rose-950 text-rose-200 border-rose-500/60"
                          : "bg-[#0D0F0D] text-[#A5AAA1] border-[#30362E]"
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>{daysLeft === 0 ? "Expires Today" : `${daysLeft} Days Left`}</span>
                    </span>
                  </div>

                  {/* Selection Checkbox overlay */}
                  {isSelectionMode && (
                    <button
                      type="button"
                      onClick={() => toggleSelectId(item.id)}
                      className="absolute top-3 right-3 z-20 p-1.5 rounded-lg bg-[#0D0F0D] border border-[#30362E] text-[#F7F8F5] cursor-pointer"
                    >
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isSelected ? "bg-[#B7F36B] border-[#B7F36B]" : "border-[#777E74] bg-[#141714]"
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#10130D]" />}
                      </div>
                    </button>
                  )}

                  {/* Image Thumbnail Container */}
                  <div
                    onClick={() => onSelectScreenshot(item)}
                    className="relative aspect-video w-full bg-[#0D0F0D] overflow-hidden cursor-pointer border-b border-[#30362E]"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-85 group-hover:opacity-100"
                    />
                  </div>

                  {/* Info & Action Footer */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#0D0F0D] text-[#A5AAA1] border border-[#30362E]">
                          {item.category || "General"}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-[#F7F8F5] truncate mt-1.5">
                        {item.title}
                      </h3>
                      <p className="text-xs text-[#A5AAA1] line-clamp-2 mt-1">
                        {item.summary || item.fullText || "No content summary"}
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="pt-2 border-t border-[#30362E] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onRestoreScreenshot(item.id)}
                        className="flex-1 py-2 px-3 min-h-[40px] rounded-xl bg-[#1B1F1A] hover:bg-[#B7F36B] text-[#B7F36B] hover:text-[#10130D] border border-[#30362E] hover:border-[#B7F36B] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onPermanentDelete(item.id)}
                        className="py-2 px-3 min-h-[40px] rounded-xl bg-[#1B1F1A] hover:bg-rose-600 text-[#A5AAA1] hover:text-[#F7F8F5] border border-[#30362E] hover:border-rose-500 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        title="Delete Permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="p-12 sm:p-16 text-center rounded-2xl border border-[#30362E] bg-[#141714] flex flex-col items-center justify-center space-y-4 shadow-[4px_4px_14px_rgba(0,0,0,0.55)]">
          <div className="p-4 rounded-2xl bg-[#1B1F1A] border border-[#30362E] text-[#A5AAA1]">
            <Trash2 className="w-10 h-10" />
          </div>

          <div className="max-w-md space-y-2">
            <h3 className="text-xl font-bold tracking-tight text-[#F7F8F5]">
              {trashItems.length === 0 ? "Recently Deleted is Empty" : "No Matching Items Found"}
            </h3>
            <p className="text-xs sm:text-sm text-[#A5AAA1] leading-relaxed">
              {trashItems.length === 0
                ? "When you delete screenshots, they move here and remain available for 30 days before being permanently removed."
                : `No deleted items match "${searchQuery}".`}
            </p>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Empty Recently Deleted */}
      <AnimatePresence>
        {showEmptyConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-md w-full bg-[#141714] border border-[#30362E] rounded-2xl p-6 shadow-[8px_8px_24px_rgba(0,0,0,0.85)] text-[#F7F8F5] space-y-5"
            >
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-3 rounded-xl bg-[#1B1F1A] border border-rose-500/40">
                  <ShieldAlert className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#F7F8F5]">Empty Recently Deleted?</h3>
                  <p className="text-xs text-[#A5AAA1]">This action cannot be undone.</p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-[#A5AAA1] leading-relaxed">
                You are about to permanently delete all <strong className="text-[#F7F8F5]">{trashItems.length}</strong> item(s) in Recently Deleted. They will be immediately erased from local storage and cloud storage.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmptyConfirmModal(false)}
                  className="px-4 py-2 min-h-[44px] rounded-xl bg-[#1B1F1A] hover:bg-[#222720] text-[#A5AAA1] hover:text-[#F7F8F5] border border-[#30362E] font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onEmptyTrash();
                    setShowEmptyConfirmModal(false);
                  }}
                  className="px-5 py-2 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-[#F7F8F5] font-bold text-xs transition-colors cursor-pointer"
                >
                  Delete All Permanently
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
