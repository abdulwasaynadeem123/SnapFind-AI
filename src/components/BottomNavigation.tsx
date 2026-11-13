import React from "react";
import {
  Home,
  Grid,
  Search,
  Heart,
  Settings,
} from "lucide-react";
import { motion } from "motion/react";

export type NavViewType =
  | "landing"
  | "dashboard"
  | "collections"
  | "timeline"
  | "favorites"
  | "trash"
  | "gallery"
  | "search"
  | "import"
  | "history"
  | "settings"
  | "pricing"
  | "founders"
  | "account"
  | "notifications"
  | "feedback"
  | "feedback-success"
  | "demo"
  | "admin-payments"
  | "game"
  | "not-found";

interface BottomNavigationProps {
  activeView: NavViewType;
  setActiveView: (view: NavViewType) => void;
  isDark: boolean;
  indexedCount: number;
  favoriteCount?: number;
  trashCount?: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeView,
  setActiveView,
}) => {
  const mobileNavItems: {
    id: NavViewType;
    label: string;
    icon: any;
    isActive: boolean;
  }[] = [
    {
      id: "landing",
      label: "Home",
      icon: Home,
      isActive: activeView === "landing",
    },
    {
      id: "gallery",
      label: "Gallery",
      icon: Grid,
      isActive: activeView === "gallery" || activeView === "collections" || activeView === "dashboard" || activeView === "timeline",
    },
    {
      id: "search",
      label: "Search",
      icon: Search,
      isActive: activeView === "search" || activeView === "history",
    },
    {
      id: "favorites",
      label: "Favorites",
      icon: Heart,
      isActive: activeView === "favorites",
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      isActive: activeView === "settings" || activeView === "pricing" || activeView === "notifications" || activeView === "account" || activeView === "feedback",
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 block lg:hidden select-none">
      <div className="px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),8px)] border-t flex items-center justify-around bg-[#0D0F0D] border-[#30362E] text-[#F7F8F5] shadow-[0_-4px_16px_rgba(0,0,0,0.6)]">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;
          return (
            <button
              key={item.id}
              id={`bottom-nav-${item.id}`}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 min-h-[48px] min-w-[44px] relative transition-colors cursor-pointer ${
                active ? "text-[#F7F8F5] font-semibold" : "text-[#A5AAA1] hover:text-[#F7F8F5]"
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform ${active ? "scale-105 text-[#B7F36B]" : ""}`} />
              <span className={`text-[10px] tracking-tight mt-1 font-medium ${active ? "text-[#B7F36B]" : "text-[#A5AAA1]"}`}>
                {item.label}
              </span>
              {active && (
                <span className="absolute bottom-0 w-1 h-1 rounded-full bg-[#B7F36B]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
