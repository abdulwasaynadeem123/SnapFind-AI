import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Folder,
  FolderPlus,
  Layers,
  Edit2,
  Trash2,
  Merge,
  ArrowRight,
  ArrowLeft,
  MoreVertical,
  Check,
  X,
  Plus,
  Move,
  Grid as GridIcon,
  Search,
  CheckSquare,
  Square,
  Plane,
  Receipt,
  Utensils,
  GraduationCap,
  ShoppingBag,
  MessageSquare,
  Code,
  DollarSign,
  Lightbulb,
  Zap,
  BookOpen,
  FileText,
  Shield,
  CreditCard,
  Lock,
  Unlock,
  KeyRound,
} from "lucide-react";
import { CollectionItem, ScreenshotItem, CategoryType } from "../types";
import { ScreenshotCard } from "./ScreenshotCard";
import { useEntitlement } from "../hooks/useEntitlement";
import { UpgradeModal, ProBadge } from "./subscription/UpgradePrompt";
import { PageHeroHeader } from "./PageHeroHeader";
import { collectionSecurity, VAULT_COLLECTION_NAME } from "../services/collectionSecurity";
import { SecurityLockModal } from "./SecurityLockModal";

interface CollectionsViewProps {
  collections: CollectionItem[];
  screenshots: ScreenshotItem[];
  isDark: boolean;
  onSelectScreenshot: (item: ScreenshotItem) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteScreenshot: (id: string) => void;
  onCreateCollection: (name: string, description?: string) => void;
  onRenameCollection: (oldName: string, newName: string) => void;
  onDeleteCollection: (collectionName: string, deleteScreenshots: boolean) => void;
  onMergeCollections: (sourceNames: string[], targetName: string) => void;
  onMoveScreenshots: (ids: string[], targetCollectionName: string) => void;
  addToast: (msg: { title: string; description?: string; type: "success" | "error" | "info" }) => void;
}

/**
 * Get category theme and placeholder styling when collection is empty
 */
const getCategoryTheme = (name: string, description?: string) => {
  const text = `${name} ${description || ""}`.toLowerCase();

  let icon = Folder;
  let label = "Vault Collection";

  if (text.includes("flight") || text.includes("travel") || text.includes("passport") || text.includes("visa")) {
    icon = Plane;
    label = "Travel & Identity";
  } else if (text.includes("bill") || text.includes("electric") || text.includes("power") || text.includes("utility")) {
    icon = Zap;
    label = "Utility Bills";
  } else if (text.includes("education") || text.includes("pass") || text.includes("cert") || text.includes("school") || text.includes("degree")) {
    icon = GraduationCap;
    label = "Education & Passes";
  } else if (text.includes("food") || text.includes("recipe") || text.includes("cook") || text.includes("meal") || text.includes("restaurant")) {
    icon = Utensils;
    label = "Food & Recipes";
  } else if (text.includes("receipt") || text.includes("invoice") || text.includes("shop") || text.includes("order") || text.includes("purchase")) {
    icon = Receipt;
    label = "Receipts & Shopping";
  } else if (text.includes("code") || text.includes("dev") || text.includes("program") || text.includes("terminal") || text.includes("git")) {
    icon = Code;
    label = "Development & Code";
  } else if (text.includes("chat") || text.includes("message") || text.includes("convo") || text.includes("whatsapp") || text.includes("slack")) {
    icon = MessageSquare;
    label = "Chats & Messages";
  } else if (text.includes("finance") || text.includes("bank") || text.includes("statement") || text.includes("crypto") || text.includes("money")) {
    icon = DollarSign;
    label = "Financial Statements";
  } else if (text.includes("idea") || text.includes("note") || text.includes("draft") || text.includes("memo")) {
    icon = Lightbulb;
    label = "Ideas & Notes";
  }

  return {
    icon,
    gradient: "from-[#141714] to-[#0D0F0D]",
    accent: "text-[#B7F36B]",
    badgeBg: "bg-[#1B1F1A] text-[#F7F8F5] border-[#30362E]",
    label,
    patternIcon: icon,
  };
};

export const CollectionsView: React.FC<CollectionsViewProps> = ({
  collections,
  screenshots,
  isDark,
  onSelectScreenshot,
  onToggleFavorite,
  onDeleteScreenshot,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
  onMergeCollections,
  onMoveScreenshots,
  addToast,
}) => {
  const [selectedCollectionName, setSelectedCollectionName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    isPro,
    isFounder,
    promptUpgrade,
    isUpgradeModalOpen,
    closeUpgradeModal,
    activePromptContext,
  } = useEntitlement();

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColDesc, setNewColDesc] = useState("");

  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteWithPhotos, setDeleteWithPhotos] = useState(false);

  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [selectedMergeSources, setSelectedMergeSources] = useState<string[]>([]);
  const [targetMergeName, setTargetMergeName] = useState("");

  // Batch Selection inside Album detail view
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [targetMoveCollection, setTargetMoveCollection] = useState("");

  // Menu popover per card
  const [activeMenuCollection, setActiveMenuCollection] = useState<string | null>(null);

  // Security Lock Modal State
  const [securityModal, setSecurityModal] = useState<{
    isOpen: boolean;
    collectionName: string;
    mode: "unlock" | "configure" | "change" | "remove" | "settings";
    pendingTargetCollection?: string;
  }>({
    isOpen: false,
    collectionName: "",
    mode: "unlock",
  });

  const handleCollectionClick = (col: CollectionItem) => {
    if (collectionSecurity.isCollectionLocked(col.name)) {
      setSecurityModal({
        isOpen: true,
        collectionName: col.name,
        mode: "unlock",
        pendingTargetCollection: col.name,
      });
      return;
    }
    setSelectedCollectionName(col.name);
  };

  // Filter collections
  const filteredCollections = collections.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Active detail collection items
  const activeCollectionObj = collections.find((c) => c.name === selectedCollectionName);
  const activeScreenshots = screenshots.filter((s) => {
    const colName = s.collectionName || s.collection || "General Vault";
    return colName === selectedCollectionName;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    onCreateCollection(newColName.trim(), newColDesc.trim());
    addToast({
      title: "Collection Created",
      description: `Created new album "${newColName}".`,
      type: "success",
    });
    setNewColName("");
    setNewColDesc("");
    setIsCreateOpen(false);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameValue.trim()) return;
    onRenameCollection(renameTarget, renameValue.trim());
    if (selectedCollectionName === renameTarget) {
      setSelectedCollectionName(renameValue.trim());
    }
    addToast({
      title: "Collection Renamed",
      description: `Renamed "${renameTarget}" to "${renameValue.trim()}".`,
      type: "success",
    });
    setRenameTarget(null);
    setRenameValue("");
  };

  const handleDeleteSubmit = () => {
    if (!deleteTarget) return;
    onDeleteCollection(deleteTarget, deleteWithPhotos);
    if (selectedCollectionName === deleteTarget) {
      setSelectedCollectionName(null);
    }
    addToast({
      title: "Collection Deleted",
      description: `Removed collection "${deleteTarget}".`,
      type: "info",
    });
    setDeleteTarget(null);
  };

  const handleMergeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMergeSources.length < 1 || !targetMergeName.trim()) return;

    onMergeCollections(selectedMergeSources, targetMergeName.trim());
    addToast({
      title: "Collections Merged",
      description: `Merged ${selectedMergeSources.length} collection(s) into "${targetMergeName.trim()}".`,
      type: "success",
    });
    setMergeModalOpen(false);
    setSelectedMergeSources([]);
    setTargetMergeName("");
  };

  const handleBatchMoveSubmit = () => {
    if (selectedPhotoIds.length === 0 || !targetMoveCollection) return;
    onMoveScreenshots(selectedPhotoIds, targetMoveCollection);
    addToast({
      title: "Photos Moved",
      description: `Moved ${selectedPhotoIds.length} photo(s) to "${targetMoveCollection}".`,
      type: "success",
    });
    setSelectedPhotoIds([]);
    setIsMoveModalOpen(false);
  };

  const toggleSelectPhoto = (id: string) => {
    setSelectedPhotoIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  // Helper to get up to 3 thumbnails for Apple Photos stacked look with contextual ranking
  const getRepresentativeStackThumbnails = (collectionName: string): string[] => {
    const items = screenshots.filter((s) => {
      if (s.isDeleted || s.is_deleted) return false;
      const col = s.collectionName || s.collection || "General Vault";
      return col === collectionName;
    });

    if (items.length === 0) return [];

    // Score screenshots within the collection for best representative visual quality
    const scored = items.map((item) => {
      let score = 0;
      const uri = item.thumbnailUri || item.thumbnail_uri || item.imageUrl || item.image_uri || "";
      if (uri && uri.length > 20) score += 30;
      if (item.processingStatus === "Completed") score += 20;
      if (item.ocr_text || item.fullText) score += 15;
      if (item.tags && item.tags.length > 0) score += 10;
      if (item.category && item.category !== "Other") score += 10;
      if (item.isFavorite || item.favorite) score += 10;
      const dateMs = new Date(item.createdAt || item.date_created || item.indexedAt || 0).getTime();
      if (!isNaN(dateMs)) {
        score += Math.min(10, Math.floor(dateMs / (1000 * 60 * 60 * 24 * 30)));
      }
      return { uri, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3).map((s) => s.uri).filter(Boolean);
  };

  return (
    <div className="space-y-6">
      {/* Detail Album View */}
      {selectedCollectionName ? (
        <motion.div
          key="album-detail"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {/* Top Detail Header Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#334155]">
            <button
              onClick={() => {
                setSelectedCollectionName(null);
                setSelectedPhotoIds([]);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer bg-[#1E293B] hover:bg-[#243347] text-[#F1F5F9] border border-[#334155] hover:border-[#116466]"
            >
              <ArrowLeft className="w-4 h-4 text-[#D1E8E2]" />
              <span>Back to Collections</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {/* Security Lock Controls */}
              {selectedCollectionName && collectionSecurity.hasCollectionLock(selectedCollectionName) ? (
                <>
                  <button
                    onClick={() => {
                      setSecurityModal({
                        isOpen: true,
                        collectionName: selectedCollectionName,
                        mode: "settings",
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#116466]/20 hover:bg-[#116466]/30 text-[#D1E8E2] border border-[#116466]/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="Manage security, change lock method, or remove lock"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Security Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      collectionSecurity.lockCollection(selectedCollectionName);
                      setSelectedCollectionName(null);
                      addToast({
                        title: "Collection Locked",
                        description: `Locked "${selectedCollectionName}".`,
                        type: "info",
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#D9B08C]/10 hover:bg-[#D9B08C]/20 text-[#D9B08C] border border-[#D9B08C]/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    title="Lock this album now"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Lock Album</span>
                  </button>
                </>
              ) : (
                selectedCollectionName && (
                  <button
                    onClick={() => {
                      setSecurityModal({
                        isOpen: true,
                        collectionName: selectedCollectionName,
                        mode: "configure",
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#116466]/20 hover:bg-[#116466]/30 text-[#D1E8E2] border border-[#116466]/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    title="Protect album with Pattern, PIN, or Password"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Set Lock</span>
                  </button>
                )
              )}

              <button
                onClick={() => {
                  setRenameTarget(selectedCollectionName);
                  setRenameValue(selectedCollectionName);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#1E293B] hover:bg-[#243347] text-[#F1F5F9] border border-[#334155] hover:border-[#116466] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#D1E8E2]" />
                <span>Rename Album</span>
              </button>

              <button
                onClick={() => {
                  setSelectedMergeSources([selectedCollectionName]);
                  setTargetMergeName(selectedCollectionName);
                  setMergeModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#1E293B] hover:bg-[#243347] text-[#F1F5F9] border border-[#334155] hover:border-[#116466] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Merge className="w-3.5 h-3.5 text-[#D1E8E2]" />
                <span>Merge Album</span>
              </button>

              <button
                onClick={() => setDeleteTarget(selectedCollectionName)}
                className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Album</span>
              </button>
            </div>
          </div>

          {/* Album Hero Card */}
          <div
            className="p-6 sm:p-8 rounded-2xl border relative overflow-hidden shadow-[4px_4px_16px_rgba(0,0,0,0.6)] bg-[#141714] border-[#30362E] text-[#F7F8F5]"
          >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E] inline-flex items-center gap-1">
                    <Layers className="w-3 h-3 text-[#B7F36B]" />
                    {activeCollectionObj?.isAiGenerated ? "Smart Collection" : "Custom Collection"}
                  </span>
                  <span className="text-xs text-[#A5AAA1] font-medium">
                    {activeScreenshots.length} Screenshots
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F7F8F5] tracking-tight">
                  {selectedCollectionName}
                </h1>

                {activeCollectionObj?.description && (
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    {activeCollectionObj.description}
                  </p>
                )}
              </div>

              {/* Batch Action Toolbar when items selected */}
              {selectedPhotoIds.length > 0 && (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-[#141714] border border-[#B7F36B] shadow-[6px_6px_16px_rgba(0,0,0,0.65)]"
                >
                  <span className="text-xs font-bold text-[#B7F36B] pl-1">
                    {selectedPhotoIds.length} Selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsMoveModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Move className="w-3.5 h-3.5" />
                    <span>Move to Album</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPhotoIds([])}
                    className="p-1.5 rounded-xl hover:bg-[#1B1F1A] text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </div>
          </div>

          {/* Grid of screenshots in this album */}
          {activeScreenshots.length === 0 ? (
            <div className="text-center py-16 p-8 rounded-3xl border border-dashed border-[#30362E]">
              <Layers className="w-12 h-12 text-[#777E74] mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#F7F8F5]">No screenshots in this album</h3>
              <p className="text-xs text-[#A5AAA1] mt-1">
                Move screenshots here or upload new ones to populate this collection.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
              {activeScreenshots.map((item) => {
                const isSelected = selectedPhotoIds.includes(item.id);
                return (
                  <div key={item.id} className="relative group">
                    {/* Batch Selection Checkbox overlay */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectPhoto(item.id);
                      }}
                      className={`absolute top-3 left-3 z-30 p-1.5 rounded-xl transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#B7F36B] text-[#10130D] border border-[#B7F36B]"
                          : "bg-[#080908] hover:bg-[#1B1F1A] text-[#A5AAA1] border border-[#30362E] opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>

                    <ScreenshotCard
                      item={item}
                      isDark={isDark}
                      onSelect={() => onSelectScreenshot(item)}
                      onToggleFavorite={() => onToggleFavorite(item.id)}
                      onDelete={() => onDeleteScreenshot(item.id)}
                      onCopyText={() => {
                        navigator.clipboard.writeText(item.fullText || item.summary);
                        addToast({ title: "Copied OCR text to clipboard", type: "info" });
                      }}
                      isSelected={isSelected}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      ) : (
        /* Main Collections Overview View */
        <motion.div
          key="collections-grid"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22 }}
          className="space-y-6"
        >
          {/* Header Banner */}
          <PageHeroHeader
            type="collections"
            title="Your collections"
            isDark={isDark}
            actions={
              <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
                <button
                  onClick={() => {
                    if (!isPro && !isFounder) {
                      promptUpgrade("aiCollections");
                      return;
                    }
                    setMergeModalOpen(true);
                  }}
                  className="px-3.5 py-2 min-h-[44px] rounded-xl bg-[#1B1F1A] hover:bg-[#222720] text-[#F7F8F5] border border-[#30362E] hover:border-[#B7F36B] text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-[2px_2px_6px_rgba(0,0,0,0.4)]"
                >
                  <Merge className="w-4 h-4 text-[#A5AAA1] shrink-0" />
                  <span className="truncate whitespace-nowrap">Merge</span>
                  {!isPro && !isFounder && <ProBadge size="xs" variant="pill" />}
                </button>

                <button
                  onClick={() => {
                    if (!isPro && !isFounder) {
                      promptUpgrade("aiCollections");
                      return;
                    }
                    setIsCreateOpen(true);
                  }}
                  className="px-4 py-2 min-h-[44px] rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-[2px_2px_8px_rgba(0,0,0,0.4)] border border-[#B7F36B] active:scale-98"
                >
                  <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
                  <span className="truncate whitespace-nowrap">New Collection</span>
                  {!isPro && !isFounder && <ProBadge size="xs" variant="solid" />}
                </button>
              </div>
            }
          />

          {/* Search Bar for Collections */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-[#A5AAA1] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search collections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs border border-[#30362E] bg-[#0D0F0D] text-[#F7F8F5] placeholder-[#777E74] shadow-[inset_2px_2px_5px_rgba(0,0,0,0.65)] focus:outline-none focus:border-[#B7F36B] transition-all"
            />
          </div>

          {/* Collection Card Grid (1, 2, or 4 columns - NO 3-card rows) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
            {filteredCollections.map((col) => {
              const thumbs = getRepresentativeStackThumbnails(col.name);
              const mainThumb = thumbs[0] || "";
              const theme = getCategoryTheme(col.name, col.description);
              const ThemeIcon = theme.icon;

              return (
                <motion.div
                  key={col.name}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => handleCollectionClick(col)}
                  className="group relative rounded-3xl border border-[#30362E] p-4 cursor-pointer transition-all duration-200 bg-[#141714] hover:bg-[#1B1F1A] hover:border-[#B7F36B]/60 shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.02)]"
                >
                  {/* Apple Photos Overlapping Stack Image Effect */}
                  <div className="relative w-full aspect-[4/3] rounded-2xl mb-4 overflow-hidden bg-[#0D0F0D] border border-[#30362E] shadow-[inset_2px_2px_6px_rgba(0,0,0,0.65)]">
                    {/* Background Stack Layer 2 */}
                    {thumbs[2] && (
                      <div className="absolute inset-0 scale-[0.88] translate-y-[-8px] opacity-40 rounded-2xl overflow-hidden border border-[#30362E] shadow-md">
                        <img src={thumbs[2]} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    {/* Background Stack Layer 1 */}
                    {thumbs[1] && (
                      <div className="absolute inset-0 scale-[0.94] translate-y-[-4px] opacity-70 rounded-2xl overflow-hidden border border-[#30362E] shadow-md">
                        <img src={thumbs[1]} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}

                    {/* Top Main Image or Themed Contextual Visual */}
                    {mainThumb ? (
                      <img
                        src={mainThumb}
                        alt={col.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 relative z-10"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[#0D0F0D] relative z-10">
                        <div className="p-3.5 rounded-2xl bg-[#1B1F1A] border border-[#30362E] shadow-[2px_2px_6px_rgba(0,0,0,0.4)] group-hover:scale-110 transition-transform duration-300">
                          <ThemeIcon className="w-8 h-8 text-[#B7F36B]" />
                        </div>
                        <span className="mt-2 text-[10px] font-bold tracking-wider uppercase text-[#A5AAA1]">
                          {theme.label}
                        </span>
                      </div>
                    )}

                    {/* Security Lock Overlay if locked */}
                    {collectionSecurity.isCollectionLocked(col.name) && (
                      <div className="absolute inset-0 bg-[#0D0F0D]/95 z-20 flex flex-col items-center justify-center p-4 text-center">
                        <div className="w-10 h-10 rounded-2xl bg-[#1B1F1A] border border-[#30362E] flex items-center justify-center text-[#B7F36B] mb-2 shadow-[2px_2px_6px_rgba(0,0,0,0.5)]">
                          <Lock className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-[#F7F8F5]">Album Locked</span>
                        <span className="text-[10px] text-[#A5AAA1] mt-0.5">Tap to unlock</span>
                      </div>
                    )}

                    {/* Overlay Badges (Solid surface badges) */}
                    <div className="absolute inset-0 z-10 flex flex-col justify-between p-3 pointer-events-none">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {col.isAiGenerated ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E] flex items-center gap-1 shadow-[2px_2px_4px_rgba(0,0,0,0.4)]">
                              <Layers className="w-2.5 h-2.5 text-[#B7F36B]" />
                              Categorized
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#1B1F1A] text-[#F7F8F5] border border-[#30362E] shadow-[2px_2px_4px_rgba(0,0,0,0.4)]">
                              Custom Album
                            </span>
                          )}

                          {collectionSecurity.hasCollectionLock(col.name) && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E] flex items-center gap-1 shadow-[2px_2px_4px_rgba(0,0,0,0.4)]">
                              <Lock className="w-2.5 h-2.5" />
                              <span>{collectionSecurity.isCollectionLocked(col.name) ? "Locked" : "Unlocked"}</span>
                            </span>
                          )}
                        </div>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#0D0F0D] text-[#A5AAA1] border border-[#30362E] shadow-[2px_2px_4px_rgba(0,0,0,0.4)]">
                          {col.itemCount || 0} items
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Album Info & Action Dropdown */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <h3 className="text-sm font-extrabold text-[#F7F8F5] group-hover:text-[#B7F36B] transition-colors truncate">
                        {col.name}
                      </h3>
                      {col.description && (
                        <p className="text-[11px] text-[#A5AAA1] line-clamp-1">{col.description}</p>
                      )}
                    </div>

                    {/* Options Popover Button */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuCollection(activeMenuCollection === col.name ? null : col.name);
                        }}
                        className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {activeMenuCollection === col.name && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-8 z-50 w-44 rounded-2xl bg-[#141714] border border-[#30362E] shadow-[8px_8px_20px_rgba(0,0,0,0.85)] p-1.5 space-y-1"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuCollection(null);
                              setRenameTarget(col.name);
                              setRenameValue(col.name);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#A5AAA1] hover:bg-[#1B1F1A] hover:text-[#F7F8F5] rounded-xl transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Rename</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuCollection(null);
                              if (collectionSecurity.isCollectionLocked(col.name)) {
                                setSecurityModal({
                                  isOpen: true,
                                  collectionName: col.name,
                                  mode: "unlock",
                                  pendingTargetCollection: col.name,
                                });
                              } else if (collectionSecurity.hasCollectionLock(col.name)) {
                                setSecurityModal({
                                  isOpen: true,
                                  collectionName: col.name,
                                  mode: "settings",
                                });
                              } else {
                                setSecurityModal({
                                  isOpen: true,
                                  collectionName: col.name,
                                  mode: "configure",
                                });
                              }
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#B7F36B] hover:bg-[#1B1F1A] rounded-xl transition-colors cursor-pointer"
                          >
                            <Shield className="w-3.5 h-3.5 text-[#B7F36B]" />
                            <span>{collectionSecurity.hasCollectionLock(col.name) ? "Lock Settings" : "Protect with Lock"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuCollection(null);
                              setSelectedMergeSources([col.name]);
                              setTargetMergeName(col.name);
                              setMergeModalOpen(true);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#A5AAA1] hover:bg-[#1B1F1A] hover:text-[#F7F8F5] rounded-xl transition-colors cursor-pointer"
                          >
                            <Merge className="w-3.5 h-3.5" />
                            <span>Merge</span>
                          </button>

                          <button
                            onClick={() => {
                              setActiveMenuCollection(null);
                              setDeleteTarget(col.name);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-600/20 rounded-xl transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Album</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* MODAL 1: Create Custom Collection */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md p-6 rounded-3xl border border-[#30362E] bg-[#141714] text-[#F7F8F5] shadow-[10px_10px_30px_rgba(0,0,0,0.85)] space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-[#B7F36B]" />
                  <h3 className="text-lg font-bold">New Custom Collection</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-[#1B1F1A] text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#A5AAA1] mb-1.5 uppercase tracking-wider">
                    Album Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tax Returns 2026, Gym Workouts"
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-[#0D0F0D] border-[#30362E] text-xs text-[#F7F8F5] placeholder-[#777E74] focus:outline-none focus:border-[#B7F36B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#A5AAA1] mb-1.5 uppercase tracking-wider">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Brief description of this collection..."
                    value={newColDesc}
                    onChange={(e) => setNewColDesc(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-[#0D0F0D] border-[#30362E] text-xs text-[#F7F8F5] placeholder-[#777E74] focus:outline-none focus:border-[#B7F36B]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#30362E]">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#1B1F1A] text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] text-xs font-bold cursor-pointer"
                  >
                    Create Collection
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Rename Collection */}
      <AnimatePresence>
        {renameTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md p-6 rounded-3xl border border-[#30362E] bg-[#141714] text-[#F7F8F5] shadow-[10px_10px_30px_rgba(0,0,0,0.85)] space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-[#B7F36B]" />
                  <h3 className="text-lg font-bold">Rename Collection</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setRenameTarget(null)}
                  className="p-1.5 rounded-xl hover:bg-[#1B1F1A] text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRenameSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#A5AAA1] mb-1.5 uppercase tracking-wider">
                    New Name for "{renameTarget}"
                  </label>
                  <input
                    type="text"
                    required
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-[#0D0F0D] border-[#30362E] text-xs text-[#F7F8F5] focus:outline-none focus:border-[#B7F36B]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#30362E]">
                  <button
                    type="button"
                    onClick={() => setRenameTarget(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#1B1F1A] text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] text-xs font-bold cursor-pointer"
                  >
                    Save Rename
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: Delete Collection */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md p-6 rounded-3xl border border-[#30362E] bg-[#141714] text-[#F7F8F5] shadow-[10px_10px_30px_rgba(0,0,0,0.85)] space-y-5"
            >
              <div className="flex items-center gap-3 text-rose-400">
                <Trash2 className="w-6 h-6" />
                <h3 className="text-lg font-bold text-[#F7F8F5]">Delete Collection "{deleteTarget}"?</h3>
              </div>

              <p className="text-xs text-[#A5AAA1] leading-relaxed">
                Choose how you would like to handle the screenshots currently inside this collection:
              </p>

              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-2xl bg-[#0D0F0D] border border-[#30362E] cursor-pointer hover:border-[#B7F36B]">
                  <input
                    type="radio"
                    name="deleteOption"
                    checked={!deleteWithPhotos}
                    onChange={() => setDeleteWithPhotos(false)}
                    className="accent-[#B7F36B]"
                  />
                  <div>
                    <p className="text-xs font-bold text-[#F7F8F5]">Keep photos, unassign album</p>
                    <p className="text-[10px] text-[#A5AAA1]">
                      Move screenshots to "General Vault" without deleting photos.
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-2xl bg-[#1B1F1A] border border-rose-500/40 cursor-pointer hover:border-rose-500">
                  <input
                    type="radio"
                    name="deleteOption"
                    checked={deleteWithPhotos}
                    onChange={() => setDeleteWithPhotos(true)}
                    className="accent-rose-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-rose-300">Delete album AND all screenshots</p>
                    <p className="text-[10px] text-rose-300/80">
                      Permanently delete all screenshots inside this album.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#30362E]">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#1B1F1A] text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSubmit}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: Merge Collections */}
      <AnimatePresence>
        {mergeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg p-6 rounded-3xl border border-[#30362E] bg-[#141714] text-[#F7F8F5] shadow-[10px_10px_30px_rgba(0,0,0,0.85)] space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Merge className="w-5 h-5 text-[#B7F36B]" />
                  <h3 className="text-lg font-bold">Merge Collections</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setMergeModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-[#1B1F1A] text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleMergeSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#A5AAA1] mb-1.5 uppercase tracking-wider">
                    Select Source Collections to Merge
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-2xl bg-[#0D0F0D] border border-[#30362E]">
                    {collections.map((c) => {
                      const isSelected = selectedMergeSources.includes(c.name);
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => {
                            setSelectedMergeSources((prev) =>
                              prev.includes(c.name)
                                ? prev.filter((s) => s !== c.name)
                                : [...prev, c.name]
                            );
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-[#B7F36B] text-[#10130D] font-bold"
                              : "hover:bg-[#1B1F1A] text-[#A5AAA1] hover:text-[#F7F8F5]"
                          }`}
                        >
                          <span>{c.name}</span>
                          <span className="text-[10px] opacity-80">{c.itemCount || 0} items</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#A5AAA1] mb-1.5 uppercase tracking-wider">
                    Merged Target Collection Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Combined Receipts & Bills"
                    value={targetMergeName}
                    onChange={(e) => setTargetMergeName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-[#0D0F0D] border-[#30362E] text-xs text-[#F7F8F5] placeholder-[#777E74] focus:outline-none focus:border-[#B7F36B]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#30362E]">
                  <button
                    type="button"
                    onClick={() => setMergeModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#1B1F1A] text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={selectedMergeSources.length === 0 || !targetMergeName.trim()}
                    className="px-5 py-2 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] disabled:opacity-50 text-[#10130D] text-xs font-bold cursor-pointer"
                  >
                    Merge Albums
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 5: Move Screenshots to Target Album */}
      <AnimatePresence>
        {isMoveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md p-6 rounded-3xl border border-[#30362E] bg-[#141714] text-[#F7F8F5] shadow-[10px_10px_30px_rgba(0,0,0,0.85)] space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Move className="w-5 h-5 text-[#B7F36B]" />
                  <h3 className="text-lg font-bold">Move {selectedPhotoIds.length} Photo(s)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMoveModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-[#1B1F1A] text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-[#A5AAA1] uppercase tracking-wider">
                  Select Target Destination Album
                </label>
                <div className="max-h-56 overflow-y-auto space-y-1.5 p-2 rounded-2xl bg-[#0D0F0D] border border-[#30362E]">
                  {collections.map((c) => {
                    const isSelected = targetMoveCollection === c.name;
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setTargetMoveCollection(c.name)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-[#B7F36B] text-[#10130D]"
                            : "hover:bg-[#1B1F1A] text-[#A5AAA1] hover:text-[#F7F8F5]"
                        }`}
                      >
                        <span>{c.name}</span>
                        <span className="text-[10px] opacity-80">{c.itemCount || 0} items</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#30362E]">
                <button
                  type="button"
                  onClick={() => setIsMoveModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#1B1F1A] text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBatchMoveSubmit}
                  disabled={!targetMoveCollection}
                  className="px-5 py-2 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] disabled:opacity-50 text-[#10130D] text-xs font-bold cursor-pointer"
                >
                  Confirm Move
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reusable Contextual Upgrade Prompt for Pro Features */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={closeUpgradeModal}
        feature={activePromptContext.feature || "aiCollections"}
        isDark={isDark}
      />

      {/* Security Lock Modal for Pattern/PIN/Password */}
      <SecurityLockModal
        isOpen={securityModal.isOpen}
        onClose={() => setSecurityModal((prev) => ({ ...prev, isOpen: false }))}
        collectionName={securityModal.collectionName}
        mode={securityModal.mode}
        onSuccess={() => {
          if (securityModal.pendingTargetCollection) {
            setSelectedCollectionName(securityModal.pendingTargetCollection);
          }
          setSecurityModal((prev) => ({ ...prev, isOpen: false, pendingTargetCollection: undefined }));
        }}
        addToast={addToast}
      />
    </div>
  );
};
