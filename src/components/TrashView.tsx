import React, { useState, useMemo, useEffect } from "react";
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Search,
  Calendar,
  Check,
  X,
  Clock,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import { ScreenshotItem } from "../types";
import { PageHeroHeader } from "./PageHeroHeader";

interface TrashViewProps {
  screenshots: ScreenshotItem[];
  isDark?: boolean;
  onRestoreScreenshot: (id: string) => void;
  onBatchRestore: (ids: string[]) => void;
  onRestoreAll?: () => void;
  onPermanentDelete: (id: string) => void;
  onBatchPermanentDelete: (ids: string[]) => void;
  onEmptyTrash: () => void;
  onSelectScreenshot: (item: ScreenshotItem) => void;
}

type ConfirmDeleteTarget =
  | { mode: "single"; item: ScreenshotItem }
  | { mode: "batch"; ids: string[] }
  | { mode: "empty"; count: number }
  | null;

export const TrashView: React.FC<TrashViewProps> = ({
  screenshots,
  isDark = true,
  onRestoreScreenshot,
  onBatchRestore,
  onRestoreAll,
  onPermanentDelete,
  onBatchPermanentDelete,
  onEmptyTrash,
  onSelectScreenshot,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"deleted_newest" | "deleted_oldest">("deleted_newest");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmDeleteTarget>(null);

  const deletedItems = useMemo(() => {
    return screenshots.filter((item) => Boolean(item.isDeleted || item.is_deleted));
  }, [screenshots]);

  // Keep selectedIds synced with remaining deleted items
  useEffect(() => {
    const validIds = new Set(deletedItems.map((i) => i.id));
    setSelectedIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [deletedItems]);

  // Escape closes confirmation modal
  useEffect(() => {
    if (!confirmTarget) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConfirmTarget(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmTarget]);

  const filteredItems = useMemo(() => {
    let result = [...deletedItems];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (item) =>
          (item.title || "").toLowerCase().includes(q) ||
          (item.summary || "").toLowerCase().includes(q) ||
          (item.fullText || item.ocr_text || "").toLowerCase().includes(q) ||
          (item.category || "").toLowerCase().includes(q) ||
          (item.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      const timeA = new Date(a.deletedAt || a.deleted_at || a.dateModified || a.createdAt || 0).getTime();
      const timeB = new Date(b.deletedAt || b.deleted_at || b.dateModified || b.createdAt || 0).getTime();
      return sortBy === "deleted_newest" ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [deletedItems, searchTerm, sortBy]);

  const getDaysRemaining = (deletedAt?: string) => {
    if (!deletedAt) return 30;
    const deletedTime = new Date(deletedAt).getTime();
    if (Number.isNaN(deletedTime)) return 30;
    const elapsedDays = Math.floor((Date.now() - deletedTime) / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - elapsedDays);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map((i) => i.id));
    }
  };

  const handleBatchRestoreAction = () => {
    if (selectedIds.length === 0) return;
    onBatchRestore(selectedIds);
    setSelectedIds([]);
  };

  const handleRestoreAllAction = () => {
    if (deletedItems.length === 0) return;
    if (onRestoreAll) {
      onRestoreAll();
    } else {
      onBatchRestore(deletedItems.map((i) => i.id));
    }
    setSelectedIds([]);
  };

  const executeConfirmedDelete = () => {
    if (!confirmTarget) return;
    if (confirmTarget.mode === "single") {
      onPermanentDelete(confirmTarget.item.id);
      setSelectedIds((prev) => prev.filter((id) => id !== confirmTarget.item.id));
    } else if (confirmTarget.mode === "batch") {
      onBatchPermanentDelete(confirmTarget.ids);
      setSelectedIds([]);
    } else if (confirmTarget.mode === "empty") {
      onEmptyTrash();
      setSelectedIds([]);
    }
    setConfirmTarget(null);
  };

  const isAllSelected = filteredItems.length > 0 && selectedIds.length === filteredItems.length;

  return (
    <div className="space-y-6">
      {/* Page Hero Header */}
      <PageHeroHeader
        type="trash"
        title="Recently Deleted"
        subtitle="Items in Trash are retained for 30 days before automatic removal. Restore anytime or permanently delete from SnapFind AI."
        isDark={isDark}
        actions={
          deletedItems.length > 0 ? (
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <button
                type="button"
                onClick={handleRestoreAllAction}
                className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#080908] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 shrink-0" />
                <span>Restore All ({deletedItems.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmTarget({ mode: "empty", count: deletedItems.length })}
                className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-700 text-rose-100 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>Empty Trash</span>
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Retention & Safety Banner */}
      <div className="p-4 rounded-xl border bg-[#141714] border-[#30362E] flex items-start gap-3">
        <div className="p-2 rounded-lg bg-[#1B1F1A] border border-[#30362E] text-[#B7F36B] shrink-0">
          <Clock className="w-4 h-4" />
        </div>
        <div className="space-y-0.5 text-xs">
          <p className="font-semibold text-[#F7F8F5]">30-Day Recovery Window</p>
          <p className="text-[#A5AAA1] leading-relaxed">
            Deleted screenshots stay here for 30 days before permanent cleanup. Permanent deletion only removes items from SnapFind AI and never deletes original files from your device gallery.
          </p>
        </div>
      </div>

      {/* Controls Bar */}
      {deletedItems.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-2xl border bg-[#141714] border-[#30362E]">
          {/* Search within Trash */}
          <div className="relative flex-1 max-w-md">
            <label htmlFor="trash-search-input" className="sr-only">
              Filter deleted screenshots
            </label>
            <Search
              className="w-4 h-4 text-[#777E74] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="trash-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter deleted screenshots..."
              className="w-full pl-10 pr-9 py-2 rounded-xl text-xs bg-[#0D0F0D] border border-[#30362E] focus:border-[#B7F36B] focus:outline-none text-[#F7F8F5] placeholder-[#777E74]"
            />
            {searchTerm && (
              <button
                type="button"
                aria-label="Clear trash filter"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Select All Checkbox */}
            <button
              type="button"
              onClick={handleSelectAll}
              aria-pressed={isAllSelected}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                isAllSelected
                  ? "bg-[#B7F36B] border-[#B7F36B] text-[#080908]"
                  : "bg-[#1B1F1A] border-[#30362E] text-[#F7F8F5] hover:border-[#B7F36B]"
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                  isAllSelected
                    ? "bg-[#080908] border-[#080908] text-[#B7F36B]"
                    : "border-[#777E74] bg-transparent"
                }`}
              >
                {isAllSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </div>
              <span>{isAllSelected ? "Deselect All" : "Select All"}</span>
            </button>

            {/* Sort Dropdown */}
            <label htmlFor="trash-sort-select" className="sr-only">
              Sort deleted screenshots
            </label>
            <select
              id="trash-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "deleted_newest" | "deleted_oldest")}
              className="px-3 py-2 rounded-xl border bg-[#0D0F0D] border-[#30362E] text-[#F7F8F5] text-xs font-semibold outline-none focus:border-[#B7F36B] cursor-pointer"
            >
              <option value="deleted_newest">Recently Deleted First</option>
              <option value="deleted_oldest">Oldest Deleted First</option>
            </select>
          </div>
        </div>
      )}

      {/* Multi-Select Batch Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-20 z-30 p-3.5 rounded-2xl border bg-[#1B1F1A] border-[#B7F36B] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-lg bg-[#B7F36B] text-[#080908] text-xs font-bold">
              {selectedIds.length} Selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs text-[#A5AAA1] hover:text-[#F7F8F5] underline cursor-pointer"
            >
              Cancel selection
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBatchRestoreAction}
              className="px-3.5 py-2 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#080908] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Selected</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmTarget({ mode: "batch", ids: [...selectedIds] })}
              className="px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-[#F7F8F5] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Permanently</span>
            </button>
          </div>
        </div>
      )}

      {/* Trash Empty State */}
      {deletedItems.length === 0 ? (
        <div className="py-16 px-6 text-center rounded-2xl border bg-[#141714] border-[#30362E]">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#1B1F1A] border border-[#30362E] text-[#B7F36B] flex items-center justify-center mb-4">
            <Trash2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-[#F7F8F5]">Trash is empty</h3>
          <p className="text-sm text-[#A5AAA1] max-w-md mx-auto mt-1.5 leading-relaxed">
            Deleted screenshots will appear here for 30 days so you can restore them anytime or erase them permanently.
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-12 px-6 text-center rounded-2xl border bg-[#141714] border-[#30362E]">
          <p className="text-sm font-semibold text-[#F7F8F5]">No deleted screenshots match &ldquo;{searchTerm}&rdquo;</p>
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="mt-3 px-4 py-2 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-[#B7F36B] text-xs font-semibold cursor-pointer"
          >
            Clear filter
          </button>
        </div>
      ) : (
        /* Grid of Deleted Screenshots */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            const daysRemaining = getDaysRemaining(item.deletedAt || item.deleted_at);
            const deletedDateStr = new Date(
              item.deletedAt || item.deleted_at || item.dateModified || item.createdAt || Date.now()
            ).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

            return (
              <article
                key={item.id}
                className={`group relative rounded-2xl border overflow-hidden flex flex-col justify-between transition-colors ${
                  isSelected
                    ? "border-[#B7F36B] bg-[#1B1F1A]"
                    : "bg-[#141714] border-[#30362E] hover:border-[#777E74]"
                }`}
              >
                <div>
                  {/* Thumbnail with Selection & Retention Badge */}
                  <div
                    className="relative aspect-[16/10] w-full overflow-hidden bg-[#0D0F0D] cursor-pointer"
                    onClick={() => onSelectScreenshot(item)}
                  >
                    <img
                      src={item.thumbnailUri || item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover object-top opacity-80 group-hover:opacity-100 transition-opacity"
                      loading="lazy"
                    />

                    {/* Checkbox Selector */}
                    <button
                      type="button"
                      aria-label={isSelected ? `Deselect ${item.title}` : `Select ${item.title}`}
                      aria-pressed={isSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(item.id);
                      }}
                      className={`absolute top-2.5 left-2.5 z-10 w-6 h-6 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-[#B7F36B] text-[#080908] border border-[#B7F36B]"
                          : "bg-[#080908] border border-[#30362E] text-transparent hover:border-[#B7F36B]"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>

                    {/* Days Remaining Badge */}
                    <div
                      className={`absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold flex items-center gap-1 ${
                        daysRemaining <= 5
                          ? "bg-rose-950 border-rose-700 text-rose-200"
                          : "bg-[#080908] border-[#30362E] text-[#A5AAA1]"
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>{daysRemaining === 0 ? "Expiring today" : `${daysRemaining}d left`}</span>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="p-3.5 space-y-1.5">
                    <h3 className="font-bold text-xs sm:text-sm text-[#F7F8F5] line-clamp-1">{item.title}</h3>
                    <p className="text-xs text-[#A5AAA1] line-clamp-2 leading-relaxed">
                      {item.summary || item.fullText?.slice(0, 80) || "Deleted screenshot"}
                    </p>
                    <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-[#777E74]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Deleted {deletedDateStr}
                      </span>
                      <span className="text-[#A5AAA1] truncate max-w-[90px]">{item.category}</span>
                    </div>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="px-3.5 pb-3.5 pt-2.5 border-t border-[#30362E] flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onRestoreScreenshot(item.id)}
                    aria-label={`Restore ${item.title}`}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#1B1F1A] hover:bg-[#B7F36B] text-[#B7F36B] hover:text-[#080908] border border-[#30362E] hover:border-[#B7F36B] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmTarget({ mode: "single", item })}
                    aria-label={`Permanently delete ${item.title}`}
                    title="Delete permanently"
                    className="p-2 rounded-xl bg-[#1B1F1A] hover:bg-rose-950 text-rose-400 hover:text-rose-200 border border-[#30362E] hover:border-rose-700 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Permanent Delete Confirmation Modal (Single, Batch, or Empty Trash) */}
      {confirmTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080908]/85"
          role="dialog"
          aria-modal="true"
          aria-labelledby="trash-confirm-delete-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmTarget(null);
          }}
        >
          <div className="max-w-md w-full p-6 rounded-2xl border bg-[#141714] border-rose-700 text-[#F7F8F5] space-y-5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-950 border border-rose-800 text-rose-300 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 id="trash-confirm-delete-title" className="text-lg font-bold text-[#F7F8F5]">
                  {confirmTarget.mode === "single"
                    ? "Delete screenshot permanently?"
                    : confirmTarget.mode === "batch"
                    ? `Delete ${confirmTarget.ids.length} screenshots permanently?`
                    : `Empty Trash (${confirmTarget.count} items)?`}
                </h3>
                <p className="text-xs text-[#A5AAA1] mt-1">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0D0F0D] border border-[#30362E] text-xs text-[#A5AAA1] leading-relaxed space-y-1.5">
              {confirmTarget.mode === "single" ? (
                <p>
                  <span className="font-semibold text-[#F7F8F5]">&ldquo;{confirmTarget.item.title}&rdquo;</span> will be permanently removed from SnapFind AI search indexes and cloud sync.
                </p>
              ) : confirmTarget.mode === "batch" ? (
                <p>
                  All <span className="font-semibold text-[#F7F8F5]">{confirmTarget.ids.length} selected screenshots</span> will be permanently removed from SnapFind AI search indexes and cloud sync.
                </p>
              ) : (
                <p>
                  All <span className="font-semibold text-[#F7F8F5]">{confirmTarget.count} screenshots</span> in Trash will be permanently erased from SnapFind AI.
                </p>
              )}
              <p className="text-[11px] text-[#777E74]">
                Original image files stored in your device gallery will not be touched.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="px-4 py-2.5 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-[#F7F8F5] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeConfirmedDelete}
                className="px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-[#F7F8F5] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>
                  {confirmTarget.mode === "empty" ? "Empty Trash Permanently" : "Delete Permanently"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
