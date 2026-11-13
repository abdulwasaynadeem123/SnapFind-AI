import React from "react";

export interface SnapFindLogoProps {
  className?: string;
  size?: number | string;
  alt?: string;
  isDark?: boolean;
  showText?: boolean;
  showTagline?: boolean;
  variant?: "icon" | "horizontal" | "stacked";
  textClassName?: string;
}

/**
 * SnapFind AI - Vector Brand Logo Icon
 * Clean, solid 11-color palette with zero gradients and zero glow.
 */
export const SnapFindLogoSVG: React.FC<{
  className?: string;
  size?: number | string;
  isDark?: boolean;
  includeBackground?: boolean;
}> = ({ className = "w-full h-full", size, includeBackground = true }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      role="img"
      aria-label="SnapFind AI Logo"
    >
      {/* 1. Base Canvas in solid #080908 with #30362E border */}
      {includeBackground && (
        <>
          <rect width="100" height="100" rx="22" fill="#080908" />
          <rect x="2" y="2" width="96" height="96" rx="20" stroke="#30362E" strokeWidth="2" />
        </>
      )}

      {/* 2. Magnifying Glass Handle in solid #30362E with #B7F36B tip */}
      <line
        x1="58"
        y1="58"
        x2="78"
        y2="78"
        stroke="#1B1F1A"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <line
        x1="58"
        y1="58"
        x2="78"
        y2="78"
        stroke="#30362E"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="78" cy="78" r="3.5" fill="#B7F36B" />

      {/* 3. Magnifying Glass Lens Rim in solid #B7F36B */}
      <circle
        cx="46"
        cy="44"
        r="22"
        stroke="#B7F36B"
        strokeWidth="4.5"
        fill="#141714"
      />

      {/* 4. Inner Viewfinder Frame in #1B1F1A */}
      <rect
        x="36"
        y="34"
        width="20"
        height="20"
        rx="4"
        fill="#1B1F1A"
        stroke="#30362E"
        strokeWidth="1.5"
      />

      {/* 5. Viewfinder Corner Marks in #B7F36B */}
      <path
        d="M 33 38 L 33 32 L 39 32"
        stroke="#B7F36B"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 53 32 L 59 32 L 59 38"
        stroke="#B7F36B"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 33 50 L 33 56 L 39 56"
        stroke="#B7F36B"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 53 56 L 59 56 L 59 50"
        stroke="#B7F36B"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 6. Clean Mountain Graphic in #F7F8F5 */}
      <circle cx="41.5" cy="40.5" r="1.5" fill="#F7F8F5" />
      <path
        d="M 38 50 L 43 43 L 47 47 L 50 42 L 54 50 Z"
        fill="#F7F8F5"
      />
    </svg>
  );
};

/**
 * SnapFind AI - Full Brand Presentation (Icon + Typography + Tagline)
 */
export const SnapFindLogoFull: React.FC<{
  className?: string;
  size?: number | string;
  isDark?: boolean;
  showTagline?: boolean;
}> = ({ className = "w-full max-w-xs", isDark = true, showTagline = true }) => {
  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Icon Mark */}
      <div className="w-20 h-20 sm:w-24 sm:h-24 relative flex items-center justify-center">
        <SnapFindLogoSVG isDark={isDark} includeBackground={false} />
      </div>

      {/* Brand Title: SnapFind */}
      <div className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center">
        <span className="text-[#F7F8F5]">Snap</span>
        <span className="text-[#B7F36B]">Find</span>
      </div>

      {/* Tagline */}
      {showTagline && (
        <div className="mt-1 text-xs font-medium text-[#A5AAA1] tracking-wider uppercase">
          Search your screenshots
        </div>
      )}
    </div>
  );
};

/**
 * Universal SnapFind Logo Component
 */
export const SnapFindLogo: React.FC<SnapFindLogoProps> = ({
  className = "w-10 h-10 rounded-xl",
  size,
  alt = "SnapFind Logo",
  isDark = true,
  showText = false,
  showTagline = false,
  variant = "icon",
  textClassName = "font-bold text-base tracking-tight",
}) => {
  if (variant === "stacked" || (showText && showTagline)) {
    return <SnapFindLogoFull className={className} isDark={isDark} showTagline={showTagline} />;
  }

  return (
    <div className={`inline-flex items-center gap-2.5 ${showText ? "" : "shrink-0"}`}>
      <div
        className={`relative flex items-center justify-center shrink-0 overflow-hidden bg-[#080908] border border-[#30362E] shadow-[2px_2px_6px_rgba(0,0,0,0.5)] ${className}`}
        title={alt}
      >
        <SnapFindLogoSVG className="w-full h-full object-contain" size={size} isDark={isDark} includeBackground={false} />
      </div>

      {showText && (
        <span className={textClassName}>
          <span className="text-[#F7F8F5]">Snap</span>
          <span className="text-[#B7F36B]">Find</span>
        </span>
      )}
    </div>
  );
};

export default SnapFindLogo;
