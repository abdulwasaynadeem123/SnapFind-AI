import React from "react";
import { Hero3dObject, Hero3dObjectType } from "./Hero3dObject";

export interface PageHeroHeaderProps {
  type: Hero3dObjectType;
  title: string;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  isDark?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const PageHeroHeader: React.FC<PageHeroHeaderProps> = ({
  type,
  title,
  subtitle,
  description,
  badge,
  actions,
  isDark = true,
  className = "",
  size = "md",
}) => {
  const displayDescription = subtitle || description;
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3 sm:pb-5 border-b ${
        isDark ? "border-[#30362E]" : "border-slate-200"
      } ${className}`}
    >
      {/* Left: Clean Badge + Single-Line Title & Subtitle */}
      <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
        <Hero3dObject type={type} size={size} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h1
              className={`text-lg sm:text-xl md:text-2xl font-bold tracking-tight truncate whitespace-nowrap ${
                isDark ? "text-[#F7F8F5]" : "text-slate-900"
              }`}
            >
              {title}
            </h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>

          {displayDescription && (
            <div
              className={`text-xs sm:text-sm font-normal truncate whitespace-nowrap mt-0.5 ${
                isDark ? "text-[#A5AAA1]" : "text-slate-600"
              }`}
            >
              {displayDescription}
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions / Buttons - stacked or wrapped cleanly on mobile */}
      {actions && (
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap w-full sm:w-auto shrink-0 justify-start sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
};
