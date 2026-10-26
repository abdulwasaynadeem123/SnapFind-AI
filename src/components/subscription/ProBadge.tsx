import React from "react";
import { Sparkles } from "lucide-react";

export interface ProBadgeProps {
  variant?: "solid" | "subtle" | "outline" | "pill" | "glow";
  size?: "xs" | "sm" | "md" | "lg";
  showIcon?: boolean;
  label?: string;
  onClick?: () => void;
  className?: string;
  isDark?: boolean;
}

export const ProBadge: React.FC<ProBadgeProps> = ({
  variant = "pill",
  size = "sm",
  showIcon = true,
  label = "PRO",
  onClick,
  className = "",
}) => {
  const sizeClasses = {
    xs: "text-[10px] px-1.5 py-0.5 gap-1 font-bold",
    sm: "text-xs px-2 py-0.5 gap-1 font-bold",
    md: "text-xs px-2.5 py-1 gap-1.5 font-bold",
    lg: "text-sm px-3 py-1.5 gap-2 font-extrabold",
  };

  const iconSizes = {
    xs: "w-2.5 h-2.5",
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  const variantClasses = {
    solid:
      "bg-[#116466] text-[#F1F5F9] shadow-sm border border-[#116466]/60",
    subtle:
      "bg-[#1E293B] text-[#D1E8E2] border border-[#334155]",
    outline:
      "bg-transparent text-[#D1E8E2] border border-[#116466]",
    pill:
      "bg-[#116466]/20 text-[#D1E8E2] border border-[#116466]/40 backdrop-blur-sm",
    glow:
      "bg-[#116466] text-[#F1F5F9] shadow-md shadow-[#116466]/40 border border-[#D1E8E2]/50",
  };

  const isClickable = Boolean(onClick);

  return (
    <span
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      className={`inline-flex items-center justify-center rounded-full tracking-wide transition-all select-none ${
        sizeClasses[size]
      } ${variantClasses[variant]} ${
        isClickable ? "cursor-pointer hover:opacity-90 active:scale-95" : ""
      } ${className}`}
    >
      {showIcon && <Sparkles className={`${iconSizes[size]} shrink-0`} />}
      <span>{label}</span>
    </span>
  );
};

export default ProBadge;
