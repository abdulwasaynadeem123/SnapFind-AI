import React, { useState, useEffect } from "react";
import {
  Copy,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
  HardDrive,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ScreenshotItem } from "../types";
import {
  findDuplicateGroups,
  cleanupDuplicateGroup,
  cleanupAllDuplicates,
  DuplicateGroup,
  backfillContentHashes,
} from "../services/duplicateCleanup";

interface DuplicateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  screenshots: ScreenshotItem[];
  onUpdateScreenshots: (updated: ScreenshotItem[]) => void;
  isDark: boolean;
  userId?: string;
  addToast: (msg: { title: string; description?: string; type: "success" | "error" | "info" }) => void;
}

export const DuplicateManagerModal: React.FC<DuplicateManagerModalProps> = ({
  isOpen,
  onClose,
  screenshots,
  onUpdateScreenshots,
  isDark,
  userId,
  addToast,
}) => {
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [isCleaning, setIsCleaning] = useState(false);
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number | null>(null);

  // Refresh duplicate groups whenever modal opens or screenshots change
  useEffect(() => {
    if (isOpen) {
      const groups = findDuplicateGroups(screenshots, userId);
      setDuplicateGroups(groups);
    }
  }, [isOpen, screenshots, userId]);

  if (!isOpen) return null;

  const totalDuplicatesCount = duplicateGroups.reduce(
    (acc, g) => acc + g.duplicateItems.length,
    0
  );

  const estimatedReclaimKB = duplicateGroups.reduce((acc, g) => {
    const groupKb = g.duplicateItems.reduce((s, d) => s + (d.fileSizeKB || 500), 0);
    return acc + groupKb;
  }, 0);

  const estimatedReclaimMB = (estimatedReclaimKB / 1024).toFixed(1);

  const handleCleanSingleGroup = async (group: DuplicateGroup) => {
    setIsCleaning(true);
    try {
      const res = await cleanupDuplicateGroup(group, screenshots, "trash");
      onUpdateScreenshots(res.updatedScreenshots);
      addToast({
        title: "Duplicates Moved to Trash",
        description: `Kept "${group.canonicalItem.title}". ${res.removedIds.length} duplicate copy moved to Trash.`,
        type: "success",
      });
      // Refresh groups
      setDuplicateGroups(findDuplicateGroups(res.updatedScreenshots, userId));
    } catch (e) {
      console.error("Clean group error:", e);
      addToast({
        title: "Cleanup Failed",
        description: "An error occurred while cleaning duplicate screenshots.",
        type: "error",
      });
    } finally {
      setIsCleaning(false);
    }
  };

  const handleCleanAllDuplicates = async () => {
    setIsCleaning(true);
    setConfirmAllOpen(false);
    try {
      const res = await cleanupAllDuplicates(screenshots, "trash", userId);
      onUpdateScreenshots(res.updatedScreenshots);
      addToast({
        title: "All Duplicates Cleaned",
        description: `Successfully cleaned ${res.removedCount} duplicate copies across ${res.keptCount} groups.`,
        type: "success",
      });
      setDuplicateGroups([]);
    } catch (e) {
      console.error("Clean all error:", e);
      addToast({
        title: "Batch Cleanup Failed",
        description: "An error occurred during duplicate cleanup.",
        type: "error",
      });
    } finally {
      setIsCleaning(false);
    }
  };

  const handleBackfillHashes = async () => {
    setIsCleaning(true);
    try {
      const res = await backfillContentHashes(screenshots);
      if (res.backfilledCount > 0) {
        onUpdateScreenshots(res.updatedScreenshots);
        addToast({
          title: "Hashes Computed",
          description: `Fingerprinted ${res.backfilledCount} screenshot${res.backfilledCount > 1 ? "s" : ""} with SHA-256 content hashes.`,
          type: "success",
        });
        setDuplicateGroups(findDuplicateGroups(res.updatedScreenshots, userId));
      } else {
        addToast({
          title: "All Screenshots Indexed",
          description: "All existing screenshots already have content hashes.",
          type: "info",
        });
      }
    } catch (e) {
      console.error("Backfill error:", e);
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border border-[#30362E] bg-[#141714] text-[#F7F8F5] shadow-[8px_8px_24px_rgba(0,0,0,0.85)] overflow-hidden transition-all"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#30362E]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1B1F1A] border border-[#30362E] flex items-center justify-center text-[#B7F36B] shadow-[inset_1px_1px_3px_rgba(0,0,0,0.4)]">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-2 text-[#F7F8F5]">
                Duplicate Screenshots
                {duplicateGroups.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1B1F1A] border border-[#30362E] text-[#B7F36B]">
                    {totalDuplicatesCount} redundant
                  </span>
                )}
              </h2>
              <p className="text-xs text-[#A5AAA1]">
                Identified by exact SHA-256 binary content hash per user. Canonical master copies are preserved.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBackfillHashes}
              disabled={isCleaning}
              className="px-3 py-1.5 rounded-xl border border-[#30362E] bg-[#1B1F1A] hover:bg-[#222720] text-xs font-bold text-[#F7F8F5] flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 shadow-[2px_2px_8px_rgba(0,0,0,0.3)]"
              title="Compute SHA-256 for older screenshots"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCleaning ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Scan Hashes</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-[#30362E] bg-[#1B1F1A] hover:bg-[#222720] text-[#A5AAA1] hover:text-[#F7F8F5] transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        {duplicateGroups.length > 0 && (
          <div className="px-6 py-3 bg-[#0D0F0D] border-b border-[#30362E] flex items-center justify-between flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-6 text-[#A5AAA1]">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#B7F36B]" />
                <strong className="text-[#F7F8F5]">{duplicateGroups.length}</strong> Duplicate Groups
              </span>
              <span className="flex items-center gap-1.5">
                <Copy className="w-4 h-4 text-[#B7F36B]" />
                <strong className="text-[#F7F8F5]">{totalDuplicatesCount}</strong> Extra Copies
              </span>
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-[#B7F36B]" />
                Reclaim <strong className="text-[#F7F8F5]">~{estimatedReclaimMB} MB</strong>
              </span>
            </div>

            <button
              onClick={() => setConfirmAllOpen(true)}
              disabled={isCleaning}
              className="px-4 py-2 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] font-bold text-xs shadow-[2px_2px_8px_rgba(0,0,0,0.4)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clean All ({totalDuplicatesCount}) Duplicates
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {duplicateGroups.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-[#1B1F1A] border border-[#30362E] flex items-center justify-center text-[#B7F36B] mx-auto shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4)]">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-bold text-[#F7F8F5]">No Duplicate Screenshots</h3>
                <p className="text-xs text-[#A5AAA1] leading-relaxed">
                  Every screenshot in your SnapFind library is unique. Absolute SHA-256 duplicate prevention automatically blocks redundant imports.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-[#30362E] bg-[#1B1F1A] hover:bg-[#222720] text-xs font-bold text-[#F7F8F5] transition-all cursor-pointer shadow-[2px_2px_8px_rgba(0,0,0,0.3)]"
              >
                Back to Library
              </button>
            </div>
          ) : (
            duplicateGroups.map((group, gIdx) => (
              <div
                key={group.contentHash + gIdx}
                className="p-5 rounded-2xl bg-[#0D0F0D] border border-[#30362E] space-y-4 hover:border-[#B7F36B]/40 transition-all shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]"
              >
                {/* Group Header */}
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-[#141714] border border-[#30362E] font-mono text-[11px] text-[#B7F36B]">
                      SHA-256: {group.contentHash.substring(0, 16)}...
                    </span>
                    <span className="text-[#A5AAA1]">
                      {group.totalCount} total copies ({group.duplicateItems.length} duplicate)
                    </span>
                  </div>

                  <button
                    onClick={() => handleCleanSingleGroup(group)}
                    disabled={isCleaning}
                    className="px-3 py-1.5 rounded-xl border border-[#30362E] bg-[#141714] hover:bg-[#1B1F1A] text-[#F7F8F5] font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-[2px_2px_8px_rgba(0,0,0,0.3)]"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#B7F36B]" />
                    Keep Original & Trash Duplicate ({group.duplicateItems.length})
                  </button>
                </div>

                {/* Items Comparison Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Canonical Master Item */}
                  <div className="p-3.5 rounded-xl bg-[#141714] border border-[#B7F36B]/30 space-y-2.5 relative shadow-[2px_2px_8px_rgba(0,0,0,0.4)]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="px-2 py-0.5 rounded-md bg-[#1B1F1A] border border-[#30362E] text-[#B7F36B] font-bold text-[10px] tracking-wide uppercase flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-[#B7F36B]" /> Original (Kept)
                      </span>
                      <span className="text-[11px] text-[#777E74] flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(group.canonicalItem.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-16 h-12 rounded-lg bg-[#080908] border border-[#30362E] overflow-hidden flex-shrink-0">
                        <img
                          src={group.canonicalItem.thumbnailUri || group.canonicalItem.imageUrl}
                          alt={group.canonicalItem.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs text-[#F7F8F5] truncate">
                          {group.canonicalItem.title}
                        </h4>
                        <p className="text-[11px] text-[#A5AAA1] truncate">
                          {group.canonicalItem.fileName || "screenshot.png"}
                        </p>
                        <div className="text-[10px] text-[#B7F36B] font-medium mt-0.5">
                          ✓ Completed AI Vision & OCR Indexing
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Duplicate Copies */}
                  <div className="space-y-2">
                    {group.duplicateItems.map((dup, dIdx) => (
                      <div
                        key={dup.id + dIdx}
                        className="p-3.5 rounded-xl bg-[#141714] border border-[#30362E] space-y-2 relative"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="px-2 py-0.5 rounded-md bg-[#1B1F1A] border border-[#30362E] text-[#A5AAA1] font-bold text-[10px] tracking-wide uppercase flex items-center gap-1">
                            <Copy className="w-3 h-3 text-[#A5AAA1]" /> Duplicate Copy #{dIdx + 1}
                          </span>
                          <span className="text-[11px] text-[#777E74]">
                            {new Date(dup.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-16 h-12 rounded-lg bg-[#080908] border border-[#30362E] overflow-hidden flex-shrink-0 opacity-70">
                            <img
                              src={dup.thumbnailUri || dup.imageUrl}
                              alt={dup.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-xs text-[#A5AAA1] truncate">
                              {dup.title}
                            </h4>
                            <p className="text-[11px] text-[#777E74] truncate">
                              {dup.fileName || "copy.png"}
                            </p>
                            <div className="text-[10px] text-[#777E74] font-medium mt-0.5">
                              Identical binary content hash
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Confirmation Modal */}
        <AnimatePresence>
          {confirmAllOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-50 bg-[#141714]/95 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center space-y-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#1B1F1A] border border-[#30362E] text-[#B7F36B] flex items-center justify-center shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4)]">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="text-lg font-bold text-[#F7F8F5]">Clean All Duplicate Screenshots?</h3>
                <p className="text-xs text-[#A5AAA1] leading-relaxed">
                  SnapFind will keep the primary canonical master copy for every group and safely move{" "}
                  <strong className="text-[#F7F8F5]">{totalDuplicatesCount} redundant copies</strong> to your Trash.
                  You can restore any item from Trash later if needed.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setConfirmAllOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#30362E] bg-[#1B1F1A] hover:bg-[#222720] text-xs font-bold text-[#A5AAA1] cursor-pointer shadow-[2px_2px_8px_rgba(0,0,0,0.3)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCleanAllDuplicates}
                  disabled={isCleaning}
                  className="px-5 py-2.5 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] text-xs font-bold shadow-[2px_2px_8px_rgba(0,0,0,0.4)] cursor-pointer flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4 text-[#10130D]" />
                  Yes, Clean {totalDuplicatesCount} Copies
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
