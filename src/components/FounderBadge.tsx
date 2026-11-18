import React from "react";
import { Crown } from "lucide-react";

export interface FounderBadgeProps {
  founderNumber?: number | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  mode?: "compact" | "badge" | "full" | "mobile";
  showNumber?: boolean;
  variant?: "solid" | "pill" | "outline" | "gold" | "silver" | "bronze";
  onClick?: () => void;
  className?: string;
  isDark?: boolean;
}

export const FounderBadge: React.FC<FounderBadgeProps> = ({
  founderNumber,
  size = "sm",
  mode = "badge",
  showNumber = true,
  variant = "pill",
  onClick,
  className = "",
}) => {
  const num = typeof founderNumber === "number" && founderNumber > 0 ? founderNumber : null;

  const sizeClasses = {
    xs: "text-[10px] px-1.5 py-0.5 gap-1 font-bold",
    sm: "text-xs px-2 py-0.5 gap-1 font-bold",
    md: "text-xs px-2.5 py-1 gap-1.5 font-bold",
    lg: "text-sm px-3 py-1.5 gap-2 font-extrabold",
    xl: "text-base px-4 py-2 gap-2.5 font-black",
  };

  const iconSizes = {
    xs: "w-2.5 h-2.5",
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-4 h-4",
    xl: "w-5 h-5",
  };

  const variantClasses = {
    solid: "bg-[#B7F36B] text-[#10130D] border border-[#B7F36B]",
    pill: "bg-[#1B1F1A] text-[#B7F36B] border border-[#B7F36B]/40",
    outline: "bg-transparent text-[#B7F36B] border border-[#B7F36B]/60",
    gold: "bg-[#B7F36B] text-[#10130D] border border-[#B7F36B]",
    silver: "bg-[#1B1F1A] text-[#F7F8F5] border border-[#30362E]",
    bronze: "bg-[#141714] text-[#B7F36B] border border-[#30362E]",
  };

  const isClickable = Boolean(onClick);
  const formattedNumber = num !== null ? `#${num}` : null;

  if (mode === "compact") {
    return (
      <span
        onClick={onClick}
        title={formattedNumber ? `VIP Seat ${formattedNumber}` : "VIP User"}
        className={`inline-flex items-center justify-center rounded-full font-mono text-[10px] font-bold px-2 py-0.5 bg-[#1B1F1A] text-[#B7F36B] border border-[#B7F36B]/40 ${
          isClickable ? "cursor-pointer hover:opacity-90" : ""
        } ${className}`}
      >
        <Crown className="w-2.5 h-2.5 mr-1 text-[#B7F36B]" />
        {formattedNumber ? `VIP ${formattedNumber}` : "VIP"}
      </span>
    );
  }

  if (mode === "mobile") {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#1B1F1A] border border-[#B7F36B]/35 text-[#F7F8F5] text-xs font-bold ${
          isClickable ? "cursor-pointer active:scale-95" : ""
        } ${className}`}
      >
        <Crown className="w-3.5 h-3.5 text-[#B7F36B]" />
        <span>VIP User</span>
        {formattedNumber && <span className="font-mono text-[#B7F36B]">{formattedNumber}</span>}
      </div>
    );
  }

  return (
    <span
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      title="SnapFind VIP User — Lifetime Pro Access"
      className={`inline-flex items-center justify-center rounded-full tracking-wide transition-all select-none ${
        sizeClasses[size]
      } ${variantClasses[variant]} ${
        isClickable ? "cursor-pointer hover:opacity-90 active:scale-95" : ""
      } ${className}`}
    >
      <Crown className={`${iconSizes[size]} shrink-0`} />
      <span>VIP User</span>
      {showNumber && formattedNumber && (
        <span className="font-mono opacity-90">{formattedNumber}</span>
      )}
    </span>
  );
};
