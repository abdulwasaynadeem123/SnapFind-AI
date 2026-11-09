import React, { useState } from "react";
import {
  User,
  Palette,
  Shield,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Lock,
  LogOut,
  Moon,
  Sun,
  Trash2,
  Loader2,
  Check,
} from "lucide-react";
import { AppSettings, UserProfile, ScreenshotItem } from "../types";
import { useAuth } from "../context/AuthContext";
import { PageHeroHeader } from "./PageHeroHeader";

export type SettingsSectionId = "account" | "appearance" | "privacy" | "preferences";

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  user: UserProfile;
  isDark: boolean;
  indexedCount: number;
  onResetAllData: () => void;
  onOpenAuth?: () => void;
  screenshots?: ScreenshotItem[];
  initialSection?: SettingsSectionId;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  user,
  isDark = true,
  indexedCount,
  onResetAllData,
  onOpenAuth,
  initialSection = "account",
}) => {
  const [activeTab, setActiveTab] = useState<SettingsSectionId>(initialSection);
  const { updateName, changePassword, signOut, deleteAccount } = useAuth();

  // Name edit state
  const [nameInput, setNameInput] = useState(user.name || "");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [passMsg, setPassMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Clear data confirmation modal
  const [showClearDataModal, setShowClearDataModal] = useState(false);

  // Delete account modal
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setNameLoading(true);
    setNameMsg(null);
    const res = await updateName(nameInput.trim());
    setNameLoading(false);
    if (res.error) {
      setNameMsg({ type: "error", text: res.error });
    } else {
      setNameMsg({ type: "success", text: "Name updated." });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPassMsg({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassMsg({ type: "error", text: "Passwords do not match." });
      return;
    }
    setPassLoading(true);
    setPassMsg(null);
    const res = await changePassword(newPassword);
    setPassLoading(false);
    if (res.error) {
      setPassMsg({ type: "error", text: res.error });
    } else {
      setPassMsg({ type: "success", text: "Password updated successfully." });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError("Please enter your current password to confirm.");
      return;
    }
    setDeleteLoading(true);
    setDeleteError(null);
    const res = await deleteAccount(deletePassword);
    setDeleteLoading(false);
    if (res.error) {
      setDeleteError(res.error);
    } else {
      setShowDeleteAccountModal(false);
    }
  };

  const tabs: { id: SettingsSectionId; label: string; icon: any }[] = [
    { id: "account", label: "Account", icon: User },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "privacy", label: "Privacy", icon: Shield },
    { id: "preferences", label: "Preferences", icon: Sliders },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 px-3 sm:px-4">
      <PageHeroHeader
        type="settings"
        title="Settings"
        isDark={isDark}
      />

      {/* Clean Tab Bar */}
      <div className="flex items-center gap-2 border-b border-[#334155] pb-3 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-[#116466] text-[#F1F5F9] border border-[#116466] shadow-md shadow-[#116466]/20"
                  : "bg-[#1E293B] text-[#94A3B8] border border-[#334155] hover:text-[#F1F5F9] hover:border-[#116466]"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. ACCOUNT SETTINGS */}
      {activeTab === "account" && (
        <div className="space-y-6">
          {user.isLoggedIn ? (
            <>
              {/* Profile info */}
              <div className="bg-[#1E293B] rounded-2xl p-6 border border-[#334155] shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-[#F1F5F9]">Profile Information</h3>
                <form onSubmit={handleUpdateName} className="space-y-4 max-w-md">
                  <div className="space-y-1.5 text-xs">
                    <label className="text-[#94A3B8] font-medium">Display Name</label>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F19]/80 border border-[#334155] focus:border-[#116466] text-xs text-[#F1F5F9] outline-none"
                    />
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <label className="text-[#94A3B8] font-medium">Email</label>
                    <input
                      type="email"
                      value={user.email}
                      disabled
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F19]/40 border border-[#334155] text-xs text-[#94A3B8] cursor-not-allowed"
                    />
                  </div>

                  {nameMsg && (
                    <div
                      className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                        nameMsg.type === "success"
                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      {nameMsg.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{nameMsg.text}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={nameLoading}
                    className="px-4 py-2 rounded-xl bg-[#116466] hover:bg-[#116466]/90 text-[#F1F5F9] text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    {nameLoading ? "Saving..." : "Save Name"}
                  </button>
                </form>
              </div>

              {/* Change Password */}
              <div className="bg-[#1E293B] rounded-2xl p-6 border border-[#334155] shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-[#F1F5F9]">Change Password</h3>
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                  <div className="space-y-1.5 text-xs">
                    <label className="text-[#94A3B8] font-medium">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F19]/80 border border-[#334155] focus:border-[#116466] text-xs text-[#F1F5F9] outline-none"
                    />
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <label className="text-[#94A3B8] font-medium">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F19]/80 border border-[#334155] focus:border-[#116466] text-xs text-[#F1F5F9] outline-none"
                    />
                  </div>

                  {passMsg && (
                    <div
                      className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                        passMsg.type === "success"
                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      {passMsg.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{passMsg.text}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={passLoading || !newPassword}
                    className="px-4 py-2 rounded-xl bg-[#116466] hover:bg-[#116466]/90 text-[#F1F5F9] text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    {passLoading ? "Updating..." : "Update Password"}
                  </button>
                </form>
              </div>

              {/* Sign out */}
              <div className="bg-[#1E293B] rounded-2xl p-6 border border-[#334155] shadow-xl flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#F1F5F9]">Sign Out</h3>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Sign out of your active session on this device.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="px-4 py-2 rounded-xl bg-[#0B0F19] hover:bg-[#2C3531] text-rose-400 border border-rose-500/30 hover:border-rose-500/60 text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </>
          ) : (
            /* Guest View */
            <div className="bg-[#1E293B] rounded-2xl p-6 border border-[#334155] shadow-xl text-center space-y-3">
              <User className="w-10 h-10 mx-auto text-[#D1E8E2] opacity-80" />
              <h3 className="text-sm font-bold text-[#F1F5F9]">Guest Session</h3>
              <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
                You are currently browsing as a guest with private local storage. Sign in or create an account to back up and sync across devices.
              </p>
              {onOpenAuth && (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="px-5 py-2.5 rounded-xl bg-[#116466] hover:bg-[#116466]/90 text-[#F1F5F9] text-xs font-bold transition-all shadow-md shadow-[#116466]/20 cursor-pointer"
                >
                  Sign in or Create Account
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. APPEARANCE SETTINGS */}
      {activeTab === "appearance" && (
        <div className="space-y-6">
          <div className="bg-[#1E293B] rounded-2xl p-6 border border-[#334155] shadow-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#F1F5F9]">Theme</h3>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Select your preferred visual style.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
              <button
                type="button"
                onClick={() => onUpdateSettings({ theme: "dark" })}
                className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  settings.theme === "dark" || isDark
                    ? "bg-[#116466]/20 border-[#116466] text-[#F1F5F9] shadow-md shadow-[#116466]/20"
                    : "bg-[#0B0F19]/60 border-[#334155] text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
              >
                <div className="p-2 rounded-lg bg-[#0B0F19] border border-[#334155]">
                  <Moon className="w-5 h-5 text-[#D1E8E2]" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#F1F5F9]">Dark Mode</div>
                  <div className="text-[11px] text-[#94A3B8]">Forest Slate & Cyber Teal</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ theme: "light" })}
                className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  settings.theme === "light" && !isDark
                    ? "bg-[#116466]/20 border-[#116466] text-[#F1F5F9] shadow-md shadow-[#116466]/20"
                    : "bg-[#0B0F19]/60 border-[#334155] text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
              >
                <div className="p-2 rounded-lg bg-[#0B0F19] border border-[#334155]">
                  <Sun className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#F1F5F9]">Light Mode</div>
                  <div className="text-[11px] text-[#94A3B8]">Clean high-contrast theme</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. PRIVACY SETTINGS */}
      {activeTab === "privacy" && (
        <div className="space-y-6">
          {/* Gallery Permission Status */}
          <div className="bg-[#1E293B] rounded-2xl p-6 border border-[#334155] shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#F1F5F9]">Gallery Permission Status</h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Screenshots are stored locally in your browser sandbox.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Protected</span>
              </span>
            </div>
            <div className="text-xs text-[#94A3B8] leading-relaxed pt-2 border-t border-[#334155]">
              SnapFind uses the browser device storage API. Your images remain private on your computer or phone and are not silently accessed without your explicit selection.
            </div>
          </div>

          {/* Data Deletion */}
          <div className="bg-[#1E293B] rounded-2xl p-6 border border-[#334155] shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-[#F1F5F9]">Data Management</h3>

            {/* Clear All Data */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#0B0F19]/60 border border-[#334155]">
              <div>
                <div className="text-xs font-bold text-[#F1F5F9]">Reset Local Gallery</div>
                <div className="text-[11px] text-[#94A3B8] mt-0.5">
                  Removes all {indexedCount} screenshots and local cache from this device.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowClearDataModal(true)}
                className="px-4 py-2 rounded-xl bg-[#0B0F19] hover:bg-rose-950/40 text-rose-400 border border-rose-500/30 hover:border-rose-500/60 text-xs font-semibold transition-all cursor-pointer self-start sm:self-auto shrink-0"
              >
                Clear Gallery
              </button>
            </div>

            {/* Delete Account (if logged in) */}
            {user.isLoggedIn && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#0B0F19]/60 border border-rose-500/20">
                <div>
                  <div className="text-xs font-bold text-rose-300">Delete Account Permanently</div>
                  <div className="text-[11px] text-[#94A3B8] mt-0.5">
                    Purges your user profile, cloud-synced screenshots, and credentials.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeleteAccountModal(true)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer self-start sm:self-auto shrink-0 shadow-md shadow-rose-600/30"
                >
                  Delete Account
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. PREFERENCES SETTINGS */}
      {activeTab === "preferences" && (
        <div className="space-y-6">
          <div className="bg-[#1E293B] rounded-2xl p-6 border border-[#334155] shadow-xl space-y-5">
            <h3 className="text-sm font-bold text-[#F1F5F9]">App Preferences</h3>

            <div className="space-y-4">
              {/* Auto-index toggle */}
              <div className="flex items-center justify-between gap-4 py-2 border-b border-[#334155]/60">
                <div>
                  <div className="text-xs font-semibold text-[#F1F5F9]">Automatic OCR &amp; Indexing</div>
                  <div className="text-[11px] text-[#94A3B8]">
                    Automatically analyze text and categorize images when added to the gallery.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ autoIndexNewScreenshots: !settings.autoIndexNewScreenshots })
                  }
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    settings.autoIndexNewScreenshots ? "bg-[#116466]" : "bg-[#334155]"
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.autoIndexNewScreenshots ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Confirm before delete toggle */}
              <div className="flex items-center justify-between gap-4 py-2 border-b border-[#334155]/60">
                <div>
                  <div className="text-xs font-semibold text-[#F1F5F9]">Confirm Before Delete</div>
                  <div className="text-[11px] text-[#94A3B8]">
                    Show a confirmation prompt before removing screenshots.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ confirmBeforeDelete: !settings.confirmBeforeDelete })
                  }
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    settings.confirmBeforeDelete ? "bg-[#116466]" : "bg-[#334155]"
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.confirmBeforeDelete ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Audio feedback toggle */}
              <div className="flex items-center justify-between gap-4 py-2 border-b border-[#334155]/60">
                <div>
                  <div className="text-xs font-semibold text-[#F1F5F9]">Sound Effects</div>
                  <div className="text-[11px] text-[#94A3B8]">
                    Play subtle audio cues for key actions and completion alerts.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    settings.soundEnabled ? "bg-[#116466]" : "bg-[#334155]"
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.soundEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Compact grid view toggle */}
              <div className="flex items-center justify-between gap-4 py-2">
                <div>
                  <div className="text-xs font-semibold text-[#F1F5F9]">Compact Gallery Grid</div>
                  <div className="text-[11px] text-[#94A3B8]">
                    Display smaller thumbnail cards to fit more screenshots on screen.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ compactGridView: !settings.compactGridView })
                  }
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                    settings.compactGridView ? "bg-[#116466]" : "bg-[#334155]"
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.compactGridView ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Gallery Confirmation Modal */}
      {showClearDataModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-[#1E293B] border border-[#334155] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-[#F1F5F9]">Reset Local Gallery?</h3>
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              This will remove all {indexedCount} screenshots and clear the local search index from this browser. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowClearDataModal(false)}
                className="px-4 py-2 rounded-xl bg-[#0B0F19] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#334155] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetAllData();
                  setShowClearDataModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                Yes, Reset Gallery
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-[#1E293B] border border-rose-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-[#F1F5F9]">Delete Account Permanently</h3>
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              All your cloud backups, user records, and settings will be permanently erased. Please enter your current password to confirm.
            </p>

            <div className="space-y-1.5 text-xs">
              <label className="text-[#94A3B8] font-medium">Current Password</label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F19] border border-[#334155] focus:border-rose-500 text-xs text-[#F1F5F9] outline-none"
              />
            </div>

            {deleteError && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  setDeletePassword("");
                  setDeleteError(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#0B0F19] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#334155] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteLoading || !deletePassword}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {deleteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
