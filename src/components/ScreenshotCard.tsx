import React, { useState } from "react";
import {
  Heart,
  Calendar,
  Image as ImageIcon,
  Check,
  Maximize2,
  Lock,
  Copy,
  Search,
  ExternalLink,
  FolderPlus,
  Archive,
  Globe,
  FileText,
} from "lucide-react";
import { ScreenshotItem, SearchResultMatch, CategoryType } from "../types";
import { FALLBACK_IMAGE_PLACEHOLDER, markImageFailed } from "../services/imageCache";

interface ScreenshotCardProps {
  item: ScreenshotItem;
  matchInfo?: SearchResultMatch;
  isDark?: boolean;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onSelect: (item: ScreenshotItem) => void;
  onToggleSelect?: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onMoveCategory?: (id: string, newCategory: CategoryType) => void;
  onDelete?: (id: string) => void;
  onCopyText?: (text: string) => void;
}

/**
 * Render snippet with highlighted matched terms
 */
const HighlightedSnippetText: React.FC<{ text: string; terms?: string[] }> = ({ text, terms = [] }) => {
  if (!text) return null;
  if (!terms || terms.length === 0) {
    return <span>"{text}"</span>;
  }

  const validTerms = terms
    .filter((t) => t && t.trim().length >= 2)
    .map((t) => t.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (validTerms.length === 0) {
    return <span>"{text}"</span>;
  }

  try {
    const regex = new RegExp(`(${validTerms.join("|")})`, "gi");
    const parts = text.split(regex);

    return (
      <span>
        "
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark
              key={i}
              className="bg-[#B7F36B] text-[#10130D] font-bold px-1 py-0.5 rounded shadow-xs"
            >
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
        "
      </span>
    );
  } catch {
    return <span>"{text}"</span>;
  }
};

export const ScreenshotCard: React.FC<ScreenshotCardProps> = ({
  item,
  matchInfo,
  isSelected = false,
  isSelectionMode = false,
  onSelect,
  onToggleSelect,
  onToggleFavorite,
  onMoveCategory,
  onDelete,
  onCopyText,
}) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgSrc, setImgSrc] = useState(item.thumbnailUri || item.imageUrl || FALLBACK_IMAGE_PLACEHOLDER);
  const [isRevealed, setIsRevealed] = useState(false);
  const [copiedRecently, setCopiedRecently] = useState(false);

  const isSensitive = Boolean(
    item.is_sensitive ||
    item.isSensitive ||
    item.privacy_level === "highly_sensitive" ||
    item.privacy_level === "private" ||
    item.privacyLevel === "highly_sensitive" ||
    item.privacyLevel === "private"
  );

  const isDuplicateItem = Boolean(item.isDuplicate);

  const handleImageError = () => {
    markImageFailed(item.imageUrl);
    setImgSrc(FALLBACK_IMAGE_PLACEHOLDER);
    setImgLoaded(true);
  };

  const formattedDate = new Date(item.createdAt || (item as any).date_created || Date.now()).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const handleCardClick = () => {
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect(item.id);
    } else {
      onSelect(item);
    }
  };

  const handleCopyExtractedText = (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = (item.fullText || item.ocr_text || item.summary || item.title || "").trim();
    if (!textToCopy) return;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy).catch(() => {});
    }
    if (onCopyText) {
      onCopyText(textToCopy);
    }
    setCopiedRecently(true);
    setTimeout(() => setCopiedRecently(false), 2000);
  };

  const handleOpenLinkSafely = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = item.website_url || (item.detected_urls && item.detected_urls[0]) || (item.urls && item.urls[0]);
    if (url) {
      const validUrl = url.startsWith("http") ? url : `https://${url}`;
      window.open(validUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleArchiveItem = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(item.id);
    }
  };

  const handleMoveCollection = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMoveCategory) {
      const targetCat: CategoryType = item.category === "Financial" ? "Receipt & Invoice" : "Financial";
      onMoveCategory(item.id, targetCat);
    }
  };

  const detectedUrl = item.website_url || (item.detected_urls && item.detected_urls[0]) || (item.urls && item.urls[0]);
  const sourceApp = item.source_app || item.sourceApp;
  const sourceDomain = item.website_domain || item.website_name || item.website?.domain || item.website?.name;

  return (
    <div
      onClick={handleCardClick}
      className={`group relative rounded-2xl border overflow-hidden cursor-pointer transition-all duration-200 select-none flex flex-col justify-between ${
        isSelected
          ? "bg-[#1B1F1A] border-[#B7F36B] ring-2 ring-[#B7F36B]/60 shadow-[6px_6px_16px_rgba(0,0,0,0.7)]"
          : "bg-[#141714] border-[#30362E] hover:border-[#B7F36B] hover:bg-[#1B1F1A] shadow-[4px_4px_12px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.02)]"
      }`}
    >
      <div>
        {/* Thumbnail Image Container */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#0D0F0D]">
          {!imgLoaded && (
            <div className="absolute inset-0 bg-[#0D0F0D] flex items-center justify-center text-[#777E74]">
              <ImageIcon className="w-8 h-8 opacity-40" />
            </div>
          )}

          <img
            src={imgSrc}
            alt={item.title}
            onLoad={() => setImgLoaded(true)}
            onError={handleImageError}
            className={`w-full h-full object-cover object-top transition-transform duration-300 ${
              imgLoaded ? "opacity-90 group-hover:opacity-100 group-hover:scale-105" : "opacity-0"
            } ${isSensitive && !isRevealed ? "filter blur-md scale-105 brightness-75" : ""}`}
            loading="lazy"
          />

          {/* Security & Privacy Badge with tap-to-unblur */}
          {isSensitive && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsRevealed((r) => !r);
              }}
              className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-lg bg-[#080908] border border-[#30362E] text-[#A5AAA1] text-[10px] font-mono font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title={isRevealed ? "Tap to blur" : "Tap to reveal screenshot"}
            >
              <Lock className="w-2.5 h-2.5 text-[#B7F36B]" />
              <span>{isRevealed ? "REVEALED" : "PRIVATE BLUR"}</span>
            </button>
          )}

          {/* Smart Category Indicator */}
          {!isSensitive && (item.smart_category || item.smartCategory || item.category) && (
            <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-lg bg-[#080908] border border-[#30362E] text-[#B7F36B] text-[10px] font-mono font-semibold flex items-center gap-1">
              <span>{item.smart_category || item.smartCategory || item.category}</span>
            </div>
          )}

          {/* Duplicate Badge */}
          {isDuplicateItem && (
            <div className="absolute bottom-2 right-2 z-10 px-2 py-0.5 rounded-lg bg-[#080908] border border-[#30362E] text-[#A5AAA1] text-[10px] font-mono font-medium flex items-center gap-1">
              <Copy className="w-2.5 h-2.5 text-[#B7F36B]" />
              <span>DUPLICATE</span>
            </div>
          )}

          {/* Multi-Select Checkbox */}
          {(isSelectionMode || isSelected) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect?.(item.id);
              }}
              className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                isSelected
                  ? "bg-[#B7F36B] text-[#10130D] shadow-md font-bold border border-[#B7F36B]"
                  : "bg-[#080908] border border-[#30362E] text-transparent hover:border-[#B7F36B]"
              }`}
            >
              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </button>
          )}

          {/* Favorite Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.id);
            }}
            className={`absolute top-2 right-2 z-10 p-1.5 rounded-lg transition-all cursor-pointer ${
              item.isFavorite
                ? "bg-[#141714] text-[#B7F36B] border border-[#30362E] shadow-sm"
                : "opacity-0 group-hover:opacity-100 bg-[#080908] text-[#A5AAA1] hover:text-[#F7F8F5] border border-[#30362E] hover:border-[#B7F36B]"
            }`}
            title={item.isFavorite ? "Favorited" : "Add to favorites"}
          >
            <Heart className={`w-3.5 h-3.5 ${item.isFavorite ? "fill-[#B7F36B] text-[#B7F36B]" : ""}`} />
          </button>
        </div>

        {/* Card Content */}
        <div className="p-3.5 space-y-2">
          {/* Title & Source App Header */}
          <div className="flex items-start justify-between gap-1.5">
            <h3 className="font-bold text-xs sm:text-sm text-[#F7F8F5] line-clamp-1 group-hover:text-[#B7F36B] transition-colors flex-1">
              {item.title}
            </h3>

            {(sourceApp || sourceDomain) && (
              <span
                className="shrink-0 text-[10px] font-mono text-[#A5AAA1] bg-[#0D0F0D] px-1.5 py-0.5 rounded border border-[#30362E] max-w-[120px] truncate"
                title={`Source: ${sourceApp || sourceDomain}`}
              >
                {sourceApp || sourceDomain}
              </span>
            )}
          </div>

          {/* Match Reason Tag (if searching) */}
          {matchInfo?.matchReason && (
            <div className="flex items-center gap-1.5 text-[10px] text-[#B7F36B] font-mono bg-[#1B1F1A] px-2 py-0.5 rounded-md border border-[#30362E]">
              <Search className="w-3 h-3 text-[#B7F36B] shrink-0" />
              <span className="truncate">{matchInfo.matchReason}</span>
            </div>
          )}

          {/* Highlighted Match Text Snippet (if searching) */}
          {matchInfo?.highlightSnippet ? (
            <div className="p-2.5 rounded-lg bg-[#0D0F0D] border border-[#30362E] text-[11px] text-[#A5AAA1] leading-relaxed shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between text-[9px] font-mono text-[#B7F36B] uppercase tracking-wider mb-1">
                <span className="flex items-center gap-1">
                  <FileText className="w-2.5 h-2.5 text-[#B7F36B]" />
                  Matching OCR Text
                </span>
                {matchInfo.score && (
                  <span className="text-[#A5AAA1] font-mono">
                    {Math.round(matchInfo.score * 100)}% match
                  </span>
                )}
              </div>
              <p className="line-clamp-2 text-[#F7F8F5] font-mono text-[10.5px]">
                <HighlightedSnippetText
                  text={matchInfo.highlightSnippet}
                  terms={matchInfo.matchedTerms || []}
                />
              </p>
            </div>
          ) : (
            <p className="text-xs text-[#A5AAA1] line-clamp-2 leading-relaxed">
              {item.summary || item.fullText?.slice(0, 90) || "Screenshot capture"}
            </p>
          )}

          {/* Quick Result Action Bar (Copy Text, Open Link, Move, Archive) */}
          <div className="flex items-center gap-1 pt-1 border-t border-[#30362E] text-[11px]">
            {/* Copy Extracted Text */}
            <button
              type="button"
              onClick={handleCopyExtractedText}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-medium transition-all cursor-pointer ${
                copiedRecently
                  ? "bg-[#B7F36B] text-[#10130D] font-bold border border-[#B7F36B]"
                  : "bg-[#1B1F1A] hover:bg-[#222720] text-[#A5AAA1] hover:text-[#F7F8F5] border border-[#30362E]"
              }`}
              title="Copy extracted OCR text"
            >
              {copiedRecently ? <Check className="w-3 h-3 text-[#10130D]" /> : <Copy className="w-3 h-3" />}
              <span>{copiedRecently ? "Copied" : "Copy"}</span>
            </button>

            {/* Open Recognized Link Safely */}
            {detectedUrl && (
              <button
                type="button"
                onClick={handleOpenLinkSafely}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#1B1F1A] hover:bg-[#222720] text-[#F7F8F5] hover:text-[#B7F36B] border border-[#30362E] text-[10.5px] font-medium transition-all cursor-pointer max-w-[90px] truncate"
                title={`Open recognized link: ${detectedUrl}`}
              >
                <ExternalLink className="w-3 h-3 text-[#B7F36B] shrink-0" />
                <span className="truncate">Link</span>
              </button>
            )}

            {/* Add to Collection */}
            {onMoveCategory && (
              <button
                type="button"
                onClick={handleMoveCollection}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#1B1F1A] hover:bg-[#222720] text-[#A5AAA1] hover:text-[#F7F8F5] border border-[#30362E] text-[10.5px] font-medium transition-all cursor-pointer"
                title="Move or organize in collection"
              >
                <FolderPlus className="w-3 h-3 text-[#B7F36B]" />
                <span className="hidden sm:inline">Vault</span>
              </button>
            )}

            {/* Archive / Delete */}
            {onDelete && (
              <button
                type="button"
                onClick={handleArchiveItem}
                className="ml-auto p-1 rounded-md bg-[#1B1F1A] hover:bg-rose-500/20 text-[#777E74] hover:text-rose-300 border border-[#30362E] hover:border-rose-500/40 text-[10.5px] transition-all cursor-pointer"
                title="Move screenshot to trash"
              >
                <Archive className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer: Date & Inspect */}
      <div className="px-3.5 pb-3 flex items-center justify-between text-[11px] font-mono text-[#777E74] border-t border-[#30362E] pt-2">
        <div className="flex items-center gap-1.5 tabular-nums">
          <Calendar className="w-3 h-3 text-[#777E74]" />
          <span>{formattedDate}</span>
        </div>

        <span className="text-[#A5AAA1] group-hover:text-[#B7F36B] font-medium flex items-center gap-1 transition-colors">
          <Maximize2 className="w-3 h-3" /> Inspect
        </span>
      </div>
    </div>
  );
};

export default ScreenshotCard;
