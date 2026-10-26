import React from "react";
import {
  Home,
  Grid,
  Search,
  Layers,
  User,
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
      id: "dashboard",
      label: "Home",
      icon: Home,
      isActive: activeView === "dashboard" || activeView === "landing" || activeView === "timeline",
    },
    {
      id: "gallery",
      label: "Gallery",
      icon: Grid,
      isActive: activeView === "gallery" || activeView === "favorites" || activeView === "trash",
    },
    {
      id: "search",
      label: "Search",
      icon: Search,
      isActive: activeView === "search" || activeView === "history",
    },
    {
      id: "collections",
      label: "Collections",
      icon: Layers,
      isActive: activeView === "collections",
    },
    {
      id: "settings",
      label: "Profile",
      icon: User,
      isActive: activeView === "settings" || activeView === "pricing" || activeView === "notifications" || activeView === "feedback",
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 block lg:hidden select-none">
      <div className="px-2 py-1.5 border-t flex items-center justify-around bg-[#141B19]/95 backdrop-blur-md border-[#273548] text-[#F1F5F9]">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;
          return (
            <button
              key={item.id}
              id={`bottom-nav-${item.id}`}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 min-h-[48px] relative transition-all cursor-pointer ${
                active ? "text-[#D1E8E2] font-semibold" : "text-[#94A3B8] hover:text-[#F1F5F9]"
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform ${active ? "scale-110 drop-shadow-[0_0_8px_rgba(17,100,102,0.7)] text-[#D1E8E2]" : ""}`} />
              <span className="text-[10px] tracking-tight mt-1 font-medium">
                {item.label}
              </span>
              {active && (
                <span className="absolute bottom-0.5 w-1.5 h-1.5 rounded-full bg-[#116466] shadow-[0_0_6px_rgba(17,100,102,0.8)]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
