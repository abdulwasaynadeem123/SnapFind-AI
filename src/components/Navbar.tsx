import React, { useEffect, useState, useRef } from "react";
import {
  UploadCloud,
  User,
  Bell,
  RefreshCw,
  AlertTriangle,
  Menu,
  Search,
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
    <header className="sticky top-0 z-40 border-b select-none bg-[#0D0F0D] border-[#30362E] text-[#F7F8F5]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
        {/* Left: Hamburger (Mobile) + Brand Logo */}
        <div className="flex items-center gap-2 shrink-0">
          {onToggleMobileMenu && (
            <button
              id="mobile-nav-toggle-btn"
              type="button"
              onClick={onToggleMobileMenu}
              title="Open Navigation Menu"
              className="lg:hidden p-2 rounded-xl text-[#A5AAA1] hover:text-[#F7F8F5] hover:bg-[#141714] transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div
            onClick={() => setActiveView("landing")}
            className="flex items-center gap-2 cursor-pointer group shrink-0"
          >
            <div className="relative">
              <SnapFindLogo className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl object-contain border border-[#30362E] bg-[#141714] transition-colors group-hover:border-[#B7F36B]" />
            </div>
            <div className="hidden sm:flex items-center gap-1">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-[#F7F8F5]">
                SnapFind
              </span>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-[#141714] text-[#B7F36B] border border-[#30362E] ml-1">
                AI
              </span>
            </div>
          </div>
        </div>

        {/* Center: Recessed Claymorphic AI Search Bar */}
        <div className="flex-1 max-w-xl mx-2 sm:mx-4">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <div
              className={`relative flex items-center rounded-xl border transition-all duration-200 ${
                isSearchFocused
                  ? "bg-[#080908] border-[#B7F36B] shadow-[inset_3px_3px_8px_rgba(0,0,0,0.7),0_0_0_1px_rgba(183,243,107,0.3)]"
                  : "bg-[#080908] border-[#30362E] hover:border-[#3A4038] shadow-[inset_3px_3px_6px_rgba(0,0,0,0.65),inset_-2px_-2px_4px_rgba(255,255,255,0.02)]"
              }`}
            >
              <div className="pl-3 text-[#A5AAA1] flex items-center pointer-events-none">
                <Search className={`w-4 h-4 transition-colors ${isSearchFocused ? "text-[#B7F36B]" : "text-[#A5AAA1]"}`} />
              </div>

              <input
                ref={searchInputRef}
                type="text"
                value={currentSearchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                placeholder="Search screenshots: passport, receipt, ticket..."
                className="w-full pl-2.5 pr-20 py-1.5 sm:py-2 text-xs sm:text-sm bg-transparent text-[#F7F8F5] placeholder-[#777E74] focus:outline-none"
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
                    className="p-1 rounded-md text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {onOpenFilters && (
                  <button
                    type="button"
                    onClick={onOpenFilters}
                    title="Filters"
                    className="hidden sm:flex items-center p-1 rounded-md text-[#A5AAA1] hover:text-[#F7F8F5] hover:bg-[#1B1F1A] transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                )}

                <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-[#30362E] bg-[#141714] text-[10px] font-mono text-[#A5AAA1] select-none">
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
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono text-[#F7F8F5] bg-[#141714] border border-[#30362E]">
              <RefreshCw className="w-3 h-3 animate-spin text-[#B7F36B]" />
              <span>SYNCING</span>
            </div>
          )}
          {syncState.lastError && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono text-[#A5AAA1] bg-[#141714] border border-[#30362E]">
              <AlertTriangle className="w-3 h-3 text-[#A5AAA1]" />
              <span>OFFLINE</span>
            </div>
          )}

          {/* Import screenshots button - Lime Green Primary Button */}
          <button
            onClick={onOpenImport}
            id="import-btn-header"
            type="button"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] active:scale-98 text-[#10130D] text-xs font-bold transition-all cursor-pointer shadow-[3px_3px_8px_rgba(0,0,0,0.45),-1px_-1px_3px_rgba(255,255,255,0.05)] border border-[#B7F36B]"
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
            className="relative p-2 rounded-xl text-[#A5AAA1] hover:text-[#F7F8F5] hover:bg-[#141714] border border-transparent hover:border-[#30362E] transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#B7F36B]" />
            )}
          </button>

          {/* User Profile / Auth */}
          <button
            onClick={onOpenAuth}
            id="user-profile-btn"
            type="button"
            title={user.isLoggedIn ? user.name : "Sign In"}
            className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-xl border border-[#30362E] hover:border-[#B7F36B] bg-[#141714] hover:bg-[#1B1F1A] shadow-[4px_4px_10px_rgba(0,0,0,0.5),-2px_-2px_6px_rgba(255,255,255,0.02)] transition-all cursor-pointer text-xs font-medium text-[#F7F8F5]"
          >
            {user.avatarUrl && user.isLoggedIn && !avatarError ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-5 h-5 rounded-lg object-cover shrink-0 ring-1 ring-[#30362E]"
              />
            ) : (
              <div className="w-5 h-5 rounded-lg bg-[#0D0F0D] border border-[#30362E] flex items-center justify-center text-[#A5AAA1]">
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
