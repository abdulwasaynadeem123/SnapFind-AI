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
  Sparkles,
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
    bg: "bg-[#116466]/15",
    border: "border-[#116466]/40",
    text: "text-[#D1E8E2]",
  },
  gallery: {
    icon: ImageIcon,
    bg: "bg-blue-500/15",
    border: "border-blue-500/30",
    text: "text-blue-300",
  },
  search: {
    icon: Search,
    bg: "bg-cyan-500/15",
    border: "border-cyan-500/30",
    text: "text-cyan-300",
  },
  collections: {
    icon: FolderKanban,
    bg: "bg-indigo-500/15",
    border: "border-indigo-500/30",
    text: "text-indigo-300",
  },
  favorites: {
    icon: Heart,
    bg: "bg-rose-500/15",
    border: "border-rose-500/30",
    text: "text-rose-300",
  },
  trash: {
    icon: Trash2,
    bg: "bg-red-500/15",
    border: "border-red-500/30",
    text: "text-red-300",
  },
  import: {
    icon: Upload,
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/30",
    text: "text-emerald-300",
  },
  snapdash: {
    icon: Layers,
    bg: "bg-purple-500/15",
    border: "border-purple-500/30",
    text: "text-purple-300",
  },
  pricing: {
    icon: Sparkles,
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    text: "text-amber-300",
  },
  notifications: {
    icon: Bell,
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    text: "text-amber-300",
  },
  settings: {
    icon: Settings,
    bg: "bg-slate-700/30",
    border: "border-slate-600/40",
    text: "text-slate-300",
  },
  account: {
    icon: User,
    bg: "bg-blue-600/15",
    border: "border-blue-500/30",
    text: "text-blue-300",
  },
  feedback: {
    icon: MessageSquare,
    bg: "bg-[#116466]/20",
    border: "border-[#116466]/40",
    text: "text-[#D1E8E2]",
  },
  founder: {
    icon: Crown,
    bg: "bg-amber-500/20",
    border: "border-amber-400/40",
    text: "text-amber-300",
  },
  timeline: {
    icon: Clock,
    bg: "bg-teal-500/15",
    border: "border-teal-500/30",
    text: "text-teal-300",
  },
  demo: {
    icon: Play,
    bg: "bg-[#116466]/20",
    border: "border-[#116466]/40",
    text: "text-[#D1E8E2]",
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
      className={`inline-flex items-center justify-center shrink-0 border select-none transition-transform duration-150 ${
        sizeClasses[size] || sizeClasses.md
      } ${config.bg} ${config.border} ${config.text} ${className}`}
      aria-hidden="true"
    >
      <Icon className={iconSizes[size] || iconSizes.md} strokeWidth={2} />
    </div>
  );
};
