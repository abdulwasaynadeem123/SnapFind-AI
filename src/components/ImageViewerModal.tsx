import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  X,
  Copy,
  Check,
  Download,
  Star,
  Trash2,
  Sparkles,
  FileText,
  AlignLeft,
  Search,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Info,
  Calendar,
  Layers,
  Share2,
  RotateCcw,
  Tag,
  Box,
  QrCode,
  Globe,
  ExternalLink,
  Link2,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  Phone,
  Mail,
  Package,
  DollarSign,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ScreenshotItem } from "../types";
import { AskAIBottomSheet } from "./AskAIBottomSheet";
import { extractStructuredEntitiesFromText, ExtractedEntities } from "../utils/ocrPreprocessing";

interface ImageViewerModalProps {
  item: ScreenshotItem | null;
  items?: ScreenshotItem[];
  onSelectItem?: (item: ScreenshotItem) => void;
  onClose: () => void;
  isDark: boolean;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onReindex?: (id: string) => void;
  onSearchTag: (tag: string) => void;
}

interface CategoryButtonDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  item,
  items = [],
  onSelectItem,
  onClose,
  isDark,
  onToggleFavorite,
  onDelete,
  onReindex,
  onSearchTag,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [ocrSearch, setOcrSearch] = useState("");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isAskAIOpen, setIsAskAIOpen] = useState(false);
  const [revealSensitive, setRevealSensitive] = useState(false);
  const [confirmLinkUrl, setConfirmLinkUrl] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);

  // Gallery item index calculation
  const activeItemsList = items.length > 0 ? items : item ? [item] : [];
  const currentIndex = activeItemsList.findIndex((i) => i.id === item?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < activeItemsList.length - 1;

  const isSensitive = Boolean(
    item?.is_sensitive ||
    item?.isSensitive ||
    item?.privacy_level === "highly_sensitive" ||
    item?.privacy_level === "private" ||
    item?.privacyLevel === "highly_sensitive" ||
    item?.privacyLevel === "private"
  );

  const rawOcrText = (item?.fullText || item?.ocr_text || "").trim();
  const maskedText = (item?.masked_ocr_text || item?.maskedOcrText || "").trim();
  const displayedOcrText = isSensitive && !revealSensitive && maskedText ? maskedText : rawOcrText;

  // Extract structured entities dynamically from OCR text
  const entities: ExtractedEntities = useMemo(() => {
    if (!rawOcrText && !displayedOcrText) {
      return { dates: [], phoneNumbers: [], emails: [], urls: [], amounts: [], trackingNumbers: [] };
    }
    return extractStructuredEntitiesFromText(displayedOcrText || rawOcrText);
  }, [displayedOcrText, rawOcrText]);

  // 1. Description Validation
  const validDescription = useMemo(() => {
    if (!item) return null;
    const raw = (item.description || item.ai_description || item.summary || "").trim();
    if (!raw) return null;
    const lower = raw.toLowerCase();
    if (
      lower === "screenshot" ||
      lower === "imported screenshot" ||
      lower === "screenshot image." ||
      lower.startsWith("screenshot pending")
    ) {
      return null;
    }
    return raw;
  }, [item]);

  // 2. OCR Text Validation
  const validOcr = useMemo(() => {
    return rawOcrText.length > 0 ? displayedOcrText || rawOcrText : null;
  }, [rawOcrText, displayedOcrText]);

  // 3. Links Validation
  const validUrls = useMemo(() => {
    if (!item) return [];
    const set = new Set<string>();
    const candidates = [
      ...(item.detected_urls || []),
      ...(item.detectedUrls || []),
      ...(item.urls || []),
      ...(item.website?.detectedUrls || []),
      item.website_url,
      item.websiteUrl,
      item.website?.websiteUrl,
      item.website?.url,
      ...entities.urls,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim().length > 3) {
        const trimmed = c.trim();
        const urlCandidate =
          trimmed.startsWith("http://") || trimmed.startsWith("https://")
            ? trimmed
            : `https://${trimmed}`;
        try {
          const parsed = new URL(urlCandidate);
          if (parsed.protocol === "http:" || parsed.protocol === "https:") {
            set.add(urlCandidate);
          }
        } catch {}
      }
    }
    return Array.from(set);
  }, [item, entities.urls]);

  const websiteName = item?.website_name || item?.websiteName || item?.website?.name;
  const websiteDomain = item?.website_domain || item?.websiteDomain || item?.website?.domain;

  // 4. QR Code Validation
  const hasQrCode = Boolean(
    item?.has_qr_code ||
    item?.hasQrCode ||
    (typeof item?.qr_code === "object" && item?.qr_code?.hasQrCode) ||
    Boolean(item?.qr_code_data) ||
    Boolean(item?.qrCodeData)
  );
  const qrDataRaw =
    item?.qr_code_data ||
    item?.qrCodeData ||
    (typeof item?.qr_code === "object"
      ? item?.qr_code?.data
      : typeof item?.qr_code === "string"
      ? item?.qr_code
      : null);
  const validQrData = hasQrCode && qrDataRaw && qrDataRaw.trim().length > 0 ? qrDataRaw.trim() : null;
  const qrType =
    item?.qr_code_type ||
    item?.qrCodeType ||
    (typeof item?.qr_code === "object" ? item?.qr_code?.type : "URL") ||
    "URL";
  const qrUrl =
    item?.qr_url ||
    item?.qrUrl ||
    (typeof item?.qr_code === "object" ? item?.qr_code?.url : null) ||
    (validQrData && validQrData.startsWith("http") ? validQrData : null);

  // 5. Phone Numbers Validation
  const validPhoneNumbers = useMemo(() => {
    if (!item) return [];
    const list = [
      ...(item.extractedEntities?.phoneNumbers || []),
      ...entities.phoneNumbers,
    ];
    const set = new Set<string>();
    for (const p of list) {
      if (typeof p === "string" && p.trim().length >= 6) {
        set.add(p.trim());
      }
    }
    return Array.from(set);
  }, [item, entities.phoneNumbers]);

  // 6. Emails Validation
  const validEmails = useMemo(() => {
    if (!item) return [];
    const list = [
      ...(item.extractedEntities?.emails || []),
      ...entities.emails,
    ];
    const set = new Set<string>();
    for (const e of list) {
      if (typeof e === "string" && e.includes("@") && e.includes(".")) {
        set.add(e.toLowerCase().trim());
      }
    }
    return Array.from(set);
  }, [item, entities.emails]);

  // 7. Tracking IDs Validation
  const validTrackingNumbers = useMemo(() => {
    if (!item) return [];
    const list = [
      ...(item.extractedEntities?.trackingNumbers || []),
      ...entities.trackingNumbers,
    ];
    const set = new Set<string>();
    for (const t of list) {
      if (
        typeof t === "string" &&
        t.trim().length >= 6 &&
        !["confirmation", "transaction", "invoice"].includes(t.toLowerCase().trim())
      ) {
        set.add(t.trim());
      }
    }
    return Array.from(set);
  }, [item, entities.trackingNumbers]);

  // 8. Prices Validation
  const validPrices = useMemo(() => {
    if (!item) return [];
    const list = [
      ...(item.extractedEntities?.amounts || []),
      ...entities.amounts,
    ];
    const set = new Set<string>();
    for (const a of list) {
      if (typeof a === "string" && a.trim().length > 0) {
        set.add(a.trim());
      }
    }
    return Array.from(set);
  }, [item, entities.amounts]);

  // 9. Categories Validation
  const validCategories = useMemo(() => {
    if (!item) return [];
    const set = new Set<string>();
    if (item.category && item.category !== "Other" && item.category !== "All") {
      set.add(item.category);
    }
    const smart = item.smart_category || item.smartCategory;
    if (smart && smart !== "Other") {
      set.add(smart);
    }
    const col = item.collectionName || item.collection;
    if (col && col !== "General Vault") {
      set.add(col);
    }
    return Array.from(set);
  }, [item]);

  // 10. Tags Validation
  const validTags = useMemo(() => {
    if (!item) return [];
    const set = new Set<string>();
    const rawTags = [
      ...(Array.isArray(item.tags) ? item.tags : []),
      ...(Array.isArray(item.keyEntities) ? item.keyEntities : []),
      ...(Array.isArray(item.keywords) ? item.keywords : []),
    ];
    for (const t of rawTags) {
      if (typeof t === "string") {
        const clean = t.replace(/^#/, "").trim();
        if (clean.length > 1) {
          set.add(clean);
        }
      }
    }
    return Array.from(set);
  }, [item]);

  // 11. AI Insights Validation
  const validObjects = useMemo(() => {
    if (!item) return [];
    if (Array.isArray(item.objects) && item.objects.length > 0) {
      return item.objects.filter(Boolean);
    }
    if (Array.isArray(item.objectsDetected) && item.objectsDetected.length > 0) {
      return item.objectsDetected.filter(Boolean);
    }
    return [];
  }, [item]);

  const validPrivacyReasons = useMemo(() => {
    if (!item) return [];
    return (item.privacy_reasons || item.privacyReasons || []).filter(Boolean);
  }, [item]);

  const validSensitiveCategories = useMemo(() => {
    if (!item) return [];
    return (item.sensitive_categories || item.sensitiveCategories || []).filter(Boolean);
  }, [item]);

  const hasAiInsights = validObjects.length > 0 || validPrivacyReasons.length > 0 || validSensitiveCategories.length > 0;

  // 12. Metadata Validation (dimensions, filesize, hash, date)
  const hasValidMetadata = useMemo(() => {
    if (!item) return false;
    return Boolean(
      (item.fileName || item.file_name) ||
      (item.width && item.height) ||
      item.dimensions ||
      (item.fileSizeKB && item.fileSizeKB > 0) ||
      (item.file_size && item.file_size > 0) ||
      item.createdAt ||
      item.date_created ||
      item.sha256Hash ||
      item.content_hash
    );
  }, [item]);

  // Construct Dynamic Information Category Buttons (ONLY for categories with valid data)
  const availableCategories: CategoryButtonDef[] = useMemo(() => {
    const list: CategoryButtonDef[] = [];

    if (validDescription) {
      list.push({ id: "description", label: "Description", icon: FileText });
    }
    if (validOcr) {
      list.push({ id: "ocr", label: "OCR Text", icon: AlignLeft });
    }
    if (validUrls.length > 0) {
      list.push({ id: "links", label: "Links", icon: Link2, count: validUrls.length });
    }
    if (validQrData) {
      list.push({ id: "qr", label: "QR Codes", icon: QrCode });
    }
    if (validPhoneNumbers.length > 0) {
      list.push({ id: "phones", label: "Phone Numbers", icon: Phone, count: validPhoneNumbers.length });
    }
    if (validEmails.length > 0) {
      list.push({ id: "emails", label: "Email Addresses", icon: Mail, count: validEmails.length });
    }
    if (validTrackingNumbers.length > 0) {
      list.push({ id: "tracking", label: "Tracking IDs", icon: Package, count: validTrackingNumbers.length });
    }
    if (validPrices.length > 0) {
      list.push({ id: "prices", label: "Prices", icon: DollarSign, count: validPrices.length });
    }
    if (validCategories.length > 0) {
      list.push({ id: "categories", label: "Categories", icon: Layers, count: validCategories.length });
    }
    if (validTags.length > 0) {
      list.push({ id: "tags", label: "Tags", icon: Tag, count: validTags.length });
    }
    if (hasAiInsights) {
      list.push({ id: "insights", label: "AI Insights", icon: Sparkles });
    }
    if (hasValidMetadata) {
      list.push({ id: "metadata", label: "Metadata", icon: Info });
    }

    return list;
  }, [
    validDescription,
    validOcr,
    validUrls.length,
    validQrData,
    validPhoneNumbers.length,
    validEmails.length,
    validTrackingNumbers.length,
    validPrices.length,
    validCategories.length,
    validTags.length,
    hasAiInsights,
    hasValidMetadata,
  ]);

  // When active screenshot item changes, default to first available category
  useEffect(() => {
    setZoomLevel(1);
    setRevealSensitive(false);
    setOcrSearch("");
    setIsFullscreenPreview(false);

    if (availableCategories.length > 0) {
      const preferred =
        availableCategories.find((c) => c.id === "description") ||
        availableCategories.find((c) => c.id === "ocr") ||
        availableCategories[0];
      setActiveCategory(preferred ? preferred.id : null);
    } else {
      setActiveCategory(null);
    }
  }, [item?.id]);

  const copyToClipboard = (text: string, fieldId: string) => {
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField((curr) => (curr === fieldId ? null : curr)), 2000);
    }
  };

  const handleNext = useCallback(() => {
    if (hasNext && onSelectItem) {
      onSelectItem(activeItemsList[currentIndex + 1]);
    }
  }, [hasNext, onSelectItem, activeItemsList, currentIndex]);

  const handlePrev = useCallback(() => {
    if (hasPrev && onSelectItem) {
      onSelectItem(activeItemsList[currentIndex - 1]);
    }
  }, [hasPrev, onSelectItem, activeItemsList, currentIndex]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    if (!item) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (confirmLinkUrl) {
        if (e.key === "Escape") setConfirmLinkUrl(null);
        return;
      }
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key.toLowerCase() === "f") {
        onToggleFavorite(item.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [item, handleNext, handlePrev, onClose, onToggleFavorite, confirmLinkUrl]);

  if (!item) return null;

  const ocrLines = validOcr ? validOcr.split("\n").filter((l) => l.trim().length > 0) : [];
  const filteredOcrLines = ocrSearch
    ? ocrLines.filter((line) => line.toLowerCase().includes(ocrSearch.toLowerCase()))
    : ocrLines;
  const ocrWordCount = validOcr ? validOcr.split(/\s+/).filter(Boolean).length : 0;
  const ocrCharCount = validOcr ? validOcr.length : 0;

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = item.imageUrl;
    a.download = `${item.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_screenshot.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = () => {
    const text = `📸 ${item.title}\nCategory: ${item.category}\n\nSummary: ${item.summary || item.description || ""}`;
    if (navigator.share) {
      navigator.share({ title: item.title, text }).catch(() => {
        navigator.clipboard.writeText(text);
      });
    } else {
      navigator.clipboard.writeText(text);
    }
  };

  const formattedDate = new Date(item.createdAt || item.date_created || Date.now()).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/90 backdrop-blur-md p-0 md:p-6 select-none scroll-smooth">
      {/* Modal Page Container */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 15 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-4xl min-h-screen md:min-h-0 bg-[#16202C] text-[#F1F5F9] border-0 md:border md:border-[#273548] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden my-0 md:my-6 select-text"
      >
        {/* Top Sticky Header */}
        <div className="sticky top-0 z-30 px-4 sm:px-6 py-3.5 border-b border-[#273548] bg-[#16202C]/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
          {/* Back to Gallery Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1E293B] hover:bg-[#243347] border border-[#334155] text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm active:scale-98"
              title="Return to gallery (Esc)"
            >
              <ArrowLeft className="w-4 h-4 text-slate-300" />
              <span>Back to Gallery</span>
            </button>

            {activeItemsList.length > 1 && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#1E293B] border border-[#334155] text-xs font-mono text-[#D1E8E2]">
                <button
                  disabled={!hasPrev}
                  onClick={handlePrev}
                  className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                  title="Previous screenshot (Left Arrow)"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span>
                  {currentIndex + 1} / {activeItemsList.length}
                </span>
                <button
                  disabled={!hasNext}
                  onClick={handleNext}
                  className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                  title="Next screenshot (Right Arrow)"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Ask AI */}
            <button
              onClick={() => setIsAskAIOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#116466] border border-[#116466] text-white hover:bg-[#157F81] font-semibold text-xs transition-colors cursor-pointer shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#D1E8E2]" />
              <span className="hidden sm:inline">Ask AI</span>
            </button>

            {/* Favorite */}
            <button
              onClick={() => onToggleFavorite(item.id)}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                item.isFavorite
                  ? "bg-[#1E293B] text-[#D9B08C] border-[#334155]"
                  : "bg-[#1E293B]/60 text-slate-400 border-[#334155] hover:text-white"
              }`}
              title={item.isFavorite ? "Remove favorite (F)" : "Mark favorite (F)"}
            >
              <Star className={`w-4 h-4 ${item.isFavorite ? "fill-current" : ""}`} />
            </button>

            {/* Sensitive Mask / Unmask Toggle */}
            {isSensitive && (
              <button
                onClick={() => setRevealSensitive((r) => !r)}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  revealSensitive
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    : "bg-[#D9B08C]/20 text-[#D9B08C] border-[#D9B08C]/40"
                }`}
                title={revealSensitive ? "Hide sensitive content" : "Reveal private content"}
              >
                {revealSensitive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}

            {/* Share */}
            <button
              onClick={handleShare}
              className="p-2 rounded-xl bg-[#1E293B]/60 text-slate-400 hover:text-white border border-[#334155] transition-colors cursor-pointer"
              title="Share summary"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              className="p-2 rounded-xl bg-[#1E293B]/60 text-slate-400 hover:text-white border border-[#334155] transition-colors cursor-pointer"
              title="Download image"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Delete */}
            <button
              onClick={() => onDelete(item.id)}
              className="p-2 rounded-xl bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/30 transition-colors cursor-pointer"
              title="Delete screenshot"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-[#1E293B] hover:bg-[#243347] border border-[#334155] text-slate-300 hover:text-white transition-colors cursor-pointer ml-1"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
          {/* 1. SCREENSHOT PREVIEW AT THE TOP */}
          <div className="relative rounded-2xl bg-black/60 border border-[#273548] p-3 sm:p-4 flex flex-col items-center justify-center overflow-hidden">
            {/* Image display */}
            <div className="relative max-h-[46vh] w-full flex items-center justify-center overflow-hidden">
              <motion.img
                animate={{ scale: zoomLevel }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                src={item.imageUrl}
                alt={item.title}
                className={`max-h-[44vh] w-auto max-w-full object-contain rounded-xl shadow-2xl transition-all duration-300 ${
                  isSensitive && !revealSensitive ? "filter blur-2xl brightness-75 contrast-75" : ""
                }`}
              />

              {/* Private Blur Notice & Quick Unblur Button */}
              {isSensitive && !revealSensitive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-6 pointer-events-none">
                  <div className="p-4 sm:p-5 rounded-2xl bg-black/90 backdrop-blur-xl border border-rose-500/30 max-w-xs text-center space-y-3 shadow-2xl pointer-events-auto">
                    <div className="w-10 h-10 mx-auto rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400 border border-rose-500/30">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Private Screenshot Blurred</h4>
                      <p className="text-[11px] text-slate-300 mt-1">
                        Sensitive text and numerical fields masked to protect against shoulder surfing.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRevealSensitive(true)}
                      className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/20"
                    >
                      <Eye className="w-3.5 h-3.5 text-rose-400" />
                      <span>Tap to Reveal Image</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Floating Zoom & Controls bar */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 p-1 rounded-xl bg-[#16202C]/90 backdrop-blur-md border border-[#334155] text-slate-300 text-xs shadow-md">
              <button
                onClick={() => setZoomLevel((z) => Math.max(1, z - 0.25))}
                className="p-1.5 hover:bg-white/10 rounded-lg transition cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 font-mono text-[11px] text-[#D1E8E2]">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                className="p-1.5 hover:bg-white/10 rounded-lg transition cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsFullscreenPreview((prev) => !prev)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition cursor-pointer border-l border-[#334155] ml-0.5"
                title={isFullscreenPreview ? "Standard preview" : "Expanded preview"}
              >
                {isFullscreenPreview ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* 2. CLEAR SCREENSHOT TITLE & HEADER SUMMARY */}
          <div className="space-y-2 border-b border-[#273548] pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight break-words">
                {item.title}
              </h1>
              <span className="text-xs text-slate-400 font-medium shrink-0 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                {formattedDate}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400">
              {item.category && item.category !== "Other" && (
                <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30 font-medium">
                  {item.category}
                </span>
              )}
              {(item.smart_category || item.smartCategory) && (
                <span className="px-2.5 py-0.5 rounded-lg bg-[#116466]/20 text-[#D1E8E2] border border-[#116466]/40 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#116466]" />
                  <span>{item.smart_category || item.smartCategory}</span>
                </span>
              )}
              {item.fileName && (
                <span className="font-mono text-[11px] text-slate-400 truncate max-w-[200px]">
                  {item.fileName}
                </span>
              )}
              {(item.fileSizeKB || item.file_size) && (
                <span className="font-mono text-[11px] text-slate-500">
                  • {item.fileSizeKB ? `${item.fileSizeKB} KB` : `${Math.round((item.file_size || 0) / 1024)} KB`}
                </span>
              )}
            </div>
          </div>

          {/* 3. INFORMATION NAVIGATION AREA (DYNAMIC CATEGORY BUTTONS) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#D1E8E2]">
                  Available Information
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {availableCategories.length > 0
                    ? `Click a category below to view detailed extracted content (${availableCategories.length} available).`
                    : "No extracted text or structured data available for this screenshot."}
                </p>
              </div>

              {availableCategories.length > 0 && activeCategory && (
                <button
                  onClick={() => setActiveCategory(null)}
                  className="text-[11px] font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Close Active View
                </button>
              )}
            </div>

            {/* Category Buttons List — ONLY RENDERED FOR VALID CATEGORIES */}
            {availableCategories.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {availableCategories.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = activeCategory === cat.id;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(isActive ? null : cat.id)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer border ${
                        isActive
                          ? "bg-[#116466] text-[#F1F5F9] border-[#157F81] shadow-[0_0_14px_rgba(17,100,102,0.4)] scale-102"
                          : "bg-[#1E293B] text-slate-300 border-[#334155] hover:bg-[#243347] hover:text-white hover:border-[#475569]"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? "text-[#D1E8E2]" : "text-slate-400"}`} />
                      <span>{cat.label}</span>
                      {typeof cat.count === "number" && (
                        <span
                          className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-[#273548] text-slate-300 border border-[#334155]"
                          }`}
                        >
                          {cat.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Case D: Screenshot containing only an image with no extracted information */
              <div className="p-8 text-center rounded-2xl border border-dashed border-[#334155] bg-[#1E293B]/40 text-slate-400 space-y-3">
                <Box className="w-8 h-8 text-slate-500 mx-auto" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">No Extracted Information</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    This screenshot does not contain extracted text, links, or detected entities yet.
                  </p>
                </div>
                {onReindex && (
                  <button
                    onClick={() => onReindex(item.id)}
                    className="px-4 py-2 rounded-xl bg-[#116466] hover:bg-[#157F81] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Scan with OCR &amp; Vision AI</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 4. DETAILED INFORMATION DISPLAY AREA (ONLY ONE ACTIVE CATEGORY AT A TIME) */}
          <AnimatePresence mode="wait">
            {activeCategory && (
              <motion.div
                key={activeCategory}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="rounded-2xl border border-[#334155] bg-[#1E293B]/80 backdrop-blur-sm p-4 sm:p-6 space-y-4 shadow-xl"
              >
                {/* CATEGORY: Description */}
                {activeCategory === "description" && validDescription && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#D1E8E2]" />
                        <h3 className="text-sm font-bold text-white">Full Description &amp; AI Summary</h3>
                      </div>
                      <button
                        onClick={() => copyToClipboard(validDescription, "desc")}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 transition cursor-pointer"
                        title="Copy description"
                      >
                        {copiedField === "desc" ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap break-words select-text">
                      {validDescription}
                    </div>
                  </div>
                )}

                {/* CATEGORY: OCR Text */}
                {activeCategory === "ocr" && validOcr && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#334155] pb-3">
                      <div className="flex items-center gap-2">
                        <AlignLeft className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-sm font-bold text-white">Extracted OCR Text</h3>
                        <span className="text-xs font-mono text-emerald-300/80 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {ocrWordCount} words • {ocrCharCount} chars
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyToClipboard(validOcr, "ocr")}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-semibold text-emerald-300 transition cursor-pointer"
                          title="Copy all OCR text"
                        >
                          {copiedField === "ocr" ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy All Text</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Filter search within OCR text */}
                    {ocrLines.length > 2 && (
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={ocrSearch}
                          onChange={(e) => setOcrSearch(e.target.value)}
                          placeholder="Search keywords within extracted text..."
                          className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-black/40 border border-[#334155] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                    )}

                    {/* Text display */}
                    <div className="max-h-96 overflow-y-auto font-mono text-xs sm:text-[13px] leading-relaxed text-slate-200 bg-black/50 p-4 rounded-xl border border-white/5 select-text whitespace-pre-wrap break-words">
                      {filteredOcrLines.length > 0 ? (
                        filteredOcrLines.map((line, idx) => (
                          <div key={idx} className="py-0.5 hover:bg-white/5 rounded px-1 -mx-1">
                            {line}
                          </div>
                        ))
                      ) : (
                        <span className="text-slate-500 italic">No text matching "{ocrSearch}"</span>
                      )}
                    </div>
                  </div>
                )}

                {/* CATEGORY: Links */}
                {activeCategory === "links" && validUrls.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                      <div className="flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-cyan-400" />
                        <h3 className="text-sm font-bold text-white">Detected Links &amp; URLs</h3>
                        <span className="text-xs font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                          {validUrls.length}
                        </span>
                      </div>
                    </div>

                    {websiteName && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-slate-300">
                        <Globe className="w-4 h-4 text-sky-400 shrink-0" />
                        <span className="font-semibold text-white">{websiteName}</span>
                        {websiteDomain && <span className="text-slate-400 font-mono">({websiteDomain})</span>}
                      </div>
                    )}

                    <div className="space-y-2">
                      {validUrls.map((url, idx) => (
                        <div
                          key={`url-${idx}`}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-black/30 border border-white/5 hover:border-white/10 transition"
                        >
                          <span className="font-mono text-xs text-sky-300 hover:text-white truncate max-w-full sm:max-w-md select-all" title={url}>
                            {url}
                          </span>
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <button
                              onClick={() => copyToClipboard(url, `url-${idx}`)}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                              title="Copy URL"
                            >
                              {copiedField === `url-${idx}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>Copy</span>
                            </button>
                            <button
                              onClick={() => setConfirmLinkUrl(url)}
                              className="px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-semibold transition flex items-center gap-1.5 border border-cyan-500/30 cursor-pointer"
                              title="Safely open link with confirmation"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CATEGORY: QR Codes */}
                {activeCategory === "qr" && validQrData && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                      <div className="flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-teal-400" />
                        <h3 className="text-sm font-bold text-white">QR Code &amp; Decoded Payload</h3>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/15 text-teal-300 border border-teal-500/30 uppercase tracking-wide">
                        Type: {qrType}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-black/50 border border-white/5 font-mono text-xs sm:text-sm text-slate-200 break-all select-all leading-relaxed">
                      {validQrData}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => copyToClipboard(validQrData, "qrData")}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium transition flex items-center gap-1.5 border border-white/10 cursor-pointer"
                      >
                        {copiedField === "qrData" ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Payload</span>
                          </>
                        )}
                      </button>

                      {qrUrl && (
                        <button
                          onClick={() => setConfirmLinkUrl(qrUrl)}
                          className="px-3.5 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-xs font-semibold transition flex items-center gap-1.5 border border-teal-500/30 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open Decoded Link</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* CATEGORY: Phone Numbers */}
                {activeCategory === "phones" && validPhoneNumbers.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-green-400" />
                        <h3 className="text-sm font-bold text-white">Extracted Phone Numbers</h3>
                        <span className="text-xs font-mono text-green-300 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                          {validPhoneNumbers.length}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {validPhoneNumbers.map((phone, idx) => (
                        <div
                          key={`phone-${idx}`}
                          className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 text-xs font-mono"
                        >
                          <span className="text-green-300 font-semibold text-sm select-all">{phone}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copyToClipboard(phone, `phone-${idx}`)}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs flex items-center gap-1 cursor-pointer"
                            >
                              {copiedField === `phone-${idx}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>Copy</span>
                            </button>
                            <a
                              href={`tel:${phone.replace(/\s+/g, "")}`}
                              className="px-3 py-1 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 text-xs font-semibold border border-green-500/30 flex items-center gap-1"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>Call</span>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CATEGORY: Email Addresses */}
                {activeCategory === "emails" && validEmails.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-blue-400" />
                        <h3 className="text-sm font-bold text-white">Detected Email Addresses</h3>
                        <span className="text-xs font-mono text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                          {validEmails.length}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {validEmails.map((email, idx) => (
                        <div
                          key={`email-${idx}`}
                          className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 text-xs font-mono"
                        >
                          <span className="text-blue-300 font-semibold text-sm select-all">{email}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copyToClipboard(email, `email-${idx}`)}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs flex items-center gap-1 cursor-pointer"
                            >
                              {copiedField === `email-${idx}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>Copy</span>
                            </button>
                            <a
                              href={`mailto:${email}`}
                              className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 text-xs font-semibold border border-blue-500/30 flex items-center gap-1"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>Email</span>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CATEGORY: Tracking IDs */}
                {activeCategory === "tracking" && validTrackingNumbers.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-amber-400" />
                        <h3 className="text-sm font-bold text-white">Tracking &amp; Reference Numbers</h3>
                        <span className="text-xs font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {validTrackingNumbers.length}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {validTrackingNumbers.map((trk, idx) => (
                        <div
                          key={`trk-${idx}`}
                          className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 text-xs font-mono"
                        >
                          <span className="text-amber-300 font-semibold text-sm select-all">{trk}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copyToClipboard(trk, `trk-${idx}`)}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs flex items-center gap-1 cursor-pointer"
                            >
                              {copiedField === `trk-${idx}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>Copy</span>
                            </button>
                            <button
                              onClick={() =>
                                setConfirmLinkUrl(
                                  `https://www.google.com/search?q=tracking+${encodeURIComponent(trk)}`
                                )
                              }
                              className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold border border-amber-500/30 flex items-center gap-1 cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Track</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CATEGORY: Prices */}
                {activeCategory === "prices" && validPrices.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-sm font-bold text-white">Prices &amp; Monetary Values</h3>
                        <span className="text-xs font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {validPrices.length}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      {validPrices.map((amt, idx) => (
                        <div
                          key={`amt-${idx}`}
                          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black/40 border border-emerald-500/30 text-xs font-mono text-emerald-300"
                        >
                          <span className="font-bold text-sm select-all">{amt}</span>
                          <button
                            onClick={() => copyToClipboard(amt, `amt-${idx}`)}
                            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                            title="Copy amount"
                          >
                            {copiedField === `amt-${idx}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CATEGORY: Categories */}
                {activeCategory === "categories" && validCategories.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-400" />
                        <h3 className="text-sm font-bold text-white">Categories &amp; Vault</h3>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      {item.category && item.category !== "Other" && (
                        <div className="px-3.5 py-2 rounded-xl bg-blue-500/15 text-blue-300 border border-blue-500/25 text-xs font-semibold flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-blue-400" />
                          <span>Primary: {item.category}</span>
                        </div>
                      )}
                      {(item.smart_category || item.smartCategory) && (
                        <div className="px-3.5 py-2 rounded-xl bg-[#116466]/20 text-[#D1E8E2] border border-[#116466]/40 text-xs font-semibold flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-[#116466]" />
                          <span>Smart Category: {item.smart_category || item.smartCategory}</span>
                        </div>
                      )}
                      {(item.collectionName || item.collection) && (
                        <div className="px-3.5 py-2 rounded-xl bg-purple-500/15 text-purple-300 border border-purple-500/25 text-xs font-semibold flex items-center gap-2">
                          <Box className="w-3.5 h-3.5 text-purple-400" />
                          <span>Collection: {item.collectionName || item.collection}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* CATEGORY: Tags */}
                {activeCategory === "tags" && validTags.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-indigo-400" />
                        <h3 className="text-sm font-bold text-white">Tags &amp; Keywords</h3>
                        <span className="text-xs font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                          {validTags.length}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">Click any tag to search</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {validTags.map((tag, idx) => (
                        <button
                          key={`tag-${idx}`}
                          onClick={() => {
                            onSearchTag(tag);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[#1E293B] border border-[#334155] text-slate-200 hover:border-[#116466] hover:bg-[#116466]/20 hover:text-[#D1E8E2] transition-colors cursor-pointer flex items-center gap-1.5"
                          title={`Search gallery for "${tag}"`}
                        >
                          <span className="text-slate-400 font-mono">#</span>
                          <span>{tag}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* CATEGORY: AI Insights */}
                {activeCategory === "insights" && hasAiInsights && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-rose-300" />
                        <h3 className="text-sm font-bold text-white">AI Vision &amp; Security Signals</h3>
                      </div>
                    </div>

                    {validObjects.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Detected Physical Objects
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {validObjects.map((obj, idx) => (
                            <button
                              key={`obj-${idx}`}
                              onClick={() => {
                                onSearchTag(obj);
                                onClose();
                              }}
                              className="px-3 py-1.5 rounded-xl text-xs bg-black/40 border border-[#334155] text-slate-200 hover:bg-[#116466]/20 hover:text-white transition cursor-pointer flex items-center gap-1.5"
                            >
                              <Box className="w-3.5 h-3.5 text-slate-400" />
                              <span>{obj}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {validPrivacyReasons.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-[#334155]">
                        <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                          Security &amp; Privacy Signals
                        </span>
                        <div className="space-y-1.5">
                          {validPrivacyReasons.map((reason, idx) => (
                            <div key={`priv-${idx}`} className="text-xs text-rose-300 flex items-start gap-2 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                              <span>{reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* CATEGORY: Metadata */}
                {activeCategory === "metadata" && hasValidMetadata && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-slate-400" />
                        <h3 className="text-sm font-bold text-white">Technical File Metadata</h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-1">
                        <span className="text-slate-400 block">File Name</span>
                        <span className="font-mono text-slate-200 break-all select-all">
                          {item.fileName || item.file_name || "screenshot.png"}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-1">
                        <span className="text-slate-400 block">Date Added</span>
                        <span className="text-slate-200 font-medium">{formattedDate}</span>
                      </div>

                      {(item.width || item.dimensions?.width) && (
                        <div className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-1">
                          <span className="text-slate-400 block">Resolution</span>
                          <span className="font-mono text-slate-200">
                            {item.width || item.dimensions?.width} × {item.height || item.dimensions?.height} px
                          </span>
                        </div>
                      )}

                      {(item.fileSizeKB || item.file_size) && (
                        <div className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-1">
                          <span className="text-slate-400 block">File Size</span>
                          <span className="font-mono text-slate-200">
                            {item.fileSizeKB ? `${item.fileSizeKB} KB` : `${Math.round((item.file_size || 0) / 1024)} KB`}
                          </span>
                        </div>
                      )}

                      {(item.sha256Hash || item.content_hash || item.hash) && (
                        <div className="col-span-1 sm:col-span-2 p-3 rounded-xl bg-black/30 border border-white/5 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">SHA-256 Content Hash</span>
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  item.sha256Hash || item.content_hash || item.hash || "",
                                  "hash"
                                )
                              }
                              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              {copiedField === "hash" ? (
                                <span className="text-emerald-400 flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Copied
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Copy className="w-3 h-3" /> Copy Hash
                                </span>
                              )}
                            </button>
                          </div>
                          <span className="font-mono text-[11px] text-slate-300 break-all select-all block">
                            {item.sha256Hash || item.content_hash || item.hash}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* When no category is active, show clean prompt */}
          {!activeCategory && availableCategories.length > 0 && (
            <div className="p-6 text-center rounded-2xl border border-dashed border-[#334155] bg-[#1E293B]/30 text-slate-400">
              <Info className="w-5 h-5 mx-auto mb-1.5 text-slate-500" />
              <p className="text-xs font-medium text-slate-300">
                Click any category button above to display its complete information.
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Safe Link Confirmation Modal Dialog */}
      <AnimatePresence>
        {confirmLinkUrl && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
              onClick={() => setConfirmLinkUrl(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-md p-6 rounded-2xl border border-cyan-500/30 bg-[#16202C] shadow-2xl space-y-4 text-[#F1F5F9]"
            >
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-base font-bold text-white">External Link Safety Check</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  You are about to navigate to an external website in a new browser tab:
                </p>
                <div className="p-3 rounded-xl bg-black/50 border border-white/10 font-mono text-xs text-cyan-300 break-all select-all">
                  {confirmLinkUrl}
                </div>
                <p className="text-[11px] text-slate-400">
                  Always verify the destination domain. SnapFind never opens external links automatically.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmLinkUrl(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#334155] bg-[#1E293B] hover:bg-[#243347] text-xs font-semibold text-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = confirmLinkUrl;
                    setConfirmLinkUrl(null);
                    window.open(target, "_blank", "noopener,noreferrer");
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#116466] hover:bg-[#157F81] text-xs font-bold text-white shadow-lg shadow-[#116466]/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Proceed to Site</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ask AI Bottom Sheet Drawer */}
      <AskAIBottomSheet
        isOpen={isAskAIOpen}
        onClose={() => setIsAskAIOpen(false)}
        item={item}
      />
    </div>
  );
};
