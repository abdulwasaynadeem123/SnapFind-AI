import React, { useState } from "react";
import { SnapFindLogo } from "./SnapFindLogo";
import {
  LayoutDashboard,
  Image as ImageIcon,
  Search,
  Layers,
  Heart,
  UploadCloud,
  CreditCard,
  Crown,
  Sparkles,
  Bell,
  Settings,
  User,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  X,
  ShieldCheck,
  Gamepad2,
  MessageSquarePlus,
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

  // Top primary navigation items matching exact prompt requirements:
  // Logo, Dashboard, All Screenshots, Smart Snaps, Collections, Favorites, Trash, Settings
  const primaryNavItems = [
    {
      id: "dashboard" as NavViewType,
      label: "Dashboard",
      icon: LayoutDashboard,
      isActive: activeView === "dashboard" || activeView === "landing" || activeView === "timeline",
    },
    {
      id: "gallery" as NavViewType,
      label: "All Screenshots",
      icon: ImageIcon,
      count: indexedCount,
      isActive: activeView === "gallery",
    },
    {
      id: "search" as NavViewType,
      label: "Smart Snaps",
      icon: Sparkles,
      isActive: activeView === "search" || activeView === "history",
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
      label: "Trash",
      icon: Trash2,
      count: trashCount,
      isActive: activeView === "trash",
    },
    {
      id: "settings" as NavViewType,
      label: "Settings",
      icon: Settings,
      isActive: activeView === "settings",
    },
  ];

  // Secondary tools (Import, Demo, Game)
  const secondaryNavItems = [
    {
      id: "import" as NavViewType,
      label: "Import Vault",
      icon: UploadCloud,
      isActive: activeView === "import",
    },
    {
      id: "demo" as NavViewType,
      label: "Interactive Demo",
      icon: Search,
      isActive: activeView === "demo",
    },
    {
      id: "game" as NavViewType,
      label: "SnapDash Game",
      icon: Gamepad2,
      isActive: activeView === "game",
    },
  ];

  // Business items (Plans & Pricing)
  const businessItems = [
    {
      id: "pricing" as NavViewType,
      label: "Plans & Pricing",
      icon: CreditCard,
      isActive: activeView === "pricing" || activeView === "founders",
    },
  ];

  const isAdmin =
    user?.email?.toLowerCase().trim() === "ash.mary.2006@gmail.com" ||
    user?.role === "admin" ||
    (user as any)?.user_metadata?.role === "admin" ||
    (user as any)?.app_metadata?.role === "admin";

  // Bottom items (Account, Notifications, Admin, Feedback)
  const bottomItems = [
    ...(isAdmin
      ? [
          {
            id: "admin-payments" as NavViewType,
            label: "Admin Console",
            icon: ShieldCheck,
            isActive: activeView === "admin-payments",
          },
        ]
      : []),
    {
      id: "feedback" as NavViewType,
      label: "Give Feedback",
      icon: MessageSquarePlus,
      isActive: activeView === "feedback",
    },
    {
      id: "notifications" as NavViewType,
      label: "Notifications",
      icon: Bell,
      count: unreadNotificationCount,
      isActive: activeView === "notifications",
    },
    {
      id: "account" as NavViewType,
      label: "Account Profile",
      icon: User,
      isActive: activeView === "account",
    },
  ];

  // Render a navigation button with high-contrast palette aesthetic
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
        className={`group relative flex items-center ${
          collapsedMode ? "justify-center px-0 py-2.5" : "justify-between px-3 py-2.5"
        } w-full rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
          active
            ? "bg-[#1E293B] text-[#D1E8E2] font-semibold border border-[#116466] shadow-[0_0_14px_rgba(17,100,102,0.25)]"
            : "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1E293B]/70 hover:border-[#334155] border border-transparent"
        }`}
      >
        <div className={`flex items-center ${collapsedMode ? "justify-center" : "gap-3"} min-w-0`}>
          <Icon
            className={`w-4 h-4 shrink-0 transition-all ${
              active
                ? "text-[#D1E8E2] drop-shadow-[0_0_6px_rgba(17,100,102,0.6)]"
                : "text-[#94A3B8] group-hover:text-[#F1F5F9]"
            }`}
          />
          {!collapsedMode && <span className="truncate tracking-tight">{item.label}</span>}
        </div>

        {/* Count badge for expanded mode */}
        {!collapsedMode && item.count !== undefined && item.count > 0 && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[#141B19] border border-[#273548] text-[#D1E8E2]">
            {item.count}
          </span>
        )}

        {/* Dot indicator for collapsed mode */}
        {collapsedMode && item.count !== undefined && item.count > 0 && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#116466] shadow-[0_0_6px_rgba(17,100,102,0.8)]" />
        )}

        {/* Cyber Teal left active bar */}
        {active && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-[#116466] shadow-[0_0_8px_rgba(17,100,102,0.8)]" />
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
        } bg-[#141B19]/95 backdrop-blur-md border-[#273548] text-[#F1F5F9]`}
      >
        {/* Top Header / Logo & Collapse Toggle */}
        <div className="shrink-0 space-y-2 pb-2">
          <div
            className={`flex items-center ${
              isCollapsed ? "justify-center" : "justify-between"
            } px-1 pb-2 border-b border-[#273548]`}
          >
            {!isCollapsed && (
              <button
                type="button"
                onClick={() => handleNavClick("dashboard")}
                className="flex items-center gap-2 group cursor-pointer text-left"
              >
                <div className="relative">
                  <SnapFindLogo className="w-7 h-7 rounded-lg object-contain border border-[#334155] bg-[#1E293B]" />
                </div>
                <div className="flex items-center">
                  <span className="font-extrabold text-sm tracking-tight text-[#F1F5F9]">
                    SnapFind
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-[#1E293B] text-[#D1E8E2] border border-[#334155] ml-1.5">
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
              className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1E293B] transition-colors cursor-pointer"
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
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 py-1 space-y-4 pr-0.5">
          {/* Top Primary Navigation Group */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 pb-1 text-[10px] font-mono font-semibold tracking-wider uppercase text-[#94A3B8]/70">
                Dashboard &amp; Vault
              </div>
            )}
            {primaryNavItems.map((item) => renderNavButton(item, isCollapsed))}
          </div>

          {/* Secondary Tools Section */}
          <div className="pt-2 border-t border-[#334155]/80">
            {!isCollapsed && (
              <div className="px-3 pb-1 text-[10px] font-mono font-semibold tracking-wider uppercase text-[#94A3B8]/70">
                Tools &amp; Simulation
              </div>
            )}
            <div className="space-y-1">
              {secondaryNavItems.map((item) => renderNavButton(item, isCollapsed))}
            </div>
          </div>

          {/* Business Section (Plans & Pricing) */}
          <div className="pt-2 border-t border-[#334155]/80">
            {!isCollapsed && (
              <div className="px-3 pb-1 text-[10px] font-mono font-semibold tracking-wider uppercase text-[#94A3B8]/70">
                Plans &amp; Upgrades
              </div>
            )}

            <div className="space-y-1">
              {businessItems.map((item) => renderNavButton(item, isCollapsed))}
            </div>
          </div>
        </div>

        {/* Bottom Navigation Section */}
        <div className="shrink-0 pt-2 border-t border-[#334155]">
          {!isCollapsed && (
            <div className="px-3 pb-1 text-[10px] font-mono font-semibold tracking-wider uppercase text-[#94A3B8]/70">
              Workspace
            </div>
          )}
          <div className="space-y-1">
            {bottomItems.map((item) => renderNavButton(item, isCollapsed))}
          </div>
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
              className="fixed inset-0 bg-black/80 backdrop-blur-xs"
            />

            {/* Slide-over Content */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="relative w-72 max-w-[85vw] h-full flex flex-col justify-between p-4 shadow-2xl overflow-y-auto select-none bg-[#141B19] text-[#F1F5F9] border-r border-[#273548]"
            >
              <div className="space-y-5">
                {/* Header with Logo & Close Button */}
                <div className="flex items-center justify-between pb-3 border-b border-[#273548]">
                  <div className="flex items-center gap-2.5">
                    <SnapFindLogo className="w-7 h-7 rounded-xl object-contain border border-[#273548] bg-[#16202C]" />
                    <span className="font-bold text-base tracking-tight text-[#F1F5F9]">
                      SnapFind
                    </span>
                  </div>

                  <button
                    id="mobile-drawer-close-btn"
                    type="button"
                    onClick={onCloseMobile}
                    className="p-1.5 rounded-xl text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1E293B] transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Primary Navigation */}
                <div className="space-y-1">
                  <div className="px-3 pb-1 text-[10px] font-mono font-semibold tracking-wider uppercase text-[#94A3B8]/70">
                    Dashboard &amp; Vault
                  </div>
                  {primaryNavItems.map((item) => renderNavButton(item, false))}
                </div>

                {/* Tools Section */}
                <div className="pt-2 border-t border-[#334155] space-y-1">
                  <div className="px-3 pb-1 text-[10px] font-mono font-semibold tracking-wider uppercase text-[#94A3B8]/70">
                    Tools &amp; Simulation
                  </div>
                  {secondaryNavItems.map((item) => renderNavButton(item, false))}
                </div>

                {/* Business Section */}
                <div className="pt-2 border-t border-[#334155] space-y-1">
                  <div className="px-3 pb-1 text-[10px] font-mono font-semibold tracking-wider uppercase text-[#94A3B8]/70">
                    Plans &amp; Pricing
                  </div>
                  {businessItems.map((item) => renderNavButton(item, false))}
                </div>

                {/* Bottom Navigation */}
                <div className="pt-2 border-t border-[#334155] space-y-1">
                  <div className="px-3 pb-1 text-[10px] font-mono font-semibold tracking-wider uppercase text-[#94A3B8]/70">
                    System &amp; Account
                  </div>
                  {bottomItems.map((item) => renderNavButton(item, false))}
                </div>
              </div>

              {/* User summary at bottom of drawer */}
              {user && (
                <div className="pt-4 mt-6 border-t border-[#334155] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-6 h-6 rounded-full bg-[#1E293B] border border-[#334155] text-[#D1E8E2] flex items-center justify-center font-bold text-[10px]">
                      {user.name ? user.name[0].toUpperCase() : "U"}
                    </div>
                    <span className="truncate text-[#94A3B8]">{user.name || "User"}</span>
                  </div>
                  {isPro && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#116466] text-[#F1F5F9] border border-[#116466]">
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
