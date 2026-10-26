import React, { useEffect, useState, useRef } from "react";
import {
  UploadCloud,
  User,
  Bell,
  RefreshCw,
  AlertTriangle,
  Menu,
  Search,
  Sparkles,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { SnapFindLogo } from "./SnapFindLogo";
import { UserProfile, AppSettings } from "../types";
import { NavViewType } from "./BottomNavigation";
import { SyncEngine, SyncState } from "../services/syncEngine";
import { ProBadge, FounderBadge } from "./subscription/UpgradePrompt";

interface NavbarProps {
  user: UserProfile;
  settings: AppSettings;
  onToggleTheme?: () => void;
  onOpenImport: () => void;
  onOpenAuth: () => void;
  totalIndexedCount: number;
  currentSearchQuery: string;
  onSearchChange: (val: string) => void;
  onExecuteSearch?: (val: string) => void;
  activeView: NavViewType;
  setActiveView: (view: NavViewType) => void;
  unreadNotificationCount?: number;
  onOpenNotifications?: () => void;
  onToggleMobileMenu?: () => void;
  onOpenFilters?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onOpenImport,
  onOpenAuth,
  currentSearchQuery,
  onSearchChange,
  onExecuteSearch,
  activeView,
  setActiveView,
  unreadNotificationCount = 0,
  onOpenNotifications,
  onToggleMobileMenu,
  onOpenFilters,
}) => {
  const [avatarError, setAvatarError] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(() => SyncEngine.getState());
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarError(false);
  }, [user.avatarUrl]);

  useEffect(() => {
    const unsubscribe = SyncEngine.subscribe((state) => {
      setSyncState(state);
    });
    return unsubscribe;
  }, []);

  // Global Keyboard Shortcut: ⌘K or Ctrl+K to focus search bar
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onExecuteSearch) {
      onExecuteSearch(currentSearchQuery);
    }
    if (activeView !== "search" && activeView !== "gallery") {
      setActiveView("search");
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b select-none bg-[#141B19]/95 backdrop-blur-md border-[#273548] text-[#F1F5F9]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
        {/* Left: Hamburger (Mobile) + Brand Logo */}
        <div className="flex items-center gap-2 shrink-0">
          {onToggleMobileMenu && (
            <button
              id="mobile-nav-toggle-btn"
              type="button"
              onClick={onToggleMobileMenu}
              title="Open Navigation Menu"
              className="lg:hidden p-2 rounded-xl text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#16202C] transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div
            onClick={() => setActiveView("dashboard")}
            className="flex items-center gap-2 cursor-pointer group shrink-0"
          >
            <div className="relative">
              <SnapFindLogo className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl object-contain border border-[#273548] bg-[#16202C] transition-colors group-hover:border-[#116466]" />
            </div>
            <div className="hidden sm:flex items-center gap-1">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-[#F1F5F9]">
                SnapFind
              </span>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-[#1E293B] text-[#D1E8E2] border border-[#334155] ml-1">
                AI
              </span>
            </div>
          </div>
        </div>

        {/* Center: Prominent Futuristic AI Search Bar */}
        <div className="flex-1 max-w-xl mx-2 sm:mx-4">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <div
              className={`relative flex items-center rounded-xl border transition-all duration-200 ${
                isSearchFocused
                  ? "bg-[#1E293B] border-[#116466] ring-1 ring-[#116466]/60 shadow-[0_0_16px_rgba(17,100,102,0.3)]"
                  : "bg-[#1E293B]/90 border-[#334155] hover:border-[#475569] hover:bg-[#1E293B]"
              }`}
            >
              <div className="pl-3 text-[#94A3B8] flex items-center pointer-events-none">
                {isSearchFocused ? (
                  <Sparkles className="w-4 h-4 text-[#D1E8E2] animate-pulse" />
                ) : (
                  <Search className="w-4 h-4 text-[#94A3B8]" />
                )}
              </div>

              <input
                ref={searchInputRef}
                type="text"
                value={currentSearchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                placeholder="Ask AI or search: passport, flight, receipt, code..."
                className="w-full pl-2.5 pr-20 py-1.5 sm:py-2 text-xs sm:text-sm bg-transparent text-[#F1F5F9] placeholder-[#94A3B8]/60 focus:outline-none"
              />

              {/* Right tools inside search input */}
              <div className="pr-2 flex items-center gap-1.5 shrink-0">
                {currentSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      onSearchChange("");
                      if (onExecuteSearch) onExecuteSearch("");
                    }}
                    className="p-1 rounded-md text-[#94A3B8] hover:text-[#F1F5F9] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {onOpenFilters && (
                  <button
                    type="button"
                    onClick={onOpenFilters}
                    title="Filters"
                    className="hidden sm:flex items-center p-1 rounded-md text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#243347] transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                )}

                <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-[#334155] bg-[#2C3531] text-[10px] font-mono text-[#94A3B8] select-none">
                  ⌘K
                </kbd>
              </div>
            </div>
          </form>
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Sync indicator */}
          {syncState.isSyncing && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono text-[#D1E8E2] bg-[#1E293B] border border-[#334155]">
              <RefreshCw className="w-3 h-3 animate-spin text-[#D1E8E2]" />
              <span>SYNCING</span>
            </div>
          )}
          {syncState.lastError && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono text-[#D9B08C] bg-[#1E293B] border border-[#334155]">
              <AlertTriangle className="w-3 h-3 text-[#D9B08C]" />
              <span>OFFLINE</span>
            </div>
          )}

          {/* Import screenshots button */}
          <button
            onClick={onOpenImport}
            id="import-btn-header"
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#116466] hover:bg-[#157F81] active:scale-98 text-[#F1F5F9] text-xs font-bold transition-all cursor-pointer shadow-[0_0_14px_rgba(17,100,102,0.3)] border border-[#116466]"
          >
            <UploadCloud className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Import</span>
          </button>

          {/* Notifications */}
          <button
            onClick={onOpenNotifications}
            id="notification-center-btn"
            type="button"
            title="Notifications"
            className="relative p-2 rounded-xl text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1E293B] border border-transparent hover:border-[#334155] transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#D9B08C] ring-2 ring-[#2C3531]" />
            )}
          </button>

          {/* User Profile / Auth */}
          <button
            onClick={onOpenAuth}
            id="user-profile-btn"
            type="button"
            title={user.isLoggedIn ? user.name : "Sign In"}
            className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-xl border border-[#334155] hover:border-[#116466] bg-[#1E293B] hover:bg-[#243347] transition-all cursor-pointer text-xs font-medium text-[#F1F5F9]"
          >
            {user.avatarUrl && user.isLoggedIn && !avatarError ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-5 h-5 rounded-lg object-cover shrink-0 ring-1 ring-[#334155]"
              />
            ) : (
              <div className="w-5 h-5 rounded-lg bg-[#2C3531] border border-[#334155] flex items-center justify-center text-[#94A3B8]">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
            <span className="hidden sm:inline truncate max-w-[90px] font-semibold">
              {user.isLoggedIn ? user.name : "Sign In"}
            </span>
            {user.entitlement?.isFounder ? (
              <FounderBadge founderNumber={user.entitlement.founderNumber} size="xs" />
            ) : user.entitlement?.plan === "pro" ? (
              <ProBadge size="xs" />
            ) : null}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
