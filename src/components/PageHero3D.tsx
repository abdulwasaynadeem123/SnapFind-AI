import React from "react";
import {
  LayoutDashboard,
  Image as ImageIcon,
  Search,
  FolderKanban,
  Heart,
  Trash2,
  Upload,
  Layers,
  CreditCard,
  Bell,
  Settings,
  User,
  MessageSquare,
  Crown,
  Clock,
  Play,
  LucideIcon,
} from "lucide-react";

export type PageHero3DType =
  | "dashboard"
  | "gallery"
  | "search"
  | "collections"
  | "favorites"
  | "trash"
  | "import"
  | "snapdash"
  | "pricing"
  | "notifications"
  | "settings"
  | "account"
  | "feedback"
  | "founder"
  | "timeline"
  | "demo";

export interface PageHero3DProps {
  type: PageHero3DType;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  glow?: boolean;
}

interface BadgeConfig {
  icon: LucideIcon;
  bg: string;
  border: string;
  text: string;
}

const BADGE_CONFIGS: Record<PageHero3DType, BadgeConfig> = {
  dashboard: {
    icon: LayoutDashboard,
    bg: "bg-[#141714]",
    border: "border-[#30362E]",
    text: "text-[#B7F36B]",
  },
  gallery: {
    icon: ImageIcon,
    bg: "bg-[#141714]",
    border: "border-[#30362E]",
    text: "text-[#B7F36B]",
  },
  search: {
    icon: Search,
    bg: "bg-[#141714]",
    border: "border-[#30362E]",
    text: "text-[#B7F36B]",
  },
  collections: {
    icon: FolderKanban,
    bg: "bg-[#141714]",
    border: "border-[#30362E]",
    text: "text-[#B7F36B]",
  },
  favorites: {
    icon: Heart,
    bg: "bg-[#141714]",
    border: "border-[#30362E]",
    text: "text-[#B7F36B]",
  },
  trash: {
    icon: Trash2,
    bg: "bg-[#141714]",
    border: "border-[#30362E]",
    text: "text-[#A5AAA1]",
  },
  import: {
    icon: Upload,
    bg: "bg-[#141714]",
    border: "border-[#30362E]",
    text: "text-[#B7F36B]",
  },
  snapdash: {
    icon: Layers,
    bg: "bg-[#141714]",
    border: "border-[#30362E]",
    text: "text-[#B7F36B]",
  },
  pricing: {
    icon: CreditCard,
    bg: "bg-[#141714]",
    border: "border-[#30362E]",
    text: "text-[#B7F36B]",
  },
  notifications: {
    icon: Bell,
    bg: "bg-[#141714]",
    border: "border-[#30362E]",
    text: "text-[#B7F36B]",
  },
  settings: {
    icon: Settings,
    bg: "bg-[#141714]",
    border: "border-[#30362E]",
    text: "text-[#F7F8F5]",
  },
  account: {
    icon: User,
    bg: "bg-[#141714]",
    border: "border-[#30362E]",
    text: "text-[#F7F8F5]",
  },
  feedback: {
    icon: MessageSquare,
    bg: "bg-[#141714]",
    border: "border-[#30362E]",
    text: "text-[#B7F36B]",
  },
  founder: {
    icon: Crown,
    bg: "bg-[#141714]",
    border: "border-[#30362E]",
    text: "text-[#B7F36B]",
  },
  timeline: {
    icon: Clock,
    bg: "bg-[#141714]",
    border: "border-[#30362E]",
    text: "text-[#F7F8F5]",
  },
  demo: {
    icon: Play,
    bg: "bg-[#141714]",
    border: "border-[#30362E]",
    text: "text-[#B7F36B]",
  },
};

/**
 * PageHero3D / HeroBadge
 * Clean, purposeful icon badge conforming to the Hallmark & UI/UX Pro Max constitution.
 * Replaced decorative spinning 3D orbs and floating visual noise with high-contrast,
 * mobile-friendly, accessible badges.
 */
export const PageHero3D: React.FC<PageHero3DProps> = ({
  type,
  size = "md",
  className = "",
}) => {
  const config = BADGE_CONFIGS[type] || BADGE_CONFIGS.dashboard;
  const Icon = config.icon;

  const sizeClasses = {
    sm: "w-8 h-8 rounded-lg",
    md: "w-10 h-10 sm:w-11 sm:h-11 rounded-xl",
    lg: "w-12 h-12 sm:w-14 sm:h-14 rounded-2xl",
    xl: "w-14 h-14 sm:w-16 sm:h-16 rounded-2xl",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5 sm:w-5.5 sm:h-5.5",
    lg: "w-6 h-6 sm:w-7 sm:h-7",
    xl: "w-7 h-7 sm:w-8 sm:h-8",
  };

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 border select-none transition-transform duration-150 shadow-[4px_4px_10px_rgba(0,0,0,0.55),-2px_-2px_6px_rgba(255,255,255,0.025)] ${
        sizeClasses[size] || sizeClasses.md
      } ${config.bg} ${config.border} ${config.text} ${className}`}
      aria-hidden="true"
    >
      <Icon className={iconSizes[size] || iconSizes.md} strokeWidth={2} />
    </div>
  );
};
