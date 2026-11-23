import React, { useState, useEffect, useRef, useMemo } from "react";
import { SnapFindLogo } from "./SnapFindLogo";
import {
  User,
  Shield,
  ShieldCheck,
  Key,
  Lock,
  Mail,
  Calendar,
  Layers,
  HardDrive,
  RefreshCw,
  Trash2,
  LogOut,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Database,
  Cloud,
  Check,
  Clock,
  Zap,
  Info,
  Sliders,
  Smartphone,
  Eye,
  EyeOff,
  UploadCloud,
  Copy,
  Crown,
  Gem,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile, AppSettings, PaymentRequest } from "../types";
import { useAuth } from "../context/AuthContext";
import { useFounder } from "../context/FounderContext";
import { SyncEngine, SyncState } from "../services/syncEngine";
import { SubscriptionManager, PLAN_LIMITS } from "../services/billing/SubscriptionManager";
import { ManualPaymentService } from "../services/billing/ManualPaymentService";
import { ManualPaymentModal } from "./subscription/ManualPaymentModal";
import { YourUsageCard } from "./subscription/YourUsageCard";
import { PaymentHistoryCard } from "./subscription/PaymentHistoryCard";
import { AdminPaymentRequestsModal } from "./admin/AdminPaymentRequestsModal";
import { PageHeroHeader } from "./PageHeroHeader";

interface AccountPageViewProps {
  user: UserProfile;
  isDark: boolean;
  indexedCount: number;
  settings: AppSettings;
  onUpdateSettings?: (newSettings: Partial<AppSettings>) => void;
  addToast?: (msg: { title: string; description?: string; type: "success" | "error" | "info" }) => void;
  onOpenAuth?: () => void;
  onNavigate?: (view: string) => void;
}

export const AccountPageView: React.FC<AccountPageViewProps> = ({
  user,
  isDark,
  indexedCount,
  settings,
  onUpdateSettings,
  addToast,
  onOpenAuth,
  onNavigate,
}) => {
  const {
    supabaseUser,
    isConfigured,
    entitlement,
    refreshEntitlement,
    updateName,
    updateUsername,
    updateProfilePicture,
    changeEmail,
    changePassword,
    signOut,
    signOutAllDevices,
    deleteAccount,
  } = useAuth();

  const {
    remaining: vipRemaining,
    totalSpots: vipTotalSpots,
    isLive: isVipStatsLive,
    isLoading: isVipStatsLoading,
    eligibility: vipEligibility,
    claimFounderSpot,
    refreshFounderStats,
    refreshEligibility,
  } = useFounder();

  const [fallbackPromoStatus, setFallbackPromoStatus] = useState<
    Awaited<ReturnType<typeof SubscriptionManager.getFounderPromoStatus>>
  >(null);

  useEffect(() => {
    let cancelled = false;
    const currentUserId = user?.id || supabaseUser?.id;
    if (
      vipEligibility ||
      !currentUserId ||
      currentUserId === "guest" ||
      currentUserId.startsWith("local-guest")
    ) {
      return;
    }
    SubscriptionManager.getFounderPromoStatus()
      .then((status) => {
        if (!cancelled) setFallbackPromoStatus(status);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vipEligibility, user?.id, supabaseUser?.id]);

  const isVipOfferEligible = Boolean(
    (vipEligibility?.vipEligible && vipEligibility.vipClaimStatus === "pending") ||
      (!vipEligibility && fallbackPromoStatus?.eligible && !fallbackPromoStatus.claimed)
  );

  const [isClaimingVip, setIsClaimingVip] = useState(false);
  const [vipClaimError, setVipClaimError] = useState<string | null>(null);
  const [vipClaimedSuccessNum, setVipClaimedSuccessNum] = useState<number | null>(null);
  const isClaimingVipRef = useRef(false);

  const handleAccountClaimVip = async () => {
    if (isClaimingVipRef.current || isClaimingVip) return;
    const currentUserId = user?.id || supabaseUser?.id;
    if (!currentUserId || currentUserId === "guest" || currentUserId.startsWith("local-guest")) {
      onOpenAuth?.();
      return;
    }
    isClaimingVipRef.current = true;
    setIsClaimingVip(true);
    setVipClaimError(null);
    try {
      const res = vipEligibility
        ? await claimFounderSpot(currentUserId)
        : await SubscriptionManager.claimFounder(currentUserId);
      if (res.success && typeof res.founderNumber === "number" && res.founderNumber >= 1) {
        setVipClaimedSuccessNum(res.founderNumber);
        setFallbackPromoStatus((prev) =>
          prev ? { ...prev, claimed: true, founderRank: res.founderNumber! } : prev
        );
        await refreshEntitlement();
        if (vipEligibility) {
          await refreshFounderStats();
          await refreshEligibility?.();
        }
        addToast?.({
          title: "Lifetime Free VIP Activated!",
          description: `VIP Member #${res.founderNumber} is now permanently linked to your account.`,
          type: "success",
        });
      } else {
        setVipClaimError(res.error || "Unable to activate Lifetime Free VIP right now. Please try again.");
      }
    } catch (err: any) {
      setVipClaimError(err?.message || "Unable to claim a VIP seat right now. Please try again.");
    } finally {
      isClaimingVipRef.current = false;
      setIsClaimingVip(false);
    }
  };

  // Full Name Editing State
  const [name, setName] = useState(user.name || "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [username, setUsername] = useState(user.username || "");
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Profile Picture Upload State
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState("");
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Change Password State
  const [currentPasswordForPass, setCurrentPasswordForPass] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassModal, setShowPassModal] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passMsg, setPassMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Change Email State
  const [newEmail, setNewEmail] = useState("");
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState("");
  const [showEmailCurrentPass, setShowEmailCurrentPass] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Payment Requests and Authoritative Entitlement State
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [isRefreshingEntitlement, setIsRefreshingEntitlement] = useState(false);
  const [showManualPaymentModal, setShowManualPaymentModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const handleOpenPricing = () => {
    if (onNavigate) {
      onNavigate("pricing");
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("snapfind_open_pro_modal"));
    }
  };

  // Fetch Authoritative Entitlement & Payment Requests
  const fetchAuthoritativeStatus = async () => {
    try {
      setIsRefreshingEntitlement(true);
      await refreshEntitlement();
      const currentUserId = user?.id || supabaseUser?.id;
      if (currentUserId && currentUserId !== "guest" && !currentUserId.startsWith("local-guest")) {
        const reqs = await ManualPaymentService.getMyPaymentRequests(currentUserId);
        setPaymentRequests(reqs);
      }
    } catch (e) {
      console.warn("[AccountPage] Authoritative sync warning:", e);
    } finally {
      setIsRefreshingEntitlement(false);
    }
  };

  useEffect(() => {
    fetchAuthoritativeStatus();
  }, [user?.id, supabaseUser?.id]);

  // Sign out all devices state
  const [signOutAllLoading, setSignOutAllLoading] = useState(false);

  // Delete Account Confirmation State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Cloud Sync Engine State
  const [syncState, setSyncState] = useState<SyncState>(() => SyncEngine.getState());

  useEffect(() => {
    return SyncEngine.subscribe((state) => {
      setSyncState(state);
    });
  }, []);

  useEffect(() => {
    setName(user.name || "");
  }, [user.name]);

  useEffect(() => {
    setUsername(user.username || supabaseUser?.user_metadata?.username || "");
  }, [user.username, supabaseUser?.id, supabaseUser?.user_metadata?.username]);

  // Derived Authoritative Entitlement Status
  const isFounder = Boolean(
    user.entitlement?.isFounder ||
      entitlement?.isFounder ||
      user.plan === "Founder" ||
      user.entitlement?.plan === "founder" ||
      entitlement?.plan === "founder" ||
      user.entitlement?.tier === "Founder" ||
      entitlement?.tier === "Founder"
  );
  const founderNum =
    vipClaimedSuccessNum ||
    user.entitlement?.founderNumber ||
    entitlement?.founderNumber ||
    (user as any).founderNumber;
  const founderNumStr = founderNum ? `#${founderNum}` : "Verified";

  const isLifetimePro = !isFounder && Boolean(
    user.entitlement?.isPro ||
    entitlement?.isPro ||
    user.plan === "Pro" ||
    (user.plan as string) === "Lifetime Pro" ||
    user.entitlement?.plan === "lifetime" ||
    entitlement?.plan === "lifetime"
  );

  const isAdmin =
    user?.email?.toLowerCase().trim() === "ash.mary.2006@gmail.com" ||
    user?.role === "admin" ||
    (user as any)?.user_metadata?.role === "admin" ||
    (user as any)?.app_metadata?.role === "admin" ||
    supabaseUser?.email?.toLowerCase().trim() === "ash.mary.2006@gmail.com";

  const latestPayment = paymentRequests.length > 0 ? paymentRequests[0] : null;
  const isPaymentPending = !isFounder && !isLifetimePro && latestPayment?.status === "pending";
  const isPaymentRejected = !isFounder && !isLifetimePro && latestPayment?.status === "rejected";
  const isFree = !isFounder && !isLifetimePro && !isPaymentPending && !isPaymentRejected;

  // Handle Name Update
  const handleSaveName = async () => {
    if (nameLoading) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setNameMsg({ type: "error", text: "Display name must be at least 2 characters." });
      return;
    }
    if (trimmed.length > 80) {
      setNameMsg({ type: "error", text: "Display name cannot exceed 80 characters." });
      return;
    }
    setNameLoading(true);
    setNameMsg(null);
    const res = await updateName(trimmed);
    setNameLoading(false);
    if (res.error) {
      setNameMsg({ type: "error", text: res.error });
    } else {
      setNameMsg({ type: "success", text: "Display name updated successfully." });
      setIsEditingName(false);
      if (addToast) {
        addToast({
          title: "Profile Updated",
          description: `Your display name has been saved as "${trimmed}".`,
          type: "success",
        });
      }
    }
  };

  const handleSaveUsername = async () => {
    if (usernameLoading) return;
    const clean = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(clean)) {
      setUsernameMsg({ type: "error", text: "Use 3–24 lowercase letters, numbers, or underscores." });
      return;
    }
    setUsernameLoading(true);
    setUsernameMsg(null);
    const result = await updateUsername(clean);
    setUsernameLoading(false);
    if (result.error) {
      setUsernameMsg({ type: "error", text: result.error });
    } else {
      setUsername(clean);
      setUsernameMsg({ type: "success", text: "Username updated successfully." });
      setIsEditingUsername(false);
      addToast?.({ title: "Username Updated", description: `Your username is now @${clean}.`, type: "success" });
    }
  };

  // Handle Avatar Selection from Local File
  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      if (addToast) {
        addToast({
          title: "Image Too Large",
          description: "Please choose a profile image smaller than 3MB.",
          type: "error",
        });
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setAvatarLoading(true);
        const res = await updateProfilePicture(base64);
        setAvatarLoading(false);
        if (res.error) {
          if (addToast) {
            addToast({
              title: "Avatar Upload Failed",
              description: res.error,
              type: "error",
            });
          }
        } else {
          setShowAvatarModal(false);
          if (addToast) {
            addToast({
              title: "Avatar Updated",
              description: "Your new profile picture was uploaded and synchronized.",
              type: "success",
            });
          }
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Preset Avatar Selection
  const handlePresetAvatar = async (url: string) => {
    setAvatarLoading(true);
    const res = await updateProfilePicture(url);
    setAvatarLoading(false);
    if (res.error) {
      if (addToast) {
        addToast({ title: "Failed to update avatar", description: res.error, type: "error" });
      }
    } else {
      setShowAvatarModal(false);
      if (addToast) {
        addToast({ title: "Profile Picture Updated", type: "success" });
      }
    }
  };

  // Handle Password Change
  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passLoading) return;
    if (!currentPasswordForPass && (user.provider || supabaseUser?.app_metadata?.provider || "email") === "email") {
      setPassMsg({ type: "error", text: "Please enter your current password." });
      return;
    }
    if (newPassword.length < 8) {
      setPassMsg({ type: "error", text: "New password must be at least 8 characters long." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassMsg({ type: "error", text: "New passwords do not match." });
      return;
    }
    setPassLoading(true);
    setPassMsg(null);
    const res = await changePassword(newPassword, currentPasswordForPass);
    setPassLoading(false);
    if (res.error) {
      setPassMsg({ type: "error", text: res.error });
    } else {
      setPassMsg({ type: "success", text: "Password changed successfully." });
      setCurrentPasswordForPass("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPassModal(false);
        setPassMsg(null);
      }, 1500);
      if (addToast) {
        addToast({
          title: "Password Updated",
          description: "Your account password has been securely updated.",
          type: "success",
        });
      }
    }
  };

  // Handle Email Change
  const handleChangeEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailLoading) return;
    const clean = newEmail.trim().toLowerCase();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setEmailMsg({ type: "error", text: "Please enter a valid email address." });
      return;
    }
    if (clean === (user.email || supabaseUser?.email || "").trim().toLowerCase()) {
      setEmailMsg({ type: "error", text: "Please enter a different email address from your current one." });
      return;
    }
    if (!currentPasswordForEmail && (user.provider || supabaseUser?.app_metadata?.provider || "email") === "email") {
      setEmailMsg({ type: "error", text: "Please enter your current password to verify this change." });
      return;
    }
    setEmailLoading(true);
    setEmailMsg(null);
    const res = await changeEmail(clean, currentPasswordForEmail);
    setEmailLoading(false);
    if (res.error) {
      setEmailMsg({ type: "error", text: res.error });
    } else {
      setCurrentPasswordForEmail("");
      setEmailMsg({
        type: "success",
        text: res.requiresVerification
          ? `Confirmation links have been sent to verify ${clean}. Follow the verification email to complete the change.`
          : "Email updated successfully.",
      });
      if (addToast) {
        addToast({
          title: "Email Verification Sent",
          description: `Check your inbox to verify ${clean}.`,
          type: "info",
        });
      }
    }
  };

  const [showSignOutAllModal, setShowSignOutAllModal] = useState(false);

  // Handle Sign Out from All Devices (confirmed via in-app modal)
  const handleSignOutAll = () => {
    setShowSignOutAllModal(true);
  };

  const confirmSignOutAll = async () => {
    setShowSignOutAllModal(false);
    setSignOutAllLoading(true);
    const res = await signOutAllDevices();
    setSignOutAllLoading(false);
    if (res.error) {
      if (addToast) addToast({ title: "Global Sign Out Failed", description: res.error, type: "error" });
    } else {
      if (addToast) addToast({ title: "Signed Out from All Devices", type: "info" });
    }
  };

  // Handle Permanent Delete Account
  const handleDeleteAccountSubmit = async () => {
    if (deleteConfirmText !== "DELETE") {
      setDeleteError("Please type 'DELETE' exactly to confirm.");
      return;
    }
    setDeleteLoading(true);
    setDeleteError(null);
    const res = await deleteAccount(deletePassword);
    setDeleteLoading(false);
    if (res.error) {
      setDeleteError(res.error);
    } else {
      setShowDeleteModal(false);
      if (addToast) {
        addToast({
          title: "Account Purged",
          description: "Your account and all associated cloud data were permanently erased.",
          type: "info",
        });
      }
    }
  };

  // Calculate Computed Metadata — never fabricate a fake creation date
  const accountCreatedDate = useMemo(() => {
    const raw = user.createdAt || supabaseUser?.created_at;
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [user.createdAt, supabaseUser?.created_at]);

  const storageUsedMB = (indexedCount * 0.42).toFixed(1);
  const storageLimitMB = user.storageLimitMB || 5000;
  const storageUsagePercent = Math.min(100, Math.max(2, (Number(storageUsedMB) / storageLimitMB) * 100));

  const avatarPresets = [
    "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="28" fill="#141714"/><circle cx="60" cy="46" r="22" fill="#B7F36B"/><path d="M26 104c4-20 18-30 34-30s30 10 34 30" fill="#222720" stroke="#30362E" stroke-width="4"/></svg>'),
    "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="28" fill="#1B1F1A"/><polygon points="60,18 98,42 84,96 36,96 22,42" fill="#141714" stroke="#B7F36B" stroke-width="5"/><circle cx="60" cy="58" r="14" fill="#B7F36B"/></svg>'),
    "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="28" fill="#0D0F0D"/><rect x="26" y="26" width="68" height="68" rx="18" fill="#141714" stroke="#B7F36B" stroke-width="4"/><circle cx="48" cy="52" r="7" fill="#F7F8F5"/><circle cx="72" cy="52" r="7" fill="#B7F36B"/><path d="M44 74h32" stroke="#A5AAA1" stroke-width="5" stroke-linecap="round"/></svg>'),
    "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="28" fill="#141714"/><circle cx="60" cy="60" r="34" fill="#1B1F1A" stroke="#30362E" stroke-width="4"/><path d="M40 60h40M60 40v40" stroke="#B7F36B" stroke-width="7" stroke-linecap="round"/></svg>'),
    "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="28" fill="#1B1F1A"/><path d="M28 84L48 40l18 28 12-16 14 32z" fill="#B7F36B"/></svg>'),
    "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="28" fill="#0D0F0D"/><circle cx="60" cy="60" r="32" fill="none" stroke="#B7F36B" stroke-width="6"/><circle cx="60" cy="60" r="14" fill="#F7F8F5"/></svg>'),
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Top Standard Page Hero Header */}
      <PageHeroHeader
        type="account"
        title="Account"
        actions={
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {isAdmin && (
              <button
                id="account-admin-payments-btn"
                onClick={() => setShowAdminModal(true)}
                className="px-3.5 py-2 min-h-[44px] rounded-xl border text-xs font-bold flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40 transition-all cursor-pointer shadow-lg shadow-amber-500/10"
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate whitespace-nowrap">Admin Payments</span>
              </button>
            )}
            <button
              onClick={() => signOut()}
              className={`px-3.5 py-2 min-h-[44px] rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                isDark
                  ? "bg-[#18181B] border-white/10 hover:bg-white/10 text-slate-300 hover:text-white"
                  : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate whitespace-nowrap">Sign Out</span>
            </button>
          </div>
        }
        isDark={isDark}
      />

      {/* Hero Profile Card (Cyber Teal Redesign) */}
      <div
        className="p-6 sm:p-8 rounded-3xl border relative overflow-hidden transition-all bg-[#141714] border-[#30362E] shadow-[6px_6px_16px_rgba(0,0,0,0.65),-2px_-2px_8px_rgba(255,255,255,0.025)]"
      >
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* Avatar with Camera Overlay */}
          <div className="relative group">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden border-2 border-[#30362E] shadow-2xl bg-[#0D0F0D] flex items-center justify-center ring-2 ring-[#B7F36B]/20">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-[#1B1F1A] flex items-center justify-center text-[#B7F36B] text-3xl font-extrabold shadow-inner">
                  {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                </div>
              )}
            </div>

            {/* Quick Camera Change Button */}
            <button
              onClick={() => setShowAvatarModal(true)}
              title="Change Profile Picture"
              className="absolute -bottom-1.5 -right-1.5 p-2.5 rounded-2xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#10130D] shadow-[2px_2px_8px_rgba(0,0,0,0.4)] border-2 border-[#141714] transition-transform group-hover:scale-110 cursor-pointer"
            >
              <Camera className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* User Details & In-Place Name Editor */}
          <div className="flex-1 text-center md:text-left space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                {isEditingName ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveName();
                    }}
                    className="flex items-center gap-2 flex-wrap justify-center md:justify-start"
                  >
                    <label htmlFor="account-display-name-input" className="sr-only">
                      Display Name
                    </label>
                    <input
                      id="account-display-name-input"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter display name"
                      maxLength={80}
                      className="px-3.5 py-1.5 rounded-xl text-base font-bold border outline-none bg-[#0D0F0D] border-[#30362E] focus:border-[#B7F36B] text-[#F7F8F5]"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={nameLoading}
                      className="px-3.5 py-1.5 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#080908] text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {nameLoading ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setName(user.name || "");
                        setNameMsg(null);
                        setIsEditingName(false);
                      }}
                      className="px-3 py-1.5 rounded-xl border border-[#30362E] bg-[#1B1F1A] text-xs font-medium hover:bg-[#222720] cursor-pointer text-[#A5AAA1]"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center justify-center md:justify-start gap-2.5">
                    <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#F7F8F5]">
                      {user.name || "SnapFind User"}
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setName(user.name || "");
                        setNameMsg(null);
                        setIsEditingName(true);
                      }}
                      className="text-xs text-[#B7F36B] hover:underline font-semibold cursor-pointer"
                    >
                      Edit Name
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-center md:justify-start gap-2 text-xs text-[#A5AAA1]">
                  <Mail className="w-3.5 h-3.5 text-[#B7F36B]" />
                  <span className="font-mono text-[#F7F8F5]">{user.email || "No email linked"}</span>
                  {user.emailConfirmedAt && (
                    <span className="flex items-center gap-1 text-[#B7F36B] text-[10px] bg-[#1B1F1A] px-2 py-0.5 rounded-md border border-[#30362E] font-semibold">
                      <CheckCircle2 className="w-3 h-3 text-[#B7F36B]" /> Verified
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs">
                  <span className="text-[#A5AAA1]">Username</span>
                  {isEditingUsername ? (
                    <form onSubmit={(e) => { e.preventDefault(); void handleSaveUsername(); }} className="flex items-center gap-2">
                      <span className="text-[#B7F36B]">@</span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                        placeholder="your_username"
                        minLength={3}
                        maxLength={24}
                        autoComplete="username"
                        className="w-36 px-2.5 py-1 rounded-lg border border-[#30362E] bg-[#0D0F0D] text-[#F7F8F5] outline-none focus:border-[#B7F36B]"
                      />
                      <button type="submit" disabled={usernameLoading} className="text-[#B7F36B] font-semibold disabled:opacity-50">
                        {usernameLoading ? "Saving..." : "Save"}
                      </button>
                      <button type="button" onClick={() => { setUsername(user.username || supabaseUser?.user_metadata?.username || ""); setUsernameMsg(null); setIsEditingUsername(false); }} className="text-[#A5AAA1]">
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="font-mono text-[#F7F8F5]">@{username || "not-set"}</span>
                      <button type="button" onClick={() => { setUsernameMsg(null); setIsEditingUsername(true); }} className="text-[#B7F36B] font-semibold hover:underline">
                        Edit Username
                      </button>
                    </>
                  )}
                  {usernameMsg && <span className={usernameMsg.type === "error" ? "text-rose-400" : "text-[#B7F36B]"}>{usernameMsg.text}</span>}
                </div>
              </div>

              {/* Plan Tier Badge & Action */}
              <div className="flex items-center justify-center gap-2">
                {isFounder ? (
                  <div className="px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 bg-[#1B1F1A] border-[#B7F36B] text-[#B7F36B]">
                    <Crown className="w-3.5 h-3.5 text-[#B7F36B]" />
                    <span>VIP User • Seat {founderNumStr}</span>
                  </div>
                ) : isLifetimePro ? (
                  <div className="px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 bg-[#1B1F1A] border-[#B7F36B] text-[#B7F36B]">
                    <Gem className="w-3.5 h-3.5 text-[#B7F36B]" />
                    <span>Lifetime Pro</span>
                  </div>
                ) : isPaymentPending ? (
                  <div className="px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 bg-amber-950 border-amber-700 text-amber-200">
                    <Clock className="w-3.5 h-3.5 text-amber-300" />
                    <span>Payment Pending</span>
                  </div>
                ) : isPaymentRejected ? (
                  <div className="px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 bg-rose-950 border-rose-700 text-rose-200">
                    <XCircle className="w-3.5 h-3.5 text-rose-300" />
                    <span>Payment Rejected</span>
                  </div>
                ) : (
                  <div className="px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 bg-[#1B1F1A] border-[#30362E] text-[#A5AAA1]">
                    <Sparkles className="w-3.5 h-3.5 text-[#777E74]" />
                    <span>Free Plan</span>
                  </div>
                )}

                {isFree ? (
                  <button
                    type="button"
                    onClick={handleOpenPricing}
                    className="px-3.5 py-1.5 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#080908] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Upgrade to Pro</span>
                  </button>
                ) : isPaymentPending || isPaymentRejected ? (
                  <button
                    type="button"
                    onClick={() => setShowManualPaymentModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-[#F7F8F5] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {isPaymentPending ? "View Payment" : "Re-submit Payment"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenPricing}
                    className="px-3 py-1.5 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-[#A5AAA1] hover:text-[#F7F8F5] text-xs font-medium transition-colors cursor-pointer"
                  >
                    Manage Plan
                  </button>
                )}
              </div>
            </div>

            {nameMsg && (
              <p
                role="status"
                aria-live="polite"
                className={`text-xs font-medium ${
                  nameMsg.type === "success" ? "text-[#B7F36B]" : "text-rose-400"
                }`}
              >
                {nameMsg.text}
              </p>
            )}

            {/* Quick Overview Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#30362E]">
              <div className="p-3 rounded-xl bg-[#0D0F0D] border border-[#30362E]">
                <span className="text-[11px] text-[#A5AAA1] flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#B7F36B]" /> Account Created
                </span>
                <span className="text-xs font-bold text-[#F7F8F5] mt-1 block truncate">
                  {accountCreatedDate || "Unavailable"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#0D0F0D] border border-[#30362E]">
                <span className="text-[11px] text-[#A5AAA1] flex items-center gap-1">
                  <Layers className="w-3 h-3 text-[#B7F36B]" /> Screenshots
                </span>
                <span className="text-xs font-bold text-[#F7F8F5] mt-1 block font-mono">
                  {indexedCount} indexed
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#0D0F0D] border border-[#30362E]">
                <span className="text-[11px] text-[#A5AAA1] flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-[#B7F36B]" /> Cloud Usage
                </span>
                <span className="text-xs font-bold text-[#B7F36B] mt-1 block font-mono">
                  {storageUsedMB} MB / {(storageLimitMB / 1024).toFixed(0)} GB
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#0D0F0D] border border-[#30362E]">
                <span className="text-[11px] text-[#A5AAA1] flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 text-[#B7F36B]" /> Last Sync
                </span>
                <span className="text-xs font-bold text-[#F7F8F5] mt-1 block font-mono">
                  {syncState.lastSyncedAt
                    ? new Date(syncState.lastSyncedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Not synced yet"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Authoritative Entitlement Card */}
      <div className="p-6 rounded-2xl border relative overflow-hidden transition-colors bg-[#141714] border-[#30362E]">
        {isFounder ? (
          /* ================= VIP USER STATE ================= */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E]">
                  <Crown className="w-6 h-6 text-[#B7F36B]" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-[#B7F36B] uppercase tracking-wider">VIP Program Status</span>
                  <h3 className="text-xl sm:text-2xl font-bold text-[#F7F8F5] tracking-tight">
                    {founderNum ? `VIP Member #${founderNum}` : "VIP Member"}
                  </h3>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#B7F36B]/15 text-[#B7F36B] border border-[#B7F36B]/35 self-start sm:self-auto">
                VIP Access • Lifetime Pro
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-[#0D0F0D] border border-[#30362E] space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-[#A5AAA1] font-medium">Screenshot Capacity</span>
                <span className="text-lg font-bold font-mono text-[#B7F36B]">
                  150,000 AI-indexed screenshots
                </span>
              </div>
              <p className="text-xs text-[#A5AAA1] leading-relaxed">
                VIP Program member (Seat {founderNumStr} of 50). Permanent VIP Badge (#1–#50), Lifetime Pro access, and up to 150,000 AI-indexed screenshots free forever.
              </p>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
              <span>Indexed: <strong className="text-white font-mono">{indexedCount}</strong> screenshots</span>
              <button
                onClick={fetchAuthoritativeStatus}
                disabled={isRefreshingEntitlement}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingEntitlement ? "animate-spin" : ""}`} />
                <span>Sync Entitlement</span>
              </button>
            </div>
          </div>
        ) : isLifetimePro ? (
          /* ================= LIFETIME PRO STATE ================= */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E]">
                  <Gem className="w-6 h-6 text-[#B7F36B]" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-[#B7F36B] uppercase tracking-wider">Authoritative Plan</span>
                  <h3 className="text-xl sm:text-2xl font-black text-[#F7F8F5] tracking-tight">Lifetime Pro</h3>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[#B7F36B] text-[#080908] self-start sm:self-auto">
                Active
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-[#1B1F1A] border border-[#30362E] space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-[#A5AAA1] font-medium">Screenshot Capacity</span>
                <span className="text-lg font-bold font-mono text-[#B7F36B]">
                  100,000 AI-indexed screenshots
                </span>
              </div>
              <p className="text-xs text-[#A5AAA1] leading-relaxed">
                One-time purchase (PKR 5,999) • Permanent lifetime access with neural OCR, semantic search, 50 GB encrypted cloud sync, and priority queue.
              </p>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
              <span>Indexed: <strong className="text-white font-mono">{indexedCount}</strong> screenshots</span>
              <button
                onClick={fetchAuthoritativeStatus}
                disabled={isRefreshingEntitlement}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingEntitlement ? "animate-spin" : ""}`} />
                <span>Sync Entitlement</span>
              </button>
            </div>
          </div>
        ) : isPaymentPending ? (
          /* ================= PAYMENT PENDING STATE ================= */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  <Clock className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Payment Status</span>
                  <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">Payment verification pending</h3>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1 self-start sm:self-auto">
                <Clock className="w-3 h-3 animate-spin" /> Pending Review
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
              <p className="text-xs text-amber-200 leading-relaxed">
                Your Lifetime Pro payment confirmation (PKR 5,999) has been submitted and is currently being verified by our team.
              </p>
              {latestPayment && (
                <div className="pt-2 border-t border-amber-500/20 text-[11px] font-mono text-slate-300 space-y-0.5">
                  <div>Transaction ID: <span className="text-white font-bold">{latestPayment.transaction_id || latestPayment.transactionId}</span></div>
                  <div>Payment Method: <span className="text-white font-bold">{latestPayment.payment_method === "easypaisa" ? "Easypaisa" : "Bank Transfer"}</span></div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                onClick={fetchAuthoritativeStatus}
                disabled={isRefreshingEntitlement}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingEntitlement ? "animate-spin" : ""}`} />
                <span>Check Verification Status</span>
              </button>
              <button
                onClick={() => setShowManualPaymentModal(true)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                View Payment Details
              </button>
            </div>
          </div>
        ) : isPaymentRejected ? (
          /* ================= PAYMENT REJECTED STATE ================= */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-400/30">
                  <AlertCircle className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">Payment Status</span>
                  <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">Payment could not be verified</h3>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-400/30 self-start sm:self-auto">
                Verification Failed
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-1.5">
              <p className="text-xs text-rose-200 leading-relaxed">
                {latestPayment?.rejection_reason || latestPayment?.rejectionReason || "Your transaction reference could not be matched with incoming banking records."}
              </p>
              <p className="text-[11px] text-slate-400">
                Please verify your transaction ID / receipt and submit a new confirmation request.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                onClick={() => setShowManualPaymentModal(true)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-rose-600/20"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Submit New Payment Details</span>
              </button>
              <button
                onClick={fetchAuthoritativeStatus}
                disabled={isRefreshingEntitlement}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingEntitlement ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        ) : (
          /* ================= FREE STATE ================= */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E]">
                  <Sparkles className="w-6 h-6 text-[#B7F36B]" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-[#A5AAA1] uppercase tracking-wider">Current Tier</span>
                  <h3 className="text-xl sm:text-2xl font-bold text-[#F7F8F5] tracking-tight">Free Plan</h3>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#1B1F1A] text-[#A5AAA1] border border-[#30362E] self-start sm:self-auto">
                250 lifetime limit
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-[#1B1F1A] border border-[#30362E] space-y-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-[#A5AAA1]">Screenshot Quota</span>
                <span className="text-xl font-bold font-mono text-[#F7F8F5]">
                  {indexedCount} <span className="text-[#A5AAA1] text-sm font-normal">/ 250 screenshots</span>
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#0D0F0D] overflow-hidden">
                <div
                  className="h-full bg-[#B7F36B] rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round((indexedCount / 250) * 100))}%` }}
                />
              </div>
              <p className="text-[11px] text-[#A5AAA1]">
                {indexedCount >= 250
                  ? "You've reached your 250 screenshot Free lifetime limit."
                  : `${Math.max(0, 250 - indexedCount)} free AI-indexed screenshots remaining.`}
              </p>
            </div>

            {/* Server-Authoritative First-50 Lifetime Free VIP Callout (shown ONLY to eligible accounts with pending claim) */}
            {isVipOfferEligible && (
              <div className="p-4 rounded-2xl bg-[#0D0F0D] border border-[#B7F36B]/50 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-[#1B1F1A] border border-[#30362E] text-[#B7F36B]">
                      <Crown className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#F7F8F5]">You&apos;re One of the First 50!</h4>
                      <p className="text-xs text-[#A5AAA1]">
                        Claim Lifetime Free SnapFind Pro access.
                        {isVipStatsLive && !isVipStatsLoading && vipRemaining !== null
                          ? ` (${vipRemaining} of ${vipTotalSpots || 50} claims remaining.)`
                          : " Reserved exclusively for your account."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAccountClaimVip}
                    disabled={isClaimingVip}
                    className="px-4 py-2.5 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#080908] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>{isClaimingVip ? "Activating..." : vipClaimError ? "Retry Claim Lifetime Free" : "Claim Lifetime Free"}</span>
                  </button>
                </div>
                {vipClaimError && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-rose-950 border border-rose-700 text-rose-100 text-xs flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                    <span>{vipClaimError}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                onClick={handleOpenPricing}
                className="flex-1 py-3 px-4 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#080908] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Zap className="w-4 h-4 text-[#080908]" />
                <span>Upgrade to Lifetime Pro (PKR 5,999)</span>
              </button>
              <button
                onClick={fetchAuthoritativeStatus}
                disabled={isRefreshingEntitlement}
                className="px-4 py-3 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-[#F7F8F5] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingEntitlement ? "animate-spin" : ""}`} />
                <span>Refresh Status</span>
              </button>
            </div>
          </div>
        )}

        {/* Usage Card Breakdown */}
        <div className="pt-5 mt-5 border-t border-white/10">
          <YourUsageCard
            user={user}
            isDark={isDark}
            onOpenUpgrade={handleOpenPricing}
            onSyncNow={() => SyncEngine.scheduleSync(0)}
          />
        </div>
      </div>

      {/* Manual Payment History Card */}
      {user && user.id !== "guest" && (
        <PaymentHistoryCard
          user={user}
          isDark={isDark}
          onOpenUpgradeModal={handleOpenPricing}
          addToast={addToast}
        />
      )}

      {/* Administrator Payments Portal Card */}
      {isAdmin && (
        <div
          className={`p-6 rounded-3xl border space-y-4 ${
            isDark
              ? "bg-[#141714] border-[#30362E]"
              : "bg-[#141714] border-[#30362E]"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-white">Admin Payments Management</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E]">
                    /admin/payments
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Review submitted manual bank & Easypaisa transactions, verify receipts, and activate Lifetime Pro.
                </p>
              </div>
            </div>

            <button
              id="account-page-open-admin-payments-btn"
              type="button"
              onClick={() => {
                if (onNavigate) {
                  onNavigate("admin-payments");
                } else {
                  window.location.hash = "#admin/payments";
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#080908] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <ShieldCheck className="w-4 h-4" />
              Open Payments Hub
            </button>
          </div>
        </div>
      )}


      {/* Cloud Storage & Synchronization Progress Banner */}
      <div className="p-6 rounded-2xl border space-y-4 bg-[#141714] border-[#30362E]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E]">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#F7F8F5]">Encrypted Cloud Storage & Sync</h3>
              <p className="text-xs text-[#A5AAA1]">
                Encrypted backup allocation for OCR vectors, embeddings, and media binaries.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => SyncEngine.scheduleSync(0)}
            disabled={syncState.isSyncing}
            className="px-3.5 py-2 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] text-[#B7F36B] border border-[#30362E] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncState.isSyncing ? "animate-spin" : ""}`} />
            <span>Force Sync</span>
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#A5AAA1]">Used: {storageUsedMB} MB</span>
            <span className="text-[#F7F8F5] font-mono font-bold">
              {storageUsagePercent.toFixed(1)}% of {(storageLimitMB / 1024).toFixed(0)} GB Quota
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-[#0D0F0D] overflow-hidden p-0.5 border border-[#30362E]">
            <div
              className="h-full bg-[#B7F36B] rounded-full transition-all duration-300"
              style={{ width: `${storageUsagePercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#A5AAA1] pt-1">
            <span>Local Index Storage: Active</span>
            <span className="text-[#B7F36B] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Encrypted Sync
            </span>
          </div>
        </div>
      </div>

      {/* Account Security Controls */}
      <div className="p-6 rounded-2xl border space-y-5 bg-[#141714] border-[#30362E]">
        <div className="flex items-center gap-3 border-b border-[#30362E] pb-4">
          <div className="p-2.5 rounded-xl bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[#F7F8F5]">Account Security & Credentials</h3>
            <p className="text-xs text-[#A5AAA1]">
              Update your password, change your login email with verification, or manage active sessions.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Change Password Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-[#0D0F0D] border border-[#30362E] gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E]">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-xs text-[#F7F8F5]">Account Password</div>
                <div className="text-[11px] text-[#A5AAA1]">
                  Update your password securely (requires current password verification)
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowPassModal(true);
                setPassMsg(null);
                setCurrentPasswordForPass("");
                setNewPassword("");
                setConfirmPassword("");
                setShowCurrentPass(false);
                setShowNewPass(false);
                setShowConfirmPass(false);
              }}
              className="px-4 py-2 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] text-[#F7F8F5] border border-[#30362E] hover:border-[#B7F36B] text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
            >
              Change Password
            </button>
          </div>

          {/* Change Email Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-[#0D0F0D] border border-[#30362E] gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#1B1F1A] text-[#B7F36B] border border-[#30362E]">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-xs text-[#F7F8F5]">Primary Login Email</div>
                <div className="text-[11px] text-[#A5AAA1]">
                  Current: <span className="font-mono text-[#F7F8F5] font-semibold">{user.email}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowEmailModal(true);
                setEmailMsg(null);
                setNewEmail("");
                setCurrentPasswordForEmail("");
                setShowEmailCurrentPass(false);
              }}
              className="px-4 py-2 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] text-[#B7F36B] border border-[#30362E] hover:border-[#B7F36B] text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
            >
              Change Email
            </button>
          </div>

          {/* Sign Out from All Devices */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-[#0D0F0D] border border-[#30362E] gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#1B1F1A] text-amber-300 border border-[#30362E]">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-xs text-[#F7F8F5]">Global Session Management</div>
                <div className="text-[11px] text-[#A5AAA1]">
                  Revoke active sessions and sign out from all browsers and devices
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOutAll}
              disabled={signOutAllLoading}
              className="px-4 py-2 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] text-amber-300 border border-[#30362E] text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto disabled:opacity-50"
            >
              {signOutAllLoading ? "Signing out..." : "Sign Out All Devices"}
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone: Permanent Account Deletion */}
      <div className="p-6 rounded-2xl border space-y-4 bg-[#141714] border-rose-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-950 text-rose-300 border border-rose-800">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-rose-200">Danger Zone</h3>
            <p className="text-xs text-[#A5AAA1]">
              Irreversible account deletion and cloud data removal.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-[#0D0F0D] border border-rose-900 gap-3">
          <div>
            <div className="font-bold text-xs text-[#F7F8F5]">Delete SnapFind Account Permanently</div>
            <div className="text-[11px] text-[#A5AAA1] mt-0.5">
              Permanently purges your profile, credentials, indexed screenshots, and local cache.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowDeleteModal(true);
              setDeleteConfirmText("");
              setDeletePassword("");
              setDeleteError(null);
            }}
            className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-[#F7F8F5] text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* ================= MODAL: CHANGE PROFILE PICTURE ================= */}
      {showAvatarModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080908]/85"
          role="dialog"
          aria-modal="true"
          aria-labelledby="avatar-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAvatarModal(false);
          }}
        >
          <div className="max-w-md w-full p-6 rounded-2xl bg-[#141714] border border-[#30362E] text-[#F7F8F5] space-y-5">
            <div className="flex items-center justify-between border-b border-[#30362E] pb-4">
              <div className="flex items-center gap-2.5">
                <Camera className="w-5 h-5 text-[#B7F36B]" />
                <h3 id="avatar-modal-title" className="text-base font-bold">Update Profile Picture</h3>
              </div>
              <button
                type="button"
                aria-label="Close avatar dialog"
                onClick={() => setShowAvatarModal(false)}
                className="p-1.5 rounded-lg text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Custom Upload Button */}
            <div className="space-y-2">
              <label htmlFor="account-avatar-file" className="block text-xs font-semibold text-[#F7F8F5]">
                Upload from Device
              </label>
              <input
                id="account-avatar-file"
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleAvatarFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarLoading}
                className="w-full py-3 px-4 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] hover:border-[#B7F36B] text-[#B7F36B] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{avatarLoading ? "Uploading..." : "Choose Image from Device"}</span>
              </button>
            </div>

            {/* Avatar Presets Grid */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-[#F7F8F5]">Or Select a Preset</span>
              <div className="grid grid-cols-6 gap-2">
                {avatarPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePresetAvatar(preset)}
                    disabled={avatarLoading}
                    aria-label={`Select avatar preset ${idx + 1}`}
                    className="w-12 h-12 rounded-xl overflow-hidden border border-[#30362E] hover:border-[#B7F36B] transition-colors cursor-pointer"
                  >
                    <img src={preset} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="px-4 py-2 rounded-xl border border-[#30362E] bg-[#1B1F1A] hover:bg-[#222720] text-[#F7F8F5] text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CHANGE PASSWORD ================= */}
      {showPassModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080908]/85"
          role="dialog"
          aria-modal="true"
          aria-labelledby="change-password-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !passLoading) setShowPassModal(false);
          }}
        >
          <div className="max-w-md w-full p-6 rounded-2xl bg-[#141714] border border-[#30362E] text-[#F7F8F5] space-y-5">
            <div className="flex items-center justify-between border-b border-[#30362E] pb-4">
              <div className="flex items-center gap-2.5">
                <Lock className="w-5 h-5 text-[#B7F36B]" />
                <h3 id="change-password-modal-title" className="text-base font-bold">Change Password</h3>
              </div>
              <button
                type="button"
                aria-label="Close change password dialog"
                onClick={() => !passLoading && setShowPassModal(false)}
                className="p-1.5 rounded-lg text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} noValidate className="space-y-4 text-xs">
              {/* Current Password Re-Auth */}
              <div className="space-y-1.5">
                <label htmlFor="account-current-password" className="block font-semibold text-[#F7F8F5]">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    id="account-current-password"
                    type={showCurrentPass ? "text" : "password"}
                    autoComplete="current-password"
                    value={currentPasswordForPass}
                    onChange={(e) => setCurrentPasswordForPass(e.target.value)}
                    placeholder="Enter your current password"
                    required
                    disabled={passLoading}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#0D0F0D] border border-[#30362E] text-[#F7F8F5] placeholder-[#777E74] outline-none focus:border-[#B7F36B]"
                  />
                  <button
                    type="button"
                    aria-label={showCurrentPass ? "Hide current password" : "Show current password"}
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label htmlFor="account-new-password" className="block font-semibold text-[#F7F8F5]">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="account-new-password"
                    type={showNewPass ? "text" : "password"}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                    minLength={8}
                    disabled={passLoading}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#0D0F0D] border border-[#30362E] text-[#F7F8F5] placeholder-[#777E74] outline-none focus:border-[#B7F36B]"
                  />
                  <button
                    type="button"
                    aria-label={showNewPass ? "Hide new password" : "Show new password"}
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label htmlFor="account-confirm-password" className="block font-semibold text-[#F7F8F5]">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="account-confirm-password"
                    type={showConfirmPass ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    disabled={passLoading}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#0D0F0D] border border-[#30362E] text-[#F7F8F5] placeholder-[#777E74] outline-none focus:border-[#B7F36B]"
                  />
                  <button
                    type="button"
                    aria-label={showConfirmPass ? "Hide confirm password" : "Show confirm password"}
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {passMsg && (
                <p
                  role="alert"
                  aria-live="polite"
                  className={`text-xs font-medium ${
                    passMsg.type === "success" ? "text-[#B7F36B]" : "text-rose-400"
                  }`}
                >
                  {passMsg.text}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPassModal(false)}
                  disabled={passLoading}
                  className="px-4 py-2 rounded-xl border border-[#30362E] bg-[#1B1F1A] hover:bg-[#222720] text-[#F7F8F5] text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passLoading}
                  className="px-5 py-2 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#080908] text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {passLoading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CHANGE EMAIL ================= */}
      {showEmailModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080908]/85"
          role="dialog"
          aria-modal="true"
          aria-labelledby="change-email-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !emailLoading) setShowEmailModal(false);
          }}
        >
          <div className="max-w-md w-full p-6 rounded-2xl bg-[#141714] border border-[#30362E] text-[#F7F8F5] space-y-5">
            <div className="flex items-center justify-between border-b border-[#30362E] pb-4">
              <div className="flex items-center gap-2.5">
                <Mail className="w-5 h-5 text-[#B7F36B]" />
                <h3 id="change-email-modal-title" className="text-base font-bold">Change Email Address</h3>
              </div>
              <button
                type="button"
                aria-label="Close change email dialog"
                onClick={() => !emailLoading && setShowEmailModal(false)}
                className="p-1.5 rounded-lg text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangeEmailSubmit} noValidate className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-[#0D0F0D] border border-[#30362E] text-[#A5AAA1] text-[11px] leading-relaxed">
                For security, a confirmation email will be sent to verify your new address before the change takes effect.
              </div>

              {/* New Email */}
              <div className="space-y-1.5">
                <label htmlFor="account-new-email" className="block font-semibold text-[#F7F8F5]">
                  New Email Address
                </label>
                <input
                  id="account-new-email"
                  type="email"
                  autoComplete="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new-email@example.com"
                  required
                  disabled={emailLoading}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0D0F0D] border border-[#30362E] text-[#F7F8F5] placeholder-[#777E74] outline-none focus:border-[#B7F36B]"
                />
              </div>

              {/* Re-authenticate with Password */}
              <div className="space-y-1.5">
                <label htmlFor="account-email-current-password" className="block font-semibold text-[#F7F8F5]">
                  Current Password (Verification)
                </label>
                <div className="relative">
                  <input
                    id="account-email-current-password"
                    type={showEmailCurrentPass ? "text" : "password"}
                    autoComplete="current-password"
                    value={currentPasswordForEmail}
                    onChange={(e) => setCurrentPasswordForEmail(e.target.value)}
                    placeholder="Enter current password"
                    required
                    disabled={emailLoading}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#0D0F0D] border border-[#30362E] text-[#F7F8F5] placeholder-[#777E74] outline-none focus:border-[#B7F36B]"
                  />
                  <button
                    type="button"
                    aria-label={showEmailCurrentPass ? "Hide current password" : "Show current password"}
                    onClick={() => setShowEmailCurrentPass(!showEmailCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
                  >
                    {showEmailCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {emailMsg && (
                <p
                  role="alert"
                  aria-live="polite"
                  className={`text-xs font-medium ${
                    emailMsg.type === "success" ? "text-[#B7F36B]" : "text-rose-400"
                  }`}
                >
                  {emailMsg.text}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  disabled={emailLoading}
                  className="px-4 py-2 rounded-xl border border-[#30362E] bg-[#1B1F1A] hover:bg-[#222720] text-[#F7F8F5] text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={emailLoading}
                  className="px-5 py-2 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#080908] text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {emailLoading ? "Sending Verification..." : "Send Verification"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE ACCOUNT ================= */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080908]/85"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteLoading) setShowDeleteModal(false);
          }}
        >
          <div className="max-w-md w-full p-6 rounded-2xl bg-[#141714] border border-rose-700 text-[#F7F8F5] space-y-5">
            <div className="flex items-center gap-3 text-rose-300">
              <div className="p-3 rounded-xl bg-rose-950 border border-rose-800">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 id="delete-account-modal-title" className="text-lg font-bold text-[#F7F8F5]">
                  Delete Account Permanently
                </h3>
                <p className="text-xs text-[#A5AAA1]">This action is irreversible.</p>
              </div>
            </div>

            <p className="text-xs text-[#A5AAA1] leading-relaxed">
              This will permanently delete your user profile, purge all indexed screenshot metadata, delete cloud storage images, and reset your local database.
            </p>

            <div className="space-y-3 text-xs">
              {/* Current Password Re-Auth (Email accounts only) */}
              {(user.provider || supabaseUser?.app_metadata?.provider || "email") === "email" && (
                <div className="space-y-1">
                  <label htmlFor="account-delete-password" className="block font-semibold text-[#F7F8F5]">
                    Confirm Current Password
                  </label>
                  <input
                    id="account-delete-password"
                    type="password"
                    autoComplete="current-password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0D0F0D] border border-[#30362E] text-[#F7F8F5] placeholder-[#777E74] outline-none focus:border-rose-500"
                  />
                </div>
              )}

              {/* Type DELETE */}
              <div className="space-y-1">
                <label htmlFor="account-delete-confirm" className="block font-semibold text-[#F7F8F5]">
                  Type <span className="text-rose-400 font-mono font-bold">DELETE</span> to confirm
                </label>
                <input
                  id="account-delete-confirm"
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0D0F0D] border border-[#30362E] text-[#F7F8F5] placeholder-[#777E74] outline-none focus:border-rose-500"
                />
              </div>

              {deleteError && <p role="alert" className="text-xs text-rose-400 font-medium">{deleteError}</p>}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccountSubmit}
                disabled={deleteLoading || deleteConfirmText !== "DELETE"}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer disabled:opacity-40 shadow-lg shadow-rose-600/40"
              >
                {deleteLoading ? "Purging Account..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Submission & Verification Modal */}
      <ManualPaymentModal
        isOpen={showManualPaymentModal}
        onClose={() => setShowManualPaymentModal(false)}
        user={user}
        isDark={isDark}
        onOpenAuth={onOpenAuth}
        onPaymentSubmitted={(req) => {
          setPaymentRequests((prev) => [req, ...prev]);
          fetchAuthoritativeStatus();
        }}
        addToast={addToast}
      />

      {/* Sign Out All Devices Confirmation Modal */}
      {showSignOutAllModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#141714] border border-[#30362E] p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-[#F7F8F5]">Sign out from all devices?</h3>
            <p className="text-xs text-[#A5AAA1] leading-relaxed">
              This will invalidate all active sessions across your web and mobile devices. You will need to sign in again.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSignOutAllModal(false)}
                className="px-4 py-2 rounded-xl border border-[#30362E] hover:bg-[#1B1F1A] text-xs font-medium text-[#A5AAA1] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSignOutAll}
                className="px-4 py-2 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#080908] text-xs font-bold cursor-pointer"
              >
                Sign Out All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Payment Requests Review Modal */}
      <AdminPaymentRequestsModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        user={user}
        isDark={isDark}
        addToast={addToast}
        onPaymentApproved={() => {
          fetchAuthoritativeStatus();
          SubscriptionManager.syncEntitlementsFromServer();
        }}
      />
    </div>
  );
};

