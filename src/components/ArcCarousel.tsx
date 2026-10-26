import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Layers, ArrowUpRight, Lock, Sparkles, FileText, CreditCard, Utensils, Code } from "lucide-react";
import { CollectionItem } from "../types";

interface ArcCarouselProps {
  collections: CollectionItem[];
  onSelectCollection?: (name: string) => void;
  className?: string;
}

export const ArcCarousel: React.FC<ArcCarouselProps> = ({
  collections,
  onSelectCollection,
  className = "",
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // High-fidelity local fallback smart collections
  const items = collections && collections.length > 0 ? collections : [
    {
      id: "sample-travel",
      name: "Travel & Passports",
      description: "Flight tickets, visa stamps, boarding passes, and passport snapshots.",
      itemCount: 8,
      coverImageUrl: "",
      categoryIcon: "travel",
      createdAt: new Date().toISOString(),
    },
    {
      id: "sample-bills",
      name: "Utility Bills & Receipts",
      description: "Electricity invoices, tax statements, and verified transaction receipts.",
      itemCount: 14,
      coverImageUrl: "",
      categoryIcon: "bills",
      createdAt: new Date().toISOString(),
    },
    {
      id: "sample-recipes",
      name: "Recipes & Cooking",
      description: "Culinary instructions, ingredient lists, and meal prep screenshots.",
      itemCount: 6,
      coverImageUrl: "",
      categoryIcon: "recipes",
      createdAt: new Date().toISOString(),
    },
    {
      id: "sample-code",
      name: "Dev & Code Snippets",
      description: "Terminal commands, architectural diagrams, error logs, and config snippets.",
      itemCount: 19,
      coverImageUrl: "",
      categoryIcon: "code",
      createdAt: new Date().toISOString(),
    },
    {
      id: "sample-vault",
      name: "Secure Private Vault",
      description: "Encrypted biometric storage for identity documents and financial records.",
      itemCount: 4,
      isLocked: true,
      coverImageUrl: "",
      categoryIcon: "vault",
      createdAt: new Date().toISOString(),
    },
  ];

  const total = items.length;

  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  const handleNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % total);
  }, [total]);

  // Subtle auto-advance if user isn't hovering
  useEffect(() => {
    if (isHovered || total <= 1) return;
    const interval = setInterval(() => {
      handleNext();
    }, 6000);
    return () => clearInterval(interval);
  }, [isHovered, total, handleNext]);

  const renderCover = (col: any) => {
    if (col.coverImageUrl && !col.coverImageUrl.includes("unsplash.com")) {
      return (
        <img
          src={col.coverImageUrl}
          alt={col.name}
          className="w-full h-full object-cover object-center filter brightness-90 transition-transform duration-500 hover:scale-105"
        />
      );
    }

    // High quality procedural Cyber Teal cover
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#1E293B] via-[#2C3531] to-[#2C3531] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 blueprint-grid opacity-20 pointer-events-none" />
        <div className="w-10 h-10 rounded-xl bg-[#2C3531] border border-[#334155] flex items-center justify-center text-[#D1E8E2] mb-1 shadow-md">
          {col.isLocked ? (
            <Lock className="w-5 h-5 text-[#D9B08C]" />
          ) : col.name.includes("Travel") ? (
            <FileText className="w-5 h-5 text-[#D1E8E2]" />
          ) : col.name.includes("Bill") ? (
            <CreditCard className="w-5 h-5 text-[#D1E8E2]" />
          ) : col.name.includes("Recipe") ? (
            <Utensils className="w-5 h-5 text-[#D1E8E2]" />
          ) : col.name.includes("Code") ? (
            <Code className="w-5 h-5 text-[#D1E8E2]" />
          ) : (
            <Layers className="w-5 h-5 text-[#D1E8E2]" />
          )}
        </div>
        <span className="text-[10px] font-mono text-[#94A3B8] tracking-wider uppercase">
          {col.name.split(" ")[0]}
        </span>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative w-full overflow-hidden py-6 select-none ${className}`}
    >
      {/* Header and Controls */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#116466] animate-pulse" />
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#D1E8E2] font-semibold">
            Featured Collections · Arc View
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous Collection"
            className="p-1.5 rounded-lg border border-[#334155] bg-[#2C3531] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#116466] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono text-[#94A3B8] px-1 tabular-nums">
            {activeIndex + 1}/{total}
          </span>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next Collection"
            className="p-1.5 rounded-lg border border-[#334155] bg-[#2C3531] text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#116466] transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3D Arc Stage */}
      <div
        className="relative h-[250px] sm:h-[280px] w-full flex items-center justify-center"
        style={{ perspective: "1100px", transformStyle: "preserve-3d" }}
      >
        {items.map((col, index) => {
          // Calculate offset relative to activeIndex (with wrap-around)
          let offset = index - activeIndex;
          if (offset > total / 2) offset -= total;
          if (offset < -total / 2) offset += total;

          const isCenter = offset === 0;
          const absOffset = Math.abs(offset);
          const isVisible = absOffset <= 2;

          if (!isVisible) return null;

          // Arc Curve Math: horizontal shift, depth translation, Y-rotation, and scale
          const translateX = offset * (typeof window !== "undefined" && window.innerWidth < 640 ? 150 : 210);
          const translateZ = -absOffset * 90;
          const rotateY = offset * -18;
          const scale = isCenter ? 1.03 : Math.max(0.78, 1 - absOffset * 0.16);
          const opacity = isCenter ? 1 : Math.max(0.35, 1 - absOffset * 0.35);
          const zIndex = 30 - absOffset * 10;

          return (
            <div
              key={col.id || col.name}
              onClick={() => {
                if (isCenter) {
                  onSelectCollection?.(col.name);
                } else {
                  setActiveIndex(index);
                }
              }}
              style={{
                transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                zIndex,
                opacity,
                transition: "transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease",
              }}
              className={`absolute w-[240px] sm:w-[280px] rounded-2xl overflow-hidden cursor-pointer transition-shadow duration-300 ${
                isCenter
                  ? "bg-[#1E293B] border-2 border-[#116466] shadow-[0_0_24px_rgba(17,100,102,0.35)]"
                  : "bg-[#2C3531] border border-[#334155] hover:border-[#475569]"
              }`}
            >
              {/* Cover Preview Image */}
              <div className="relative h-28 sm:h-32 w-full overflow-hidden bg-[#2C3531]">
                {renderCover(col)}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1E293B] via-transparent to-black/30" />

                {/* Badge: Item Count or Lock */}
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#2C3531]/85 backdrop-blur-xs border border-[#334155] text-[10px] font-mono text-[#D1E8E2]">
                  {col.isLocked ? (
                    <>
                      <Lock className="w-2.5 h-2.5 text-[#D9B08C]" />
                      <span className="text-[#D9B08C]">Encrypted</span>
                    </>
                  ) : (
                    <>
                      <span className="text-[#F1F5F9] font-semibold">{col.itemCount || 0}</span>
                      <span>snaps</span>
                    </>
                  )}
                </div>

                {isCenter && (
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#116466]/40 border border-[#116466] text-[#D1E8E2] text-[9px] font-mono font-bold tracking-wider">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>FOCUSED</span>
                  </div>
                )}
              </div>

              {/* Content Box */}
              <div className="p-3.5 space-y-1.5 bg-[#1E293B]">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs sm:text-sm text-[#F1F5F9] tracking-tight line-clamp-1">
                    {col.name}
                  </h4>
                  <ArrowUpRight className={`w-3.5 h-3.5 transition-transform ${isCenter ? "text-[#D1E8E2]" : "text-[#94A3B8]"}`} />
                </div>
                <p className="text-[11px] text-[#94A3B8] line-clamp-2 leading-relaxed">
                  {col.description || "Organized visual smart collection"}
                </p>
                <div className="pt-1.5 flex items-center justify-between text-[10px] font-mono text-[#94A3B8] border-t border-[#334155]">
                  <span>TAP TO OPEN</span>
                  <span className="text-[#D1E8E2] font-medium">VIEW ARCHIVE</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Dot Trackers */}
      <div className="flex items-center justify-center gap-1.5 mt-2">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveIndex(i)}
            aria-label={`Jump to slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === activeIndex
                ? "w-6 bg-[#116466] shadow-[0_0_8px_rgba(17,100,102,0.6)]"
                : "w-1.5 bg-[#334155] hover:bg-[#475569]"
            }`}
          />
        ))}
      </div>
    </div>
  );
};
