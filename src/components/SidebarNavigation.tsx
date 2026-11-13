import React, { useState } from "react";
import { SnapFindLogo } from "./SnapFindLogo";
import {
  LayoutDashboard,
  Image as ImageIcon,
  Search,
  Layers,
  Heart,
  Settings,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  X,
  ShieldCheck,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { NavViewType } from "./BottomNavigation";
import { useAuth } from "../context/AuthContext";

interface SidebarProps {
  activeView: NavViewType;
  setActiveView: (view: NavViewType) => void;
  isDark: boolean;
  indexedCount: number;
  favoriteCount: number;
  trashCount?: number;
  unreadNotificationCount?: number;
  onOpenUpgradeModal?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const SidebarNavigation: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  indexedCount,
  favoriteCount,
  trashCount = 0,
  unreadNotificationCount = 0,
  onOpenUpgradeModal,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { isPro, user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("snapfind_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("snapfind_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const handleUpgradeClick = () => {
    if (onOpenUpgradeModal) {
      onOpenUpgradeModal();
    } else {
      window.dispatchEvent(
        new CustomEvent("snapfind_open_pro_modal", {
          detail: { feature: "SnapFind Pro Unlimited Screenshots & AI Vision" },
        })
      );
    }
    if (onCloseMobile) onCloseMobile();
  };

  const handleNavClick = (view: NavViewType) => {
    setActiveView(view);
    if (onCloseMobile) onCloseMobile();
  };

  const isAdmin =
    user?.email?.toLowerCase().trim() === "ash.mary.2006@gmail.com" ||
    user?.role === "admin" ||
    (user as any)?.user_metadata?.role === "admin" ||
    (user as any)?.app_metadata?.role === "admin";

  // Dedicated page navigation items:
  // Home, Search, Gallery, Collections, Favorites, Recently Deleted, Settings (+ Admin if admin)
  const navItems = [
    {
      id: "landing" as NavViewType,
      label: "Home",
      icon: LayoutDashboard,
      isActive: activeView === "landing",
    },
    {
      id: "search" as NavViewType,
      label: "Search",
      icon: Search,
      isActive: activeView === "search" || activeView === "history",
    },
    {
      id: "gallery" as NavViewType,
      label: "Gallery",
      icon: ImageIcon,
      count: indexedCount,
      isActive: activeView === "gallery" || activeView === "dashboard" || activeView === "timeline",
    },
    {
      id: "collections" as NavViewType,
      label: "Collections",
      icon: Layers,
      isActive: activeView === "collections",
    },
    {
      id: "favorites" as NavViewType,
      label: "Favorites",
      icon: Heart,
      count: favoriteCount,
      isActive: activeView === "favorites",
    },
    {
      id: "trash" as NavViewType,
      label: "Recently Deleted",
      icon: Trash2,
      count: trashCount,
      isActive: activeView === "trash",
    },
    {
      id: "settings" as NavViewType,
      label: "Settings",
      icon: Settings,
      isActive:
        activeView === "settings" ||
        activeView === "account" ||
        activeView === "notifications" ||
        activeView === "pricing" ||
        activeView === "feedback",
    },
    ...(isAdmin
      ? [
          {
            id: "admin-payments" as NavViewType,
            label: "Admin",
            icon: ShieldCheck,
            isActive: activeView === "admin-payments",
          },
        ]
      : []),
  ];

  // Render a navigation button with claymorphic dark palette aesthetic
  const renderNavButton = (
    item: {
      id: NavViewType;
      label: string;
      icon: any;
      count?: number;
      isActive: boolean;
    },
    collapsedMode: boolean
  ) => {
    const Icon = item.icon;
    const active = item.isActive;

    return (
      <button
        key={item.id}
        id={`sidebar-nav-${item.id}`}
        type="button"
        title={collapsedMode ? item.label : undefined}
        onClick={() => handleNavClick(item.id)}
        className={`group relative flex items-center min-h-[44px] ${
          collapsedMode ? "justify-center px-0 py-2.5" : "justify-between px-3 py-2.5"
        } w-full rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
          active
            ? "bg-[#1B1F1A] text-[#F7F8F5] font-semibold border border-[#30362E] shadow-[4px_4px_12px_rgba(0,0,0,0.6),-2px_-2px_6px_rgba(255,255,255,0.02)]"
            : "text-[#A5AAA1] hover:text-[#F7F8F5] hover:bg-[#141714] border border-transparent"
        }`}
      >
        <div className={`flex items-center ${collapsedMode ? "justify-center" : "gap-3"} min-w-0`}>
          <Icon
            className={`w-4 h-4 shrink-0 transition-colors ${
              active
                ? "text-[#B7F36B]"
                : "text-[#A5AAA1] group-hover:text-[#F7F8F5]"
            }`}
          />
          {!collapsedMode && <span className="truncate tracking-tight">{item.label}</span>}
        </div>

        {/* Count badge for expanded mode */}
        {!collapsedMode && item.count !== undefined && item.count > 0 && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[#0D0F0D] border border-[#30362E] text-[#A5AAA1]">
            {item.count}
          </span>
        )}

        {/* Green indicator for collapsed mode */}
        {collapsedMode && item.count !== undefined && item.count > 0 && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#B7F36B]" />
        )}

        {/* Lime-green left active bar indicator */}
        {active && (
          <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-[#B7F36B]" />
        )}
      </button>
    );
  };

  return (
    <>
      {/* DESKTOP COLLAPSIBLE SIDEBAR */}
      <aside
        id="desktop-sidebar"
        className={`shrink-0 hidden lg:flex flex-col border-r h-screen overflow-hidden p-3 transition-[width] duration-200 select-none z-30 ${
          isCollapsed ? "w-16" : "w-60"
        } bg-[#0D0F0D] border-[#30362E] text-[#F7F8F5]`}
      >
        {/* Top Header / Logo & Collapse Toggle */}
        <div className="shrink-0 space-y-2 pb-2">
          <div
            className={`flex items-center ${
              isCollapsed ? "justify-center" : "justify-between"
            } px-1 pb-2 border-b border-[#30362E]`}
          >
            {!isCollapsed && (
              <button
                type="button"
                onClick={() => handleNavClick("landing")}
                className="flex items-center gap-2 group cursor-pointer text-left min-h-[44px]"
              >
                <div className="relative">
                  <SnapFindLogo className="w-7 h-7 rounded-xl object-contain border border-[#30362E] bg-[#141714]" />
                </div>
                <div className="flex items-center">
                  <span className="font-extrabold text-sm tracking-tight text-[#F7F8F5]">
                    SnapFind
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E] ml-1.5">
                    AI
                  </span>
                </div>
              </button>
            )}

            <button
              id="sidebar-toggle-collapse"
              type="button"
              onClick={toggleCollapse}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="p-2 rounded-lg text-[#A5AAA1] hover:text-[#F7F8F5] hover:bg-[#1B1F1A] transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              {isCollapsed ? (
                <PanelLeft className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Middle Navigation Menu */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 py-2 space-y-1 pr-0.5">
          {navItems.map((item) => renderNavButton(item, isCollapsed))}
        </div>
      </aside>

      {/* MOBILE SLIDE-OVER NAVIGATION DRAWER */}
      <AnimatePresence>
        {isMobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onCloseMobile}
              className="fixed inset-0 bg-black/85"
            />

            {/* Slide-over Content */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-72 max-w-[85vw] h-full flex flex-col justify-between p-4 shadow-2xl overflow-y-auto select-none bg-[#0D0F0D] text-[#F7F8F5] border-r border-[#30362E]"
            >
              <div className="space-y-5">
                {/* Header with Logo & Close Button */}
                <div className="flex items-center justify-between pb-3 border-b border-[#30362E]">
                  <div className="flex items-center gap-2.5">
                    <SnapFindLogo className="w-7 h-7 rounded-xl object-contain border border-[#30362E] bg-[#141714]" />
                    <span className="font-bold text-base tracking-tight text-[#F7F8F5]">
                      SnapFind
                    </span>
                  </div>

                  <button
                    id="mobile-drawer-close-btn"
                    type="button"
                    onClick={onCloseMobile}
                    className="p-1.5 rounded-xl text-[#A5AAA1] hover:text-[#F7F8F5] hover:bg-[#1B1F1A] transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Navigation Items */}
                <div className="space-y-1">
                  {navItems.map((item) => renderNavButton(item, false))}
                </div>
              </div>

              {/* User summary at bottom of drawer */}
              {user && (
                <div className="pt-4 mt-6 border-t border-[#30362E] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-6 h-6 rounded-full bg-[#141714] border border-[#30362E] text-[#B7F36B] flex items-center justify-center font-bold text-[10px]">
                      {user.name ? user.name[0].toUpperCase() : "U"}
                    </div>
                    <span className="truncate text-[#A5AAA1]">{user.name || "User"}</span>
                  </div>
                  {isPro && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#B7F36B] text-[#10130D]">
                      PRO
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SidebarNavigation;
