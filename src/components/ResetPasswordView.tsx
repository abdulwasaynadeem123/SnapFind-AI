import React, { useState, useRef } from "react";
import {
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Mail,
  KeyRound,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { SnapFindLogo } from "./SnapFindLogo";
import { NavViewType } from "./BottomNavigation";

interface ResetPasswordViewProps {
  onNavigate: (view: NavViewType) => void;
  onOpenAuth: (mode?: "login" | "register") => void;
  addToast?: (msg: { title: string; description?: string; type: "success" | "error" | "info" | "warning" }) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ResetPasswordView: React.FC<ResetPasswordViewProps> = ({
  onNavigate,
  onOpenAuth,
  addToast,
}) => {
  const {
    session,
    loading,
    isRecoveryMode,
    setIsRecoveryMode,
    changePassword,
    resetPassword,
    oauthErrorMessage,
    clearOauthError,
  } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [requestEmail, setRequestEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(oauthErrorMessage);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [passwordUpdated, setPasswordUpdated] = useState(false);

  const isSubmittingRef = useRef(false);

  const hasValidRecoverySession = Boolean(session && (isRecoveryMode || !passwordUpdated));

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSubmitting) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    if (oauthErrorMessage) clearOauthError();

    if (!newPassword || newPassword.length < 8) {
      setErrorMsg("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please enter the same password twice.");
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const res = await changePassword(newPassword);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setIsRecoveryMode(false);
        setPasswordUpdated(true);
        setNewPassword("");
        setConfirmPassword("");
        setSuccessMsg("Your password has been securely updated. You can now continue to your SnapFind AI account.");
        addToast?.({
          title: "Password Reset Complete",
          description: "Your new password is active.",
          type: "success",
        });
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Unable to update your password. Please try again.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleRequestNewLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSubmitting) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = requestEmail.trim();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      setErrorMsg("Please enter a valid registered email address.");
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const res = await resetPassword(cleanEmail);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(
          `A fresh password reset link has been sent to ${cleanEmail}. Check your inbox and open the link to set your new password.`
        );
        addToast?.({
          title: "Reset Email Sent",
          description: `Check ${cleanEmail} for the password reset link.`,
          type: "success",
        });
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const meetsLength = newPassword.length >= 8;
  const passwordsMatch = Boolean(confirmPassword) && newPassword === confirmPassword;

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-[#141714] border border-[#30362E] p-6 sm:p-8 text-[#F7F8F5]">
        {/* Brand Header */}
        <div className="flex items-center gap-2.5 mb-6">
          <SnapFindLogo size={32} />
          <span className="text-sm font-bold tracking-tight text-[#F7F8F5]">SnapFind AI</span>
        </div>

        {loading ? (
          <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-7 h-7 text-[#B7F36B] animate-spin" />
            <p className="text-sm font-medium text-[#A5AAA1]">Verifying your secure reset link...</p>
          </div>
        ) : passwordUpdated ? (
          <div className="space-y-5">
            <div className="w-12 h-12 rounded-xl bg-[#1B1F1A] border border-[#B7F36B] flex items-center justify-center text-[#B7F36B]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#F7F8F5]">Password updated</h1>
              <p className="text-sm text-[#A5AAA1] mt-1.5 leading-relaxed">
                {successMsg || "Your password has been updated securely."}
              </p>
            </div>
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => onNavigate("gallery")}
                className="w-full py-3 px-4 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#080908] text-sm font-bold transition-colors cursor-pointer"
              >
                Go to Gallery
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate("landing");
                  onOpenAuth("login");
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-[#F7F8F5] text-sm font-semibold transition-colors cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </div>
        ) : hasValidRecoverySession ? (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-[#F7F8F5]">Set a new password</h1>
              <p className="text-sm text-[#A5AAA1] mt-1 leading-relaxed">
                Enter and confirm your new password below. Your password is encrypted and never stored in plain text.
              </p>
            </div>

            {errorMsg && (
              <div
                role="alert"
                aria-live="polite"
                className="mb-4 p-3.5 rounded-xl bg-rose-950 border border-rose-700 text-rose-100 text-xs flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSetNewPassword} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="reset-new-password" className="block text-xs font-semibold text-[#F7F8F5]">
                  New Password
                </label>
                <div className="relative">
                  <Lock
                    className="w-4 h-4 text-[#777E74] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="reset-new-password"
                    type={showNewPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="Minimum 8 characters"
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-[#0D0F0D] border border-[#30362E] focus:border-[#B7F36B] focus:outline-none text-sm text-[#F7F8F5] placeholder-[#777E74] disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reset-confirm-password" className="block text-xs font-semibold text-[#F7F8F5]">
                  Confirm New Password
                </label>
                <div className="relative">
                  <ShieldCheck
                    className="w-4 h-4 text-[#777E74] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="reset-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="Re-enter your new password"
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-[#0D0F0D] border border-[#30362E] focus:border-[#B7F36B] focus:outline-none text-sm text-[#F7F8F5] placeholder-[#777E74] disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Requirement Indicators */}
              <div className="p-3 rounded-xl bg-[#0D0F0D] border border-[#30362E] space-y-1.5 text-xs">
                <div className={`flex items-center gap-2 ${meetsLength ? "text-[#B7F36B]" : "text-[#777E74]"}`}>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>At least 8 characters</span>
                </div>
                <div className={`flex items-center gap-2 ${passwordsMatch ? "text-[#B7F36B]" : "text-[#777E74]"}`}>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Passwords match</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#080908] text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isSubmitting ? "Updating password..." : "Update Password"}</span>
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-[#F7F8F5]">Reset your password</h1>
              <p className="text-sm text-[#A5AAA1] mt-1 leading-relaxed">
                This reset session is missing or expired. Enter your registered email address to request a fresh secure reset link.
              </p>
            </div>

            {errorMsg && (
              <div
                role="alert"
                aria-live="polite"
                className="mb-4 p-3.5 rounded-xl bg-rose-950 border border-rose-700 text-rose-100 text-xs flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div
                role="status"
                aria-live="polite"
                className="mb-4 p-3.5 rounded-xl bg-[#1B1F1A] border border-[#B7F36B] text-[#F7F8F5] text-xs flex items-start gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleRequestNewLink} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="reset-request-email" className="block text-xs font-semibold text-[#F7F8F5]">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail
                    className="w-4 h-4 text-[#777E74] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="reset-request-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0D0F0D] border border-[#30362E] focus:border-[#B7F36B] focus:outline-none text-sm text-[#F7F8F5] placeholder-[#777E74] disabled:opacity-60"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#080908] text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                <span>{isSubmitting ? "Sending reset link..." : "Send Reset Link"}</span>
              </button>
            </form>
          </>
        )}

        <div className="mt-6 pt-4 border-t border-[#30362E] flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => onNavigate("landing")}
            className="inline-flex items-center gap-1.5 text-[#A5AAA1] hover:text-[#F7F8F5] font-medium cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigate("landing");
              onOpenAuth("login");
            }}
            className="font-semibold text-[#B7F36B] hover:underline cursor-pointer"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
