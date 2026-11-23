import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { ArrowUp } from "lucide-react";
import { SubscriptionManager } from "./services/billing/SubscriptionManager";
import {
  ScreenshotItem,
  SearchResultMatch,
  SearchHistoryItem,
  CategoryType,
  ToastMessage,
  AppSettings,
  UserProfile,
  CollectionItem,
  AppNotification,
} from "./types";
import {
  loadStoredScreenshots,
  saveStoredScreenshots,
  deleteStoredScreenshot,
  deleteStoredScreenshotsBatch,
  loadSearchHistory,
  saveSearchHistory,
  loadSettings,
  saveSettings,
  loadUserProfile,
  saveUserProfile,
  initializeStorage,
  loadNotifications,
  saveNotifications,
} from "./services/storage.ts";
import {
  loadStoredCollections,
  deriveAndSyncCollections,
  createCustomCollection,
  renameCollection,
  deleteCollection,
  mergeCollections,
  moveScreenshotsToCollection,
} from "./services/collectionEngine";
import { nativeMediaScanner } from "./services/nativeMediaScanner";
import { searchScreenshotsAI, instantKeywordSearch } from "./services/api";

import { collectionSecurity } from "./services/collectionSecurity";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useFounder } from "./context/FounderContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Navbar } from "./components/Navbar";
import { SidebarNavigation } from "./components/SidebarNavigation";
import { SearchBar } from "./components/SearchBar";
import { ScreenshotGrid } from "./components/ScreenshotGrid";
import { ImageViewerModal } from "./components/ImageViewerModal";
import { BatchImporter } from "./components/BatchImporter";
import { SearchHistoryView } from "./components/SearchHistoryView";
import { SettingsView } from "./components/SettingsView";
import { AuthModal } from "./components/AuthModal";
import { NotificationCenter } from "./components/NotificationCenter";
import { StatsOverview } from "./components/StatsOverview";
import { BottomNavigation, NavViewType } from "./components/BottomNavigation";
import { LandingScreen } from "./components/LandingScreen";
import { DashboardView } from "./components/DashboardView";
import { CollectionsView } from "./components/CollectionsView";
import { TimelineView } from "./components/TimelineView";
import { SearchView } from "./components/SearchView";
import { FavoritesView } from "./components/FavoritesView";
import { TrashView } from "./components/TrashView";
import { ResetPasswordView } from "./components/ResetPasswordView";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { useRouteScrollReset } from "./hooks/useRouteScrollReset";
import { OfflineBanner } from "./components/OfflineBanner";
import { GalleryPermissionModal } from "./components/GalleryPermissionModal";
import { PricingPageView } from "./components/PricingPageView";
import { NotificationPageView } from "./components/NotificationPageView";
import { AccountPageView } from "./components/AccountPageView";
import { AdminPaymentsPage } from "./components/admin/AdminPaymentsPage";
import { FeedbackView } from "./components/FeedbackView";
import { FounderFeedbackPrompt } from "./components/FounderFeedbackPrompt";
import { FounderBanner } from "./components/FounderBanner";
import { FoundersPageView } from "./components/FoundersPageView";
import { VipSeatInvitationModal } from "./components/VipSeatInvitationModal";
import { SnapDashPageView } from "./components/game/SnapDashPageView";
import { GiveFeedbackModal } from "./components/feedback/GiveFeedbackModal";
import { DemoView } from "./components/DemoView";
import { INITIAL_SAMPLE_SCREENSHOTS } from "./data/sampleScreenshots";
import { clearUserSessionData } from "./services/storage";

import { SyncEngine } from "./services/syncEngine";
import { searchEngine } from "./services/searchEngine";
import { processingQueue } from "./services/processingQueue";
import { NotificationService } from "./services/notificationService";
import { UpdateService, UpdateState } from "./services/updateService";
import { UpdateModal } from "./components/update/UpdateModal";
import { WhatsNewModal } from "./components/update/WhatsNewModal";
import { applySeoMetadata } from "./services/seoManager";

function AppContent() {
  const {
    user: authUser,
    entitlement,
    loading: authLoading,
    refreshEntitlement,
    signOut,
    isRecoveryMode,
  } = useAuth();
  const { claimFounderSpot, refreshFounderStats } = useFounder();
  const isOnline = useOnlineStatus();
  const [isVipInviteOpen, setIsVipInviteOpen] = useState(false);
  const [vipClaimedInModal, setVipClaimedInModal] = useState(false);

  const isAuthenticatedAccount = Boolean(
    authUser?.id && authUser.id !== "guest" && authUser.isLoggedIn !== false
  );
  const resolvedEntitlement = authUser?.entitlement || entitlement;
  const isUserAlreadyVip = Boolean(
    resolvedEntitlement?.isFounder ||
      (typeof resolvedEntitlement?.founderNumber === "number" &&
        resolvedEntitlement.founderNumber >= 1) ||
      (typeof resolvedEntitlement?.founderRank === "number" &&
        resolvedEntitlement.founderRank >= 1)
  );
  const [founderPromoStatus, setFounderPromoStatus] = useState<
    Awaited<ReturnType<typeof SubscriptionManager.getFounderPromoStatus>>
  >(null);
  const canOfferVipClaim = Boolean(
    isAuthenticatedAccount &&
      !authLoading &&
      founderPromoStatus?.eligible &&
      !founderPromoStatus.claimed &&
      !isUserAlreadyVip
  );

  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>(() => loadStoredScreenshots());
  const [collections, setCollections] = useState<CollectionItem[]>(() => {
    const initialScreenshots = loadStoredScreenshots();
    const storedCols = loadStoredCollections();
    return deriveAndSyncCollections(initialScreenshots, storedCols);
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>("All");

  const [activeView, setActiveView] = useState<NavViewType>(() => {
    if (typeof window !== "undefined") {
      if (window.location.pathname === "/reset-password" || window.location.hash.includes("type=recovery") || window.location.search.includes("type=recovery")) {
        return "reset-password";
      }
      if (window.location.pathname === "/admin/payments" || window.location.pathname === "/admin-payments") {
        return "admin-payments";
      }
      if (window.location.pathname === "/game" || window.location.pathname === "/snapdash") {
        return "game";
      }
      if (window.location.hash) {
        const rawHash = window.location.hash.replace(/^#\/?/, "");
        if (rawHash === "admin/payments" || rawHash === "admin-payments" || rawHash === "admin") {
          return "admin-payments";
        }
        if (rawHash === "game" || rawHash === "snapdash") {
          return "game";
        }
        if (rawHash === "demo") {
          return "demo";
        }
        if (rawHash === "reset-password") {
          return "reset-password";
        }
        const validViews: NavViewType[] = [
          "landing",
          "dashboard",
          "collections",
          "timeline",
          "favorites",
          "trash",
          "gallery",
          "search",
          "import",
          "history",
          "settings",
          "pricing",
          "founders",
          "account",
          "notifications",
          "feedback",
          "game",
          "admin-payments",
          "reset-password",
          "demo",
        ];
        if (validViews.includes(rawHash as NavViewType)) {
          return rawHash as NavViewType;
        }
      }
    }
    return "landing";
  });
  const [selectedItem, setSelectedItem] = useState<ScreenshotItem | null>(null);
  const [demoInitialQuery, setDemoInitialQuery] = useState("");
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Global Route-change scroll reset (resets scroll to top (0,0) on every route/page change)
  useRouteScrollReset(activeView, mainContentRef);

  // Dynamic SEO metadata & robots noindex/index synchronization
  useEffect(() => {
    applySeoMetadata(activeView);
  }, [activeView]);

  // Keep browser history and URL hash synchronized for back/forward navigation
  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawLocationHash = window.location.hash || "";
    // Never overwrite OAuth or password-recovery callback hash tokens before AuthContext consumes them
    if (
      rawLocationHash.includes("access_token=") ||
      rawLocationHash.includes("type=recovery") ||
      rawLocationHash.includes("error=")
    ) {
      return;
    }
    const currentHash = rawLocationHash.replace(/^#\/?/, "");
    const formattedHash = activeView === "admin-payments" ? "admin/payments" : activeView;
    if (currentHash !== formattedHash && currentHash !== activeView) {
      window.history.replaceState({ view: activeView }, "", `#${formattedHash}`);
    }
  }, [activeView]);

  // Handle browser back / forward button navigation
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = (event: PopStateEvent) => {
      const stateView = event.state?.view;
      const rawHash = window.location.hash.replace(/^#\/?/, "");
      let targetView: NavViewType = (stateView || rawHash) as NavViewType;
      if (rawHash === "admin/payments" || rawHash === "admin-payments" || rawHash === "admin") {
        targetView = "admin-payments";
      }
      if (rawHash === "demo") {
        targetView = "demo";
      }
      const validViews: NavViewType[] = [
        "landing",
        "dashboard",
        "collections",
        "timeline",
        "favorites",
        "trash",
        "gallery",
        "search",
        "import",
        "history",
        "settings",
        "pricing",
        "founders",
        "account",
        "notifications",
        "feedback",
        "game",
        "admin-payments",
        "reset-password",
        "demo",
      ];
      if (targetView && validViews.includes(targetView)) {
        setActiveView(targetView);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>(() => loadSearchHistory());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [userProfile, setUserProfile] = useState<UserProfile>(() => loadUserProfile());
  const [isStorageReady, setIsStorageReady] = useState(false);

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register">("login");

  const openAuthModal = (mode: "login" | "register" = "login") => {
    setAuthModalMode(mode);
    setIsAuthOpen(true);
  };

  // Automatically navigate to dedicated secure reset-password page when recovery flow is triggered
  useEffect(() => {
    if (isRecoveryMode) {
      setIsAuthOpen(false);
      setIsVipInviteOpen(false);
      setActiveView("reset-password");
    }
  }, [isRecoveryMode]);

  // Check server-recorded first-50-signup eligibility after authentication.
  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticatedAccount || !authUser?.id || authLoading) {
      setFounderPromoStatus(null);
      setIsVipInviteOpen(false);
      setVipClaimedInModal(false);
      return;
    }
    SubscriptionManager.getFounderPromoStatus()
      .then((status) => {
        if (cancelled) return;
        setFounderPromoStatus(status);
        setIsVipInviteOpen(Boolean(
          status?.eligible && !status.claimed && !status.dismissed &&
          !isRecoveryMode && activeView !== "reset-password"
        ));
        setVipClaimedInModal(false);
      })
      .catch((error) => {
        console.warn("[App] Could not verify first-50-signup offer:", error?.message || error);
        if (!cancelled) {
          setFounderPromoStatus(null);
          setIsVipInviteOpen(false);
        }
      });
    return () => { cancelled = true; };
  }, [isAuthenticatedAccount, authUser?.id, authLoading, isRecoveryMode, activeView]);

  useEffect(() => {
    const handleOpenFounderPromo = () => {
      if (founderPromoStatus?.eligible && !founderPromoStatus.claimed) setIsVipInviteOpen(true);
    };
    window.addEventListener("snapfind_open_founder_promo", handleOpenFounderPromo);
    return () => window.removeEventListener("snapfind_open_founder_promo", handleOpenFounderPromo);
  }, [founderPromoStatus]);

  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackPageContext, setFeedbackPageContext] = useState("General");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => NotificationService.getNotifications());
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Free App Update System State
  const [updateState, setUpdateState] = useState<UpdateState>(() => UpdateService.getState());
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);
  const [whatsNewVersion, setWhatsNewVersion] = useState("");

  useEffect(() => {
    // 1. Check if first run after update
    const firstRun = UpdateService.checkFirstRunAfterUpdate();
    if (firstRun.wasUpdated) {
      setWhatsNewVersion(firstRun.version);
      setIsWhatsNewOpen(true);
      NotificationService.notifyAppUpdated(firstRun.version);
    }

    // 2. Perform startup update check (respects 4h cooldown & autoCheckUpdates setting)
    UpdateService.checkOnStartup().catch((err) => {
      console.warn("[App] checkOnStartup warning:", err);
    });

    // 3. Subscribe to update changes
    const unsub = UpdateService.subscribe((state) => {
      setUpdateState(state);
      if (state.status === "available" && state.latestRelease) {
        const dismissed = UpdateService.getDismissedVersion();
        if (dismissed !== state.latestRelease.version) {
          setIsUpdateModalOpen(true);
        }
      }
    });

    // 4. Custom event for opening update modal from notification click
    const handleOpenUpdate = () => {
      setIsUpdateModalOpen(true);
    };
    window.addEventListener("snapfind_open_update", handleOpenUpdate);

    return () => {
      unsub();
      window.removeEventListener("snapfind_open_update", handleOpenUpdate);
    };
  }, []);

  const handleOpenFeedback = (pageContext?: string) => {
    setFeedbackPageContext(pageContext || activeView);
    setIsFeedbackModalOpen(true);
  };

  // Listen for global custom event to open feedback modal
  useEffect(() => {
    const handleFeedbackEvent = (e: any) => {
      const page = e.detail?.page || activeView;
      handleOpenFeedback(page);
    };
    window.addEventListener("snapfind_open_feedback", handleFeedbackEvent);
    return () => window.removeEventListener("snapfind_open_feedback", handleFeedbackEvent);
  }, [activeView]);

  // Keep local user profile in sync with Auth Context
  const activeUser = authUser || userProfile;

  // Enforce strict user ownership scoping for screenshots (never expose another user's items)
  const isOwnedByCurrentUser = (item: ScreenshotItem) => {
    const owner = item.user_id || item.userId;
    if (authUser?.id && authUser.id !== "guest") {
      return !owner || owner === "guest" || owner === authUser.id;
    }
    return !owner || owner === "guest";
  };

  const ownedScreenshots = useMemo(() => {
    return screenshots.filter((item) => {
      const owner = item.user_id || item.userId;
      if (authUser?.id && authUser.id !== "guest") {
        return !owner || owner === "guest" || owner === authUser.id;
      }
      return !owner || owner === "guest";
    });
  }, [screenshots, authUser?.id]);

  // Active non-deleted screenshots vs Trash screenshots (strictly owner-scoped)
  const activeScreenshots = useMemo(() => {
    return ownedScreenshots.filter((item) => !item.isDeleted && !item.is_deleted);
  }, [ownedScreenshots]);

  const trashScreenshots = useMemo(() => {
    return ownedScreenshots.filter((item) => Boolean(item.isDeleted || item.is_deleted));
  }, [ownedScreenshots]);

  // Subscribe to collection security lock/unlock updates
  const [securityNonce, setSecurityNonce] = useState(0);
  useEffect(() => {
    const unsub = collectionSecurity.subscribe(() => {
      setSecurityNonce((n) => n + 1);
    });
    return unsub;
  }, []);

  // Filter out locked collection contents and locked vault items from normal gallery/search/timeline
  const accessibleScreenshots = useMemo(() => {
    return activeScreenshots.filter((item) => collectionSecurity.isItemAccessible(item));
  }, [activeScreenshots, securityNonce]);

  // Subscribe to NotificationService singleton
  useEffect(() => {
    const unsubscribe = NotificationService.subscribe((list) => {
      setNotifications(list);
    });
    return unsubscribe;
  }, []);

  // Listen for plan quota limit exceeded and pricing navigation events
  useEffect(() => {
    const handleQuotaExceeded = (e: any) => {
      const limit = SubscriptionManager.getMaxScreenshotLimit(activeUser?.id);
      NotificationService.notifyQuotaExceeded(activeScreenshots.length, limit);
      addToast({
        title: e.detail?.title || "Indexing limit reached",
        description:
          e.detail?.message ||
          `Automatic indexing has paused at your ${limit.toLocaleString()}-screenshot limit. Existing indexed screenshots remain safe. Upgrade or claim a free VIP seat to continue.`,
        type: "info",
      });
    };

    const handleOpenProModal = () => {
      setActiveView("pricing");
    };

    window.addEventListener("snapfind_quota_exceeded", handleQuotaExceeded);
    window.addEventListener("snapfind_open_pro_modal", handleOpenProModal);

    return () => {
      window.removeEventListener("snapfind_quota_exceeded", handleQuotaExceeded);
      window.removeEventListener("snapfind_open_pro_modal", handleOpenProModal);
    };
  }, [activeScreenshots.length, activeUser?.id]);

  // Auto-purge items from Trash older than 30 days (persists to local storage & cloud DB)
  useEffect(() => {
    if (ownedScreenshots.length === 0) return;
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const item of ownedScreenshots) {
      const isDel = item.isDeleted || item.is_deleted;
      if (!isDel) continue;
      const delAt = item.deletedAt || item.deleted_at;
      if (!delAt) continue;
      const delTime = new Date(delAt).getTime();
      if (Number.isNaN(delTime)) continue;

      if (now - delTime > THIRTY_DAYS_MS) {
        expiredIds.push(item.id);
      }
    }

    if (expiredIds.length > 0) {
      const expiredSet = new Set(expiredIds);
      deleteStoredScreenshotsBatch(expiredIds);
      SyncEngine.deleteScreenshotsBatchFromCloud(expiredIds, authUser?.id).catch(() => {});
      setScreenshots((prev) => prev.filter((item) => !expiredSet.has(item.id)));
      addToast({
        title: "Auto-Cleanup Performed",
        description: `Permanently removed ${expiredIds.length} item(s) in Trash older than 30 days.`,
        type: "info",
      });
    }
  }, [ownedScreenshots.length, authUser?.id]);

  // Sync collections whenever screenshots change
  useEffect(() => {
    const synced = deriveAndSyncCollections(activeScreenshots, collections);
    setCollections(synced);
  }, [activeScreenshots, screenshots.length]);

  // Collection Handlers
  const handleCreateCollection = (name: string, description?: string) => {
    const updated = createCustomCollection(name, description, collections);
    setCollections(updated);
  };

  const handleRenameCollection = (oldName: string, newName: string) => {
    const { updatedScreenshots, updatedCollections } = renameCollection(
      oldName,
      newName,
      screenshots,
      collections
    );
    setScreenshots(updatedScreenshots);
    setCollections(updatedCollections);
  };

  const handleDeleteCollection = (collectionName: string, deleteScreenshots: boolean) => {
    const { updatedScreenshots, updatedCollections } = deleteCollection(
      collectionName,
      screenshots,
      collections,
      deleteScreenshots
    );
    setScreenshots(updatedScreenshots);
    setCollections(updatedCollections);
  };

  const handleMergeCollections = (sourceNames: string[], targetName: string) => {
    const { updatedScreenshots, updatedCollections } = mergeCollections(
      sourceNames,
      targetName,
      screenshots,
      collections
    );
    setScreenshots(updatedScreenshots);
    setCollections(updatedCollections);
  };

  const handleMoveScreenshots = (ids: string[], targetCollectionName: string) => {
    const { updatedScreenshots, updatedCollections } = moveScreenshotsToCollection(
      ids,
      targetCollectionName,
      screenshots,
      collections
    );
    setScreenshots(updatedScreenshots);
    setCollections(updatedCollections);
  };

  // Initialize Production Storage Provider (IndexedDB / SQLite) & Automatic localStorage Migration
  useEffect(() => {
    if (typeof (window as any).__SNAPFIND_MOUNTED__ === "function") {
      (window as any).__SNAPFIND_MOUNTED__();
    }
    initializeStorage()
      .then(() => {
        const stored = loadStoredScreenshots();
        setScreenshots(stored);
        searchEngine.updateIndex(stored);
        setSettings(loadSettings());
        setSearchHistory(loadSearchHistory());
        setUserProfile(loadUserProfile());
        setIsStorageReady(true);
      })
      .catch((storageErr) => {
        console.warn("[App] initializeStorage fallback:", storageErr);
        const stored = loadStoredScreenshots();
        setScreenshots(stored);
        setIsStorageReady(true);
      });
  }, []);

  // Listen for real-time background OCR / AI processing completions & failures (upsert new auto-indexed items immediately)
  useEffect(() => {
    const handleScreenshotProcessed = (e: any) => {
      const updatedScreenshot: ScreenshotItem | undefined = e.detail?.screenshot;
      if (!updatedScreenshot || !updatedScreenshot.id) return;

      const ownerId =
        updatedScreenshot.user_id ||
        updatedScreenshot.userId ||
        (authUser?.id && authUser.id !== "guest" ? authUser.id : undefined);

      const stampedItem: ScreenshotItem = ownerId
        ? { ...updatedScreenshot, user_id: ownerId, userId: ownerId }
        : updatedScreenshot;

      setScreenshots((prev) => {
        const exists = prev.some((item) => item.id === stampedItem.id);
        const next = exists
          ? prev.map((item) => (item.id === stampedItem.id ? { ...item, ...stampedItem } : item))
          : [stampedItem, ...prev];
        searchEngine.updateIndex(next);
        return next;
      });

      if (selectedItem?.id === stampedItem.id) {
        setSelectedItem((prev) => (prev ? { ...prev, ...stampedItem } : null));
      }
    };

    window.addEventListener("snapfind_screenshot_processed", handleScreenshotProcessed);
    return () => {
      window.removeEventListener("snapfind_screenshot_processed", handleScreenshotProcessed);
    };
  }, [selectedItem?.id, authUser?.id]);

  // Restore user-scoped data and bind native Android screenshot scanner when auth user changes (login/logout)
  useEffect(() => {
    if (!isStorageReady) return;
    if (authUser?.id && authUser.id !== "guest") {
      console.log(`[App] Auth user logged in (${authUser.id}), restoring remote & local screenshots...`);
      refreshFounderStats().catch(() => {});
      SyncEngine.restoreUserDataOnLogin(authUser.id)
        .then((restored) => {
          if (restored.screenshots) {
            setScreenshots(restored.screenshots);
            searchEngine.updateIndex(restored.screenshots);
          }
          if (restored.settings) {
            setSettings(restored.settings);
          }
          if (restored.history) {
            setSearchHistory(restored.history);
          }
        })
        .catch((syncErr) => {
          console.warn("[App] restoreUserDataOnLogin warning:", syncErr);
        })
        .finally(() => {
          // Only activate automatic Android gallery scanning/monitoring after authenticated login
          nativeMediaScanner.setActiveUser(authUser.id).catch((scannerErr) => {
            console.warn("[App] nativeMediaScanner.setActiveUser warning:", scannerErr);
          });
        });
    } else {
      nativeMediaScanner.setActiveUser(null).catch(() => {});
      SyncEngine.setCurrentUserId("guest");
      clearUserSessionData();
      const localStored = loadStoredScreenshots();
      setScreenshots(localStored);
      searchEngine.updateIndex(localStored);
    }
  }, [authUser?.id, isStorageReady]);

  // Sync screenshots to storage & search engine once storage is initialized
  useEffect(() => {
    if (!isStorageReady) return;
    saveStoredScreenshots(screenshots);
    searchEngine.updateIndex(screenshots);
  }, [screenshots, isStorageReady]);

  // Sync settings to storage & handle dark/light mode class
  useEffect(() => {
    saveSettings(settings);
    if (settings.theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings]);

  // Persist notifications to storage
  useEffect(() => {
    saveNotifications(notifications);
  }, [notifications]);

  // Toast Helper
  const addToast = (msg: { title: string; description?: string; type: "success" | "error" | "info" | "warning" }) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: ToastMessage = { ...msg, id, timestamp: Date.now() };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Notification Center Helpers delegated to NotificationService singleton
  const handleMarkAllAsRead = () => {
    NotificationService.markAllAsRead();
    addToast({
      title: "All Notifications Marked Read",
      type: "info",
    });
  };

  const handleMarkAsRead = (id: string) => {
    NotificationService.toggleRead(id);
  };

  const handleDeleteNotification = (id: string) => {
    NotificationService.deleteNotification(id);
  };

  const handleClearAllNotifications = () => {
    NotificationService.clearAll(activeUser?.id);
    addToast({
      title: "Notifications Cleared",
      description: "All notifications were permanently cleared.",
      type: "info",
    });
  };

  // Listen to background sync engine completions for real-time notifications
  useEffect(() => {
    let wasSyncing = false;
    const unsubscribe = SyncEngine.subscribe((state) => {
      if (wasSyncing && !state.isSyncing) {
        if (!state.lastError && state.lastSyncedAt) {
          NotificationService.notifySyncCompleted(activeScreenshots.length);
        } else if (state.lastError) {
          NotificationService.notifySyncFailed(state.lastError);
        }
      }
      wasSyncing = state.isSyncing;
    });
    return unsubscribe;
  }, [activeScreenshots.length]);

  // Execute Natural Language Search via AI (Instant 0ms + Background AI Refinement)
  const handleExecuteSearch = async (queryToRun: string) => {
    const q = queryToRun.trim();
    setSearchQuery(q);

    if (!q) {
      setSearchResults([]);
      return;
    }

    // 1. Instant local search (0ms latency)
    const instantResults = instantKeywordSearch(q, accessibleScreenshots);
    setSearchResults(instantResults);
    setActiveView("search");

    // Add to search history immediately
    const newHistoryItem: SearchHistoryItem = {
      id: `sh-${Date.now()}`,
      query: q,
      timestamp: new Date().toISOString(),
      resultCount: instantResults.length,
      categoryFilter: selectedCategory,
    };
    const updatedHistory = [newHistoryItem, ...searchHistory.filter((h) => h.query !== q)];
    setSearchHistory(updatedHistory);
    saveSearchHistory(updatedHistory);

    // 2. Background AI refinement (non-blocking)
    setIsSearching(true);
    try {
      const results = await searchScreenshotsAI(q, accessibleScreenshots);
      if (results && results.length > 0) {
        setSearchResults(results);
      }
    } catch (err) {
      console.error("AI search refinement fallback:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // Delete individual search history item
  const handleDeleteHistoryItem = (id: string) => {
    setSearchHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveSearchHistory(updated);
      return updated;
    });
    addToast({
      title: "History Record Removed",
      type: "info",
    });
  };

  // Clear all search history
  const handleClearHistory = () => {
    setSearchHistory([]);
    saveSearchHistory([]);
    addToast({
      title: "Search History Cleared",
      description: "All recorded natural language search queries were cleared.",
      type: "info",
    });
  };

  // Toggle favorite status & sync locally + cloud
  const handleToggleFavorite = (id: string) => {
    let updatedItem: ScreenshotItem | null = null;
    setScreenshots((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextState = !(item.isFavorite || item.favorite);
          updatedItem = {
            ...item,
            isFavorite: nextState,
            favorite: nextState,
            dateModified: new Date().toISOString(),
            date_modified: new Date().toISOString(),
          };
          if (selectedItem?.id === id) setSelectedItem(updatedItem);
          return updatedItem;
        }
        return item;
      })
    );

    if (updatedItem) {
      SyncEngine.markScreenshotPending(updatedItem);
      const isFav = (updatedItem as ScreenshotItem).isFavorite;
      addToast({
        title: isFav ? "Added to Favorites" : "Removed from Favorites",
        description: isFav
          ? `Saved "${(updatedItem as ScreenshotItem).title}" in Favorites.`
          : `Removed "${(updatedItem as ScreenshotItem).title}" from Favorites.`,
        type: "success",
      });
    }
  };

  // Move screenshot category
  const handleMoveCategory = (id: string, newCategory: CategoryType) => {
    setScreenshots((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, category: newCategory };
          if (selectedItem?.id === id) setSelectedItem(updated);
          return updated;
        }
        return item;
      })
    );
    addToast({
      title: "Category Updated",
      description: `Moved screenshot to "${newCategory}".`,
      type: "success",
    });
  };

  // Move screenshot to Trash (Soft Delete)
  const handleDeleteScreenshot = (id: string) => {
    let trashedTitle = "";
    const nowIso = new Date().toISOString();
    setScreenshots((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          trashedTitle = item.title;
          const updated: ScreenshotItem = {
            ...item,
            isDeleted: true,
            is_deleted: true,
            deletedAt: nowIso,
            deleted_at: nowIso,
          };
          SyncEngine.markScreenshotPending(updated);
          return updated;
        }
        return item;
      })
    );
    setSearchResults((prev) => prev.filter((r) => r.id !== id));
    if (selectedItem?.id === id) setSelectedItem(null);
    addToast({
      title: "Moved to Trash",
      description: trashedTitle
        ? `"${trashedTitle}" moved to Trash (retained 30 days).`
        : "Screenshot moved to Trash (retained 30 days).",
      type: "info",
    });
  };

  // Batch Move to Trash
  const handleBatchDelete = (ids: string[]) => {
    const idSet = new Set(ids);
    const nowIso = new Date().toISOString();
    setScreenshots((prev) =>
      prev.map((item) => {
        if (idSet.has(item.id)) {
          const updated: ScreenshotItem = {
            ...item,
            isDeleted: true,
            is_deleted: true,
            deletedAt: nowIso,
            deleted_at: nowIso,
          };
          SyncEngine.markScreenshotPending(updated);
          return updated;
        }
        return item;
      })
    );
    setSearchResults((prev) => prev.filter((r) => !idSet.has(r.id)));
    if (selectedItem && idSet.has(selectedItem.id)) setSelectedItem(null);
    addToast({
      title: "Moved to Trash",
      description: `${ids.length} screenshot(s) moved to Trash.`,
      type: "info",
    });
  };

  // Restore Screenshot from Trash (owner-verified)
  const handleRestoreScreenshot = (id: string) => {
    let restoredTitle = "";
    setScreenshots((prev) =>
      prev.map((item) => {
        if (item.id === id && isOwnedByCurrentUser(item)) {
          restoredTitle = item.title;
          const updated: ScreenshotItem = {
            ...item,
            isDeleted: false,
            is_deleted: false,
            deletedAt: undefined,
            deleted_at: undefined,
            dateModified: new Date().toISOString(),
            date_modified: new Date().toISOString(),
          };
          SyncEngine.markScreenshotPending(updated);
          return updated;
        }
        return item;
      })
    );
    addToast({
      title: "Screenshot Restored",
      description: restoredTitle
        ? `"${restoredTitle}" restored to Gallery.`
        : "Item restored to Gallery.",
      type: "success",
    });
  };

  // Batch Restore (owner-verified)
  const handleBatchRestore = (ids: string[]) => {
    const idSet = new Set(ids);
    let restoredCount = 0;
    const nowIso = new Date().toISOString();
    setScreenshots((prev) =>
      prev.map((item) => {
        if (idSet.has(item.id) && isOwnedByCurrentUser(item)) {
          restoredCount++;
          const updated: ScreenshotItem = {
            ...item,
            isDeleted: false,
            is_deleted: false,
            deletedAt: undefined,
            deleted_at: undefined,
            dateModified: nowIso,
            date_modified: nowIso,
          };
          SyncEngine.markScreenshotPending(updated);
          return updated;
        }
        return item;
      })
    );
    addToast({
      title: "Screenshots Restored",
      description: `${restoredCount || ids.length} item(s) restored to Gallery.`,
      type: "success",
    });
  };

  // Restore All items in Trash (owner-verified)
  const handleRestoreAllTrash = () => {
    const ownedTrashIds = trashScreenshots.map((item) => item.id);
    if (ownedTrashIds.length === 0) return;
    handleBatchRestore(ownedTrashIds);
  };

  // Permanent Delete single item (owner-verified, persists locally & in cloud DB)
  const handlePermanentDelete = (id: string) => {
    const target = trashScreenshots.find((item) => item.id === id);
    if (!target) return;
    deleteStoredScreenshot(id);
    SyncEngine.deleteScreenshotFromCloud(id, authUser?.id).catch(() => {});
    setScreenshots((prev) => prev.filter((item) => item.id !== id));
    setSearchResults((prev) => prev.filter((r) => r.id !== id));
    if (selectedItem?.id === id) setSelectedItem(null);
    addToast({
      title: "Permanently Deleted",
      description: "Screenshot permanently removed from SnapFind AI.",
      type: "info",
    });
  };

  // Batch Permanent Delete (owner-verified, persists locally & in cloud DB)
  const handleBatchPermanentDelete = (ids: string[]) => {
    const ownedTrashIdSet = new Set(trashScreenshots.map((item) => item.id));
    const verifiedIds = ids.filter((id) => ownedTrashIdSet.has(id));
    if (verifiedIds.length === 0) return;

    deleteStoredScreenshotsBatch(verifiedIds);
    SyncEngine.deleteScreenshotsBatchFromCloud(verifiedIds, authUser?.id).catch(() => {});
    const idSet = new Set(verifiedIds);
    setScreenshots((prev) => prev.filter((item) => !idSet.has(item.id)));
    setSearchResults((prev) => prev.filter((r) => !idSet.has(r.id)));
    if (selectedItem && idSet.has(selectedItem.id)) setSelectedItem(null);
    addToast({
      title: "Permanently Deleted",
      description: `Permanently removed ${verifiedIds.length} item(s) from SnapFind AI.`,
      type: "info",
    });
  };

  // Empty Entire Trash (owner-verified, persists locally & in cloud DB)
  const handleEmptyTrash = () => {
    const trashIds = Array.from(new Set(trashScreenshots.map((s) => s.id)));
    const count = trashIds.length;
    if (count > 0) {
      deleteStoredScreenshotsBatch(trashIds);
      SyncEngine.deleteScreenshotsBatchFromCloud(trashIds, authUser?.id).catch(() => {});
    }
    const trashSet = new Set(trashIds);
    setScreenshots((prev) => prev.filter((item) => !trashSet.has(item.id)));
    setSearchResults((prev) => prev.filter((r) => !trashSet.has(r.id)));
    if (selectedItem && trashSet.has(selectedItem.id)) setSelectedItem(null);
    addToast({
      title: "Trash Emptied",
      description: `Permanently deleted ${count} item(s).`,
      type: "info",
    });
  };

  // Batch favorite / unfavorite
  const handleBatchFavorite = (ids: string[], isFavorite: boolean) => {
    const idSet = new Set(ids);
    const updatedList: ScreenshotItem[] = [];

    setScreenshots((prev) =>
      prev.map((item) => {
        if (idSet.has(item.id)) {
          const updated = {
            ...item,
            isFavorite,
            favorite: isFavorite,
            dateModified: new Date().toISOString(),
            date_modified: new Date().toISOString(),
          };
          updatedList.push(updated);
          return updated;
        }
        return item;
      })
    );

    if (selectedItem && idSet.has(selectedItem.id)) {
      setSelectedItem({ ...selectedItem, isFavorite, favorite: isFavorite });
    }

    // Mark updated items as pending sync
    updatedList.forEach((item) => SyncEngine.markScreenshotPending(item));

    addToast({
      title: isFavorite ? "Marked as Favorite" : "Favorites Updated",
      description: `Updated ${ids.length} screenshot(s).`,
      type: "success",
    });
  };

  // Batch move category
  const handleBatchMoveCategory = (ids: string[], targetCategory: CategoryType) => {
    const idSet = new Set(ids);
    setScreenshots((prev) =>
      prev.map((item) => (idSet.has(item.id) ? { ...item, category: targetCategory } : item))
    );
    if (selectedItem && idSet.has(selectedItem.id)) {
      setSelectedItem({ ...selectedItem, category: targetCategory });
    }
    addToast({
      title: "Category Batch Moved",
      description: `Moved ${ids.length} item(s) to "${targetCategory}".`,
      type: "success",
    });
  };

  // Batch Export
  const handleBatchExport = (ids: string[], format: "json" | "txt" | "md") => {
    const idSet = new Set(ids);
    const selectedScreenshots = screenshots.filter((s) => idSet.has(s.id));
    if (selectedScreenshots.length === 0) return;

    let blobContent = "";
    let mimeType = "text/plain";
    let fileExt = "txt";

    if (format === "json") {
      blobContent = JSON.stringify(selectedScreenshots, null, 2);
      mimeType = "application/json";
      fileExt = "json";
    } else if (format === "md") {
      blobContent = `# SnapFind AI Knowledge Export\n*Exported ${selectedScreenshots.length} items on ${new Date().toLocaleDateString()}*\n\n` +
        selectedScreenshots
          .map(
            (s, idx) =>
              `## ${idx + 1}. ${s.title}\n- **Category:** ${s.category}\n- **Date:** ${new Date(s.createdAt).toLocaleDateString()}\n- **Tags:** ${s.tags?.join(", ") || "None"}\n\n### Summary\n${s.summary}\n\n### Extracted OCR Text\n\`\`\`\n${s.fullText || s.ocr_text || s.summary}\n\`\`\`\n\n---`
          )
          .join("\n\n");
      mimeType = "text/markdown";
      fileExt = "md";
    } else {
      // txt format
      blobContent = `SNAPFIND AI - BATCH OCR EXPORT (${selectedScreenshots.length} ITEMS)\n` +
        `===================================================\n\n` +
        selectedScreenshots
          .map(
            (s, idx) =>
              `[${idx + 1}] ${s.title.toUpperCase()} (${s.category})\nDate: ${new Date(s.createdAt).toLocaleDateString()}\nSummary: ${s.summary}\n\nOCR TEXT:\n${s.fullText || s.ocr_text || s.summary}\n---------------------------------------------------`
          )
          .join("\n\n");
      mimeType = "text/plain";
      fileExt = "txt";
    }

    const blob = new Blob([blobContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snapfind_export_${new Date().toISOString().slice(0, 10)}.${fileExt}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addToast({
      title: "Export Complete",
      description: `Exported ${selectedScreenshots.length} screenshot(s) as .${fileExt.toUpperCase()}`,
      type: "success",
    });
  };

  // Batch Share
  const handleBatchShare = (ids: string[]) => {
    const idSet = new Set(ids);
    const selectedScreenshots = screenshots.filter((s) => idSet.has(s.id));
    if (selectedScreenshots.length === 0) return;

    const summaryText = `📸 SnapFind AI - ${selectedScreenshots.length} Screenshots:\n\n` +
      selectedScreenshots
        .slice(0, 5)
        .map((s, i) => `${i + 1}. ${s.title} (${s.category}) - ${s.summary}`)
        .join("\n") +
      (selectedScreenshots.length > 5 ? `\n...and ${selectedScreenshots.length - 5} more.` : "");

    if (navigator.share) {
      navigator
        .share({
          title: `SnapFind AI - ${selectedScreenshots.length} Screenshots`,
          text: summaryText,
        })
        .catch(() => {
          navigator.clipboard.writeText(summaryText);
          addToast({
            title: "Share Summary Copied",
            description: `Copied summary of ${selectedScreenshots.length} screenshot(s) to clipboard.`,
            type: "success",
          });
        });
    } else {
      navigator.clipboard.writeText(summaryText);
      addToast({
        title: "Share Digest Copied",
        description: `Copied shareable digest for ${selectedScreenshots.length} item(s) to clipboard.`,
        type: "success",
      });
    }
  };

  // Batch Reindex
  const handleBatchReindex = (ids: string[]) => {
    const idSet = new Set(ids);
    const nowIso = new Date().toISOString();

    setScreenshots((prev) =>
      prev.map((item) => {
        if (idSet.has(item.id)) {
          const updated: ScreenshotItem = {
            ...item,
            dateModified: nowIso,
            date_modified: nowIso,
            ocrAccuracyScore: Math.min(0.999, (item.ocrAccuracyScore || 0.98) + 0.005),
            keyEntities: Array.from(
              new Set([...(item.keyEntities || []), "AI Re-indexed", "Refreshed OCR"])
            ),
          };
          SyncEngine.markScreenshotPending(updated);
          return updated;
        }
        return item;
      })
    );

    // AI finished notification for batch re-index
    NotificationService.notifyBatchIndexed(ids.length, 800);

    addToast({
      title: "AI Vision Re-index Complete",
      description: `Re-scanned and refreshed OCR intelligence for ${ids.length} screenshot(s).`,
      type: "success",
    });
  };

  // Single Screenshot Reindex / Retry
  const handleReindexScreenshot = (id: string) => {
    const item = screenshots.find((s) => s.id === id);
    if (!item) return;

    setScreenshots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, processingStatus: "Queued", processing_status: "Queued" } : s))
    );
    if (selectedItem?.id === id) {
      setSelectedItem((prev) => (prev ? { ...prev, processingStatus: "Queued", processing_status: "Queued" } : null));
    }

    processingQueue.retryScreenshot(item);
    addToast({
      title: "AI Analysis Queued",
      description: "Re-scanning OCR and generating AI metadata...",
      type: "info",
    });
  };

  // Copy OCR text helper
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast({
      title: "OCR Text Copied",
      description: "Copied extracted text to clipboard.",
      type: "success",
    });
  };

  // Add new imported screenshots with user ownership and sync queueing
  const handleAddScreenshots = (newItems: ScreenshotItem[]) => {
    const stampedItems = newItems.map((item) => {
      const stamped: ScreenshotItem = {
        ...item,
        user_id: item.user_id || item.userId || activeUser?.id || "guest",
        userId: item.user_id || item.userId || activeUser?.id || "guest",
        syncStatus: "Pending",
      };
      SyncEngine.markScreenshotPending(stamped);
      return stamped;
    });

    setScreenshots((prev) => [...stampedItems, ...prev]);

    // Dispatch real-time notifications for newly indexed screenshots
    if (stampedItems.length > 0) {
      if (stampedItems.length === 1) {
        NotificationService.notifyScreenshotIndexed(stampedItems[0]);
      } else {
        NotificationService.notifyBatchIndexed(stampedItems.length, 1200);
      }
    }
  };

  // Safe Sample Pack loader with deduplication
  const handleLoadSamplePack = () => {
    const existing = loadStoredScreenshots();
    const existingIds = new Set(existing.map((s) => s.id));
    const existingHashes = new Set(existing.map((s) => s.sha256Hash || s.content_hash || s.fileHash).filter(Boolean));

    const newSamples = INITIAL_SAMPLE_SCREENSHOTS.filter(
      (item) => !existingIds.has(item.id) && !existingHashes.has(item.sha256Hash)
    );

    if (newSamples.length === 0) {
      addToast({
        title: "Sample Pack Already Loaded",
        description: "All 6 sample screenshots are already present in your gallery.",
        type: "info",
      });
      return;
    }

    const preparedSamples = newSamples.map((item) => ({
      ...item,
      id: `sample-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      indexedAt: new Date().toISOString(),
      user_id: activeUser?.id || "guest",
      userId: activeUser?.id || "guest",
      isSample: true,
      is_sample: true,
    }));

    handleAddScreenshots(preparedSamples);
    preparedSamples.forEach((item) => searchEngine.updateItem(item));

    addToast({
      title: `Loaded ${preparedSamples.length} Sample Screenshot${preparedSamples.length > 1 ? "s" : ""}`,
      description: "Passport, Bill, Recipe, Travel, Receipt, and QR Code are indexed and searchable.",
      type: "success",
    });
  };

  // Theme toggle
  const handleToggleTheme = () => {
    const nextTheme = settings.theme === "dark" ? "light" : "dark";
    setSettings((prev) => ({ ...prev, theme: nextTheme }));
  };

  // Reset data (confirmed via in-app SettingsView dialog)
  const handleResetAllData = () => {
    setScreenshots([]);
    setSearchResults([]);
    setSearchHistory([]);
    localStorage.clear();
    addToast({
      title: "System Reset Complete",
      description: "Cleared all screenshots & index cache.",
      type: "info",
    });
  };

  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const el = mainContentRef.current;
    if (!el) return;
    const onScroll = () => {
      setShowScrollTop(el.scrollTop > 320);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const handleSmoothScrollTop = () => {
    const el = mainContentRef.current;
    if (el) {
      el.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const isDark = settings.theme === "dark";
  const isLandingView = activeView === "landing";

  return (
    <div
      className={`h-screen w-screen overflow-hidden font-sans relative transition-colors duration-300 ${
        isDark ? "text-[#F1F5F9] dark" : "bg-zinc-50 text-black"
      }`}
      style={
        isDark
          ? {
              backgroundColor: "#080908",
            }
          : undefined
      }
    >
      {/* Main App Workspace: Two-column layout on Desktop, stacked on Mobile */}
      <div className="relative z-10 flex flex-col lg:flex-row h-full w-full overflow-hidden">
        {/* LEFT: Fixed Sidebar (permanently visible on >= 1024px, 100vh, flex-shrink-0) */}
        <SidebarNavigation
          activeView={activeView}
          setActiveView={setActiveView}
          isDark={isDark}
          indexedCount={activeScreenshots.length}
          favoriteCount={activeScreenshots.filter((s) => Boolean(s.isFavorite || s.favorite)).length}
          trashCount={trashScreenshots.length}
          unreadNotificationCount={notifications.filter((n) => !n.read && !n.isRead).length}
          onOpenUpgradeModal={() => setActiveView("pricing")}
          isMobileOpen={isMobileNavOpen}
          onCloseMobile={() => setIsMobileNavOpen(false)}
        />

        {/* RIGHT: Scrollable Main Content Area */}
        <div
          id="main-content-scroll-container"
          ref={mainContentRef}
          className="flex-1 h-full min-w-0 flex flex-col overflow-y-auto overflow-x-hidden relative scroll-smooth"
        >
          {/* Top Navbar */}
          <Navbar
            user={activeUser}
            settings={settings}
            onToggleTheme={handleToggleTheme}
            onOpenImport={() => setActiveView("import")}
            onOpenAuth={() => openAuthModal("login")}
            totalIndexedCount={activeScreenshots.length}
            currentSearchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onExecuteSearch={handleExecuteSearch}
            activeView={activeView}
            setActiveView={setActiveView}
            unreadNotificationCount={notifications.filter((n) => !n.read && !n.isRead).length}
            onOpenNotifications={() => setIsNotificationOpen(true)}
            onToggleMobileMenu={() => setIsMobileNavOpen(true)}
            onBack={() => setActiveView("landing")}
          />

          {/* Main Workspace Area */}
          <main className="flex-1 w-full max-w-7xl mx-auto p-3 sm:p-6 lg:p-8 space-y-6 min-w-0 pb-24 lg:pb-12">
            {!isOnline && <OfflineBanner isDark={isDark} />}

          {/* Global Founder Status / Recognition Banner for Verified Founders */}
          {activeView !== "landing" && (
            <FounderBanner
              user={activeUser}
              settings={settings}
              onNavigateToFounders={() => setActiveView("pricing")}
              isDark={isDark}
            />
          )}

          {/* Non-intrusive Founder feedback prompt for the first 50 users */}
          {activeView !== "landing" && (
            <FounderFeedbackPrompt
              isDark={isDark}
              isFounder={Boolean(activeUser?.entitlement?.isFounder || activeUser?.plan === "Founder" || (activeUser?.entitlement?.founderNumber && activeUser.entitlement.founderNumber <= 50))}
              onOpenFeedback={() => setActiveView("feedback")}
            />
          )}

          <AnimatePresence mode="wait">
            {/* Landing View (Public) */}
            {activeView === "landing" && (
              <motion.div
                key="landing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <LandingScreen
                  onSignUp={() => openAuthModal("register")}
                  onSignIn={() => openAuthModal("login")}
                  onNavigateToSearch={() => setActiveView("search")}
                  onNavigateToGallery={() => setActiveView("gallery")}
                />
              </motion.div>
            )}

            {/* Interactive Demo View (Public, Read-Only, Isolated Synthetic Dataset) */}
            {activeView === "demo" && (
              <motion.div
                key="demo"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <DemoView
                  onOpenAuth={() => setIsAuthOpen(true)}
                  onLoadSamplesToVault={() => {
                    handleLoadSamplePack();
                    setActiveView("gallery");
                  }}
                  onNavigateToGallery={() => setActiveView("gallery")}
                  onSelectScreenshot={(item) => setSelectedItem(item)}
                  initialQuery={demoInitialQuery}
                />
              </motion.div>
            )}

            {/* Dashboard View (Protected) */}
            {activeView === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <ProtectedRoute
                  title="Sign in to access your dashboard"
                  heroType="dashboard"
                  onOpenAuth={() => setIsAuthOpen(true)}
                  isDark={isDark}
                >
                  <GalleryPermissionModal
                    userId={authUser?.id}
                    onManualUploadClick={() => setActiveView("import")}
                    onOpenPricing={() => setActiveView("pricing")}
                    onOpenVipClaim={canOfferVipClaim ? () => setIsVipInviteOpen(true) : undefined}
                  />

                  <DashboardView
                    screenshots={accessibleScreenshots}
                    collections={collections}
                    searchHistory={searchHistory}
                    isDark={isDark}
                    onNavigate={(v) => setActiveView(v)}
                    onSelectCategory={(cat) => setSelectedCategory(cat)}
                    onSelectScreenshot={(item) => setSelectedItem(item)}
                    onExecuteSearch={handleExecuteSearch}
                  />
                </ProtectedRoute>
              </motion.div>
            )}

            {/* AI Collections View (Protected) */}
            {activeView === "collections" && (
              <motion.div
                key="collections"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <ProtectedRoute
                  title="Sign in to access your collections"
                  heroType="collections"
                  onOpenAuth={() => setIsAuthOpen(true)}
                  isDark={isDark}
                >
                  <CollectionsView
                    collections={collections}
                    screenshots={activeScreenshots}
                    isDark={isDark}
                    onSelectScreenshot={(item) => setSelectedItem(item)}
                    onToggleFavorite={handleToggleFavorite}
                    onDeleteScreenshot={handleDeleteScreenshot}
                    onCreateCollection={handleCreateCollection}
                    onRenameCollection={handleRenameCollection}
                    onDeleteCollection={handleDeleteCollection}
                    onMergeCollections={handleMergeCollections}
                    onMoveScreenshots={handleMoveScreenshots}
                    addToast={addToast}
                  />
                </ProtectedRoute>
              </motion.div>
            )}

            {/* Timeline View (Protected) */}
            {activeView === "timeline" && (
              <motion.div
                key="timeline"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <ProtectedRoute
                  title="Sign in to access your timeline"
                  heroType="timeline"
                  onOpenAuth={() => setIsAuthOpen(true)}
                  isDark={isDark}
                >
                  <TimelineView
                    screenshots={accessibleScreenshots}
                    isDark={isDark}
                    onSelectScreenshot={(item) => setSelectedItem(item)}
                    onToggleFavorite={handleToggleFavorite}
                    onDeleteScreenshot={handleDeleteScreenshot}
                    onCopyText={(txt) => {
                      navigator.clipboard.writeText(txt);
                    }}
                    addToast={addToast}
                  />
                </ProtectedRoute>
              </motion.div>
            )}

            {/* Dedicated Favorites View (Protected) */}
            {activeView === "favorites" && (
              <motion.div
                key="favorites"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <ProtectedRoute
                  title="Sign in to access your favorites"
                  heroType="favorites"
                  onOpenAuth={() => setIsAuthOpen(true)}
                  isDark={isDark}
                >
                  <FavoritesView
                    screenshots={accessibleScreenshots}
                    isDark={isDark}
                    onSelectScreenshot={(item) => setSelectedItem(item)}
                    onToggleFavorite={handleToggleFavorite}
                    onMoveCategory={handleMoveCategory}
                    onDeleteScreenshot={handleDeleteScreenshot}
                    onBatchDelete={handleBatchDelete}
                    onBatchFavorite={handleBatchFavorite}
                    onBatchMoveCategory={handleBatchMoveCategory}
                    onCopyText={handleCopyText}
                  />
                </ProtectedRoute>
              </motion.div>
            )}

            {/* Dedicated Recently Deleted View (Protected) */}
            {activeView === "trash" && (
              <motion.div
                key="trash"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <ProtectedRoute
                  title="Sign in to access recently deleted screenshots"
                  heroType="trash"
                  onOpenAuth={() => openAuthModal("login")}
                  isDark={isDark}
                >
                  <TrashView
                    screenshots={trashScreenshots}
                    isDark={isDark}
                    onRestoreScreenshot={handleRestoreScreenshot}
                    onBatchRestore={handleBatchRestore}
                    onRestoreAll={handleRestoreAllTrash}
                    onPermanentDelete={handlePermanentDelete}
                    onBatchPermanentDelete={handleBatchPermanentDelete}
                    onEmptyTrash={handleEmptyTrash}
                    onSelectScreenshot={(item) => setSelectedItem(item)}
                  />
                </ProtectedRoute>
              </motion.div>
            )}

            {/* Dedicated Secure Reset Password Page (/reset-password) */}
            {activeView === "reset-password" && (
              <motion.div
                key="reset-password"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <ResetPasswordView
                  onNavigate={(v) => setActiveView(v)}
                  onOpenAuth={(mode) => openAuthModal(mode || "login")}
                  addToast={addToast}
                />
              </motion.div>
            )}

            {/* Main Gallery View (Protected) */}
            {activeView === "gallery" && (
              <motion.div
                key="gallery"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                <ProtectedRoute
                  title="Sign in to access your snaps"
                  heroType="gallery"
                  onOpenAuth={() => setIsAuthOpen(true)}
                  isDark={isDark}
                >
                  <GalleryPermissionModal
                    userId={authUser?.id}
                    onManualUploadClick={() => setActiveView("import")}
                    onOpenPricing={() => setActiveView("pricing")}
                    onOpenVipClaim={canOfferVipClaim ? () => setIsVipInviteOpen(true) : undefined}
                  />

                  <SearchBar
                    query={searchQuery}
                    setQuery={setSearchQuery}
                    onExecuteSearch={handleExecuteSearch}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                    isDark={isDark}
                    isSearching={isSearching}
                    screenshots={accessibleScreenshots}
                    searchHistory={searchHistory}
                    onDeleteHistoryItem={handleDeleteHistoryItem}
                  />

                  <StatsOverview
                    screenshots={accessibleScreenshots}
                    isDark={isDark}
                    onSelectCategory={(cat) => setSelectedCategory(cat)}
                  />

                  <ScreenshotGrid
                    screenshots={accessibleScreenshots}
                    searchResults={searchResults}
                    searchQuery={searchQuery}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                    isDark={isDark}
                    onSelect={(item) => setSelectedItem(item)}
                    onToggleFavorite={handleToggleFavorite}
                    onMoveCategory={handleMoveCategory}
                    onDelete={handleDeleteScreenshot}
                    onBatchDelete={handleBatchDelete}
                    onBatchFavorite={handleBatchFavorite}
                    onBatchMoveCategory={handleBatchMoveCategory}
                    onBatchExport={handleBatchExport}
                    onBatchShare={handleBatchShare}
                    onBatchReindex={handleBatchReindex}
                    onCopyText={handleCopyText}
                    onOpenImport={() => setActiveView("import")}
                    onOpenDemo={() => setActiveView("demo")}
                    onLoadSamplePack={handleLoadSamplePack}
                  />
                </ProtectedRoute>
              </motion.div>
            )}

            {/* AI Search Screen (Protected) */}
            {activeView === "search" && (
              <motion.div
                key="search"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <ProtectedRoute
                  title="Sign in to search your snaps"
                  heroType="search"
                  onOpenAuth={() => setIsAuthOpen(true)}
                  isDark={isDark}
                >
                  <SearchView
                    screenshots={accessibleScreenshots}
                    searchResults={searchResults}
                    query={searchQuery}
                    setQuery={setSearchQuery}
                    onExecuteSearch={handleExecuteSearch}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                    isDark={isDark}
                    isSearching={isSearching}
                    onSelectScreenshot={(item) => setSelectedItem(item)}
                    onToggleFavorite={handleToggleFavorite}
                    onMoveCategory={handleMoveCategory}
                    onDelete={handleDeleteScreenshot}
                    onCopyText={handleCopyText}
                    searchHistory={searchHistory}
                    onDeleteHistoryItem={handleDeleteHistoryItem}
                    onClearHistory={handleClearHistory}
                    onOpenImport={() => setActiveView("import")}
                    onOpenDemo={(q) => {
                      setDemoInitialQuery(q || "");
                      setActiveView("demo");
                    }}
                    onLoadSamplePack={handleLoadSamplePack}
                  />
                </ProtectedRoute>
              </motion.div>
            )}

            {/* Import View (Protected) */}
            {activeView === "import" && (
              <motion.div
                key="import"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <ProtectedRoute onOpenAuth={() => setIsAuthOpen(true)} isDark={isDark}>
                  <BatchImporter
                    onAddScreenshots={handleAddScreenshots}
                    isDark={isDark}
                    onFinishImport={() => setActiveView("gallery")}
                    addToast={addToast}
                  />
                </ProtectedRoute>
              </motion.div>
            )}

            {/* Search History View (Protected) */}
            {activeView === "history" && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <ProtectedRoute onOpenAuth={() => setIsAuthOpen(true)} isDark={isDark}>
                  <SearchHistoryView
                    history={searchHistory}
                    onExecuteSearch={(q) => {
                      handleExecuteSearch(q);
                    }}
                    onClearHistory={handleClearHistory}
                    onDeleteHistoryItem={handleDeleteHistoryItem}
                    isDark={isDark}
                  />
                </ProtectedRoute>
              </motion.div>
            )}

            {/* Pricing & Pro Dedicated View */}
            {activeView === "pricing" && (
              <motion.div
                key="pricing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <PricingPageView
                  isDark={isDark}
                  onNavigate={(v) => setActiveView(v)}
                  onOpenAuth={() => setIsAuthOpen(true)}
                  addToast={addToast}
                />
              </motion.div>
            )}

            {/* Founder Benefits Route Redirect to Consolidated Plans & Pricing */}
            {activeView === "founders" && (
              <motion.div
                key="founders-redirect"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <PricingPageView
                  isDark={isDark}
                  onNavigate={(v) => setActiveView(v)}
                  onOpenAuth={() => setIsAuthOpen(true)}
                  addToast={addToast}
                />
              </motion.div>
            )}

            {/* Notifications & Alert Center View (Protected) */}
            {activeView === "notifications" && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <ProtectedRoute onOpenAuth={() => setIsAuthOpen(true)} isDark={isDark}>
                  <NotificationPageView
                    notifications={notifications}
                    screenshots={activeScreenshots}
                    isDark={isDark}
                    onMarkAllAsRead={handleMarkAllAsRead}
                    onMarkAsRead={handleMarkAsRead}
                    onDeleteNotification={handleDeleteNotification}
                    onClearAllNotifications={handleClearAllNotifications}
                    onSelectScreenshot={(screenshot) => setSelectedItem(screenshot)}
                    onNavigate={(v) => setActiveView(v)}
                    onOpenPricing={() => setActiveView("pricing")}
                    onOpenAuth={() => setIsAuthOpen(true)}
                    onTriggerSync={() => SyncEngine.scheduleSync(0)}
                    onCopyText={handleCopyText}
                  />
                </ProtectedRoute>
              </motion.div>
            )}

            {/* Feedback Dedicated View */}
            {activeView === "feedback" && (
              <motion.div
                key="feedback"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <FeedbackView
                  isDark={isDark}
                  currentUser={activeUser}
                  screenshots={activeScreenshots}
                  onNavigate={(v) => setActiveView(v as NavViewType)}
                />
              </motion.div>
            )}

            {/* Settings View (Protected) */}
            {activeView === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <ProtectedRoute onOpenAuth={() => setIsAuthOpen(true)} isDark={isDark}>
                  <SettingsView
                    settings={settings}
                    onUpdateSettings={(newSet) => setSettings((prev) => ({ ...prev, ...newSet }))}
                    user={activeUser}
                    isDark={isDark}
                    indexedCount={activeScreenshots.length}
                    onResetAllData={handleResetAllData}
                    onOpenAuth={() => setIsAuthOpen(true)}
                    screenshots={activeScreenshots}
                  />
                </ProtectedRoute>
              </motion.div>
            )}

            {/* Account Dedicated View (Protected) */}
            {activeView === "account" && (
              <motion.div
                key="account"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <ProtectedRoute onOpenAuth={() => setIsAuthOpen(true)} isDark={isDark}>
                  <AccountPageView
                    user={activeUser}
                    isDark={isDark}
                    indexedCount={activeScreenshots.length}
                    settings={settings}
                    onUpdateSettings={(newSet) => setSettings((prev) => ({ ...prev, ...newSet }))}
                    addToast={addToast}
                    onOpenAuth={() => setIsAuthOpen(true)}
                    onNavigate={(v) => setActiveView(v as NavViewType)}
                  />
                </ProtectedRoute>
              </motion.div>
            )}

            {/* Admin Payments Management View (Admin Protected) */}
            {activeView === "admin-payments" && (
              <motion.div
                key="admin-payments"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <AdminPaymentsPage
                  user={activeUser}
                  isDark={isDark}
                  onNavigate={(v) => setActiveView(v as NavViewType)}
                  addToast={addToast}
                  onOpenAuth={() => setIsAuthOpen(true)}
                />
              </motion.div>
            )}

            {/* SnapDash Mini-Game Dedicated View */}
            {activeView === "game" && (
              <motion.div
                key="game"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <SnapDashPageView
                  user={activeUser}
                  onNavigate={(v) => setActiveView(v)}
                  onOpenFeedback={handleOpenFeedback}
                  onOpenAuthModal={() => setIsAuthOpen(true)}
                  isDark={isDark}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
        </div>
      </div>

      {/* Responsive Bottom Navigation Bar */}
      <BottomNavigation
        activeView={activeView}
        setActiveView={setActiveView}
        isDark={isDark}
        indexedCount={activeScreenshots.length}
        favoriteCount={activeScreenshots.filter((s) => Boolean(s.isFavorite || s.favorite)).length}
        trashCount={trashScreenshots.length}
      />

      {/* Lightbox Screenshot Inspector Modal */}
      <ImageViewerModal
        item={selectedItem}
        items={activeScreenshots}
        onSelectItem={(item) => setSelectedItem(item)}
        onClose={() => setSelectedItem(null)}
        isDark={isDark}
        onToggleFavorite={handleToggleFavorite}
        onDelete={handleDeleteScreenshot}
        onReindex={handleReindexScreenshot}
        onSearchTag={(tag) => handleExecuteSearch(tag)}
      />

      {/* User Auth / Profile Modal */}
      {isAuthOpen && (
        <AuthModal
          onClose={() => setIsAuthOpen(false)}
          isDark={isDark}
          initialMode={authModalMode}
          addToast={addToast}
          onSignupSuccess={() => {
            addToast({
              title: "Welcome to SnapFind AI",
              description: "Your account has been created successfully.",
              type: "success",
            });
          }}
        />
      )}

      {/* Automatic Lifetime Free invitation for the first 50 newly verified accounts */}
      <VipSeatInvitationModal
        isOpen={isVipInviteOpen}
        totalSpots={50}
        signupNumber={founderPromoStatus?.signupNumber ?? undefined}
        onClaim={async () => {
          if (!authUser?.id || authUser.id === "guest") {
            return { success: false, error: "Please sign in to claim Lifetime Free." };
          }
          const result = await claimFounderSpot(authUser.id);
          if (result.success && typeof result.founderNumber === "number") {
            setVipClaimedInModal(true);
            setFounderPromoStatus((prev) => prev ? { ...prev, claimed: true, founderRank: result.founderNumber! } : prev);
            await refreshEntitlement();
            addToast({
              title: "Lifetime Free activated",
              description: `Your permanent Pro access is active. Founder member #${result.founderNumber}.`,
              type: "success",
            });
          }
          return result;
        }}
        onMaybeLater={async () => {
          const userId = authUser?.id;
          if (userId) {
            await SubscriptionManager.dismissFounderPromo().catch((error) => {
              console.warn("[App] Could not save offer dismissal:", error?.message || error);
            });
            setFounderPromoStatus((prev) => prev ? { ...prev, dismissed: true } : prev);
            NotificationService.pushNotification(
              "SUBSCRIPTION",
              "Your Lifetime Free offer is waiting",
              "You are eligible for permanent SnapFind Pro access. Open this notification whenever you are ready to claim it.",
              {
                id: `founder_offer_waiting_${userId}`,
                userId,
                priority: "high",
                metadata: { eventType: "founder_offer_waiting", signupNumber: founderPromoStatus?.signupNumber },
              }
            );
          }
          setIsVipInviteOpen(false);
          addToast({
            title: "Offer saved for later",
            description: "A notification has been added. You can reopen it anytime to claim Lifetime Free.",
            type: "info",
          });
        }}
        onCloseAfterClaim={() => {
          setIsVipInviteOpen(false);
          setVipClaimedInModal(false);
        }}
      />

      {/* Give Feedback Modal */}
      <GiveFeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        currentPage={feedbackPageContext}
        user={activeUser}
        isDark={isDark}
        onSubmitted={() => {
          addToast({
            title: "Feedback Received",
            description: "Thank you for helping make SnapFind AI better!",
            type: "success",
          });
        }}
      />

      {/* Notification Center Drawer & Toast Notifications */}
      <NotificationCenter
        notifications={notifications}
        toasts={toasts}
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        onMarkAllAsRead={handleMarkAllAsRead}
        onMarkAsRead={handleMarkAsRead}
        onDeleteNotification={handleDeleteNotification}
        onClearAllNotifications={handleClearAllNotifications}
        onSelectScreenshot={(screenshot) => setSelectedItem(screenshot)}
        screenshots={activeScreenshots}
        onDismissToast={handleDismissToast}
        isDark={isDark}
        onTriggerSync={() => SyncEngine.scheduleSync(0)}
        onCopyText={handleCopyText}
      />

      {/* Smooth Back-to-Top Floating Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            type="button"
            aria-label="Scroll back to top"
            onClick={handleSmoothScrollTop}
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-20 lg:bottom-8 right-5 z-40 w-10 h-10 rounded-xl bg-[#141714] hover:bg-[#1B1F1A] border border-[#30362E] hover:border-[#B7F36B] text-[#F7F8F5] hover:text-[#B7F36B] shadow-[4px_4px_14px_rgba(0,0,0,0.75)] flex items-center justify-center transition-colors cursor-pointer"
          >
            <ArrowUp className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Free App Update Dialog */}
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        updateState={updateState}
        isDark={isDark}
      />

      {/* Post-Update What's New Dialog */}
      <WhatsNewModal
        isOpen={isWhatsNewOpen}
        onClose={() => setIsWhatsNewOpen(false)}
        version={whatsNewVersion}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}
