import React, { useState } from "react";
import {
  Heart,
  Calendar,
  Image as ImageIcon,
  Check,
  Maximize2,
  Lock,
  Copy,
  Sparkles,
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

export const ScreenshotCard: React.FC<ScreenshotCardProps> = ({
  item,
  matchInfo,
  isSelected = false,
  isSelectionMode = false,
  onSelect,
  onToggleSelect,
  onToggleFavorite,
}) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgSrc, setImgSrc] = useState(item.thumbnailUri || item.imageUrl || FALLBACK_IMAGE_PLACEHOLDER);
  const [isRevealed, setIsRevealed] = useState(false);

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

  const formattedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
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

  return (
    <div
      onClick={handleCardClick}
      className={`group relative rounded-2xl border overflow-hidden cursor-pointer transition-all duration-200 select-none ${
        isSelected
          ? "bg-[#1E293B] border-[#116466] ring-2 ring-[#116466]/60 shadow-[0_0_20px_rgba(17,100,102,0.3)]"
          : "bg-[#1E293B]/95 border-[#334155] hover:border-[#116466] hover:bg-[#243347] shadow-[0_0_12px_rgba(0,0,0,0.5)]"
      }`}
    >
      {/* Thumbnail Image Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#2C3531]">
        {!imgLoaded && (
          <div className="absolute inset-0 bg-[#2C3531] flex items-center justify-center text-[#94A3B8]/40">
            <ImageIcon className="w-8 h-8 opacity-40 animate-pulse" />
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

        <div className="absolute inset-0 bg-gradient-to-t from-[#2C3531] via-transparent to-black/30 opacity-70 group-hover:opacity-50 transition-opacity" />

        {/* Security & Privacy Badge with tap-to-unblur */}
        {isSensitive && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsRevealed((r) => !r);
            }}
            className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-lg bg-[#2C3531]/90 backdrop-blur-xs border border-[#D9B08C]/60 text-[#D9B08C] text-[10px] font-mono font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            title={isRevealed ? "Tap to blur" : "Tap to reveal screenshot"}
          >
            <Lock className="w-2.5 h-2.5 text-[#D9B08C]" />
            <span>{isRevealed ? "REVEALED" : "PRIVATE BLUR"}</span>
          </button>
        )}

        {/* Smart Category Indicator */}
        {!isSensitive && (item.smart_category || item.smartCategory || item.category) && (
          <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-lg bg-[#2C3531]/90 backdrop-blur-xs border border-[#334155] text-[#94A3B8] text-[10px] font-mono font-medium flex items-center gap-1">
            <span>{item.smart_category || item.smartCategory || item.category}</span>
          </div>
        )}

        {/* Duplicate Badge */}
        {isDuplicateItem && (
          <div className="absolute bottom-2 right-2 z-10 px-2 py-0.5 rounded-lg bg-[#2C3531]/90 backdrop-blur-xs border border-[#D9B08C]/60 text-[#D9B08C] text-[10px] font-mono font-medium flex items-center gap-1">
            <Copy className="w-2.5 h-2.5" />
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
            className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
              isSelected
                ? "bg-[#116466] text-[#F1F5F9] shadow-md font-bold border border-[#116466]"
                : "bg-[#2C3531]/80 backdrop-blur-xs border border-[#334155] text-transparent hover:border-[#116466]"
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
              ? "bg-[#1E293B] text-[#D1E8E2] border border-[#334155]"
              : "opacity-0 group-hover:opacity-100 bg-[#2C3531]/80 backdrop-blur-xs text-[#94A3B8] hover:text-[#F1F5F9] border border-[#334155] hover:border-[#116466]"
          }`}
          title={item.isFavorite ? "Favorited" : "Add to favorites"}
        >
          <Heart className={`w-3.5 h-3.5 ${item.isFavorite ? "fill-current" : ""}`} />
        </button>
      </div>

      {/* Card Content */}
      <div className="p-3.5 space-y-2">
        <h3 className="font-bold text-xs sm:text-sm text-[#F1F5F9] line-clamp-1 group-hover:text-[#D1E8E2] transition-colors">
          {item.title}
        </h3>

        {/* Highlighted Match Text Snippet (if searching) */}
        {matchInfo?.highlightSnippet ? (
          <div className="p-2 rounded-lg bg-[#2C3531] border border-[#334155] text-[11px] text-[#94A3B8] leading-relaxed">
            <div className="flex items-center gap-1 text-[9px] font-mono text-[#D1E8E2] uppercase tracking-wider mb-0.5">
              <Sparkles className="w-2.5 h-2.5 text-[#D1E8E2]" />
              <span>Matched OCR Text</span>
            </div>
            <p className="line-clamp-2 text-[#F1F5F9]">
              <span className="text-[#D1E8E2] font-semibold bg-[#1E293B] px-1 py-0.5 rounded border border-[#334155]">
                "{matchInfo.highlightSnippet}"
              </span>
            </p>
          </div>
        ) : (
          <p className="text-xs text-[#94A3B8] line-clamp-2 leading-relaxed">
            {item.summary || item.fullText?.slice(0, 80) || "Screenshot capture"}
          </p>
        )}

        {/* Footer: Date & Inspect */}
        <div className="flex items-center justify-between pt-1.5 text-[11px] font-mono text-[#94A3B8]/70 border-t border-[#334155]">
          <div className="flex items-center gap-1.5 tabular-nums">
            <Calendar className="w-3 h-3 text-[#94A3B8]/70" />
            <span>{formattedDate}</span>
          </div>

          <span className="text-[#94A3B8] group-hover:text-[#D1E8E2] font-medium flex items-center gap-1 transition-colors">
            <Maximize2 className="w-3 h-3" /> Inspect
          </span>
        </div>
      </div>
    </div>
  );
};

export default ScreenshotCard;
