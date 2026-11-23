import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { SnapFindLogo } from "./SnapFindLogo";

export type AuthModalMode = "login" | "register" | "forgot_password" | "reset_password";

interface AuthModalProps {
  onClose: () => void;
  isDark?: boolean;
  initialMode?: AuthModalMode;
  addToast?: (msg: { title: string; description?: string; type: "success" | "error" | "info" | "warning" }) => void;
  onSignupSuccess?: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AuthModal: React.FC<AuthModalProps> = ({
  onClose,
  initialMode = "login",
  addToast,
  onSignupSuccess,
}) => {
  const {
    user,
    isRecoveryMode,
    setIsRecoveryMode,
    signInWithEmail,
    signUpWithEmail,
    resendVerificationEmail,
    signInWithGoogle,
    signOut,
    resetPassword,
    changePassword,
    oauthErrorMessage,
    clearOauthError,
  } = useAuth();

  const [mode, setMode] = useState<AuthModalMode>(isRecoveryMode ? "reset_password" : initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showResendOption, setShowResendOption] = useState(false);

  const isSubmittingRef = useRef(false);
  const primaryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isRecoveryMode) {
      setMode("reset_password");
    } else {
      setMode(initialMode);
    }
  }, [initialMode, isRecoveryMode]);

  useEffect(() => {
    if (oauthErrorMessage) {
      setErrorMsg(oauthErrorMessage);
    }
  }, [oauthErrorMessage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isLoading]);

  useEffect(() => {
    primaryInputRef.current?.focus();
  }, [mode]);

  const switchMode = (nextMode: AuthModalMode) => {
    if (isLoading) return;
    setMode(nextMode);
    setErrorMsg(null);
    setSuccessMsg(null);
    setShowResendOption(false);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    if (oauthErrorMessage) clearOauthError();
  };

  const handleClose = () => {
    if (isLoading) return;
    if (oauthErrorMessage) clearOauthError();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setShowResendOption(false);

    if (mode === "forgot_password") {
      const cleanEmail = email.trim();
      if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
        setErrorMsg("Please enter a valid registered email address.");
        return;
      }

      isSubmittingRef.current = true;
      setIsLoading(true);
      try {
        const res = await resetPassword(cleanEmail);
        if (res.error) {
          setErrorMsg(res.error);
        } else {
          setSuccessMsg(
            `Password reset instructions have been sent to ${cleanEmail}. Open the link in your email to set a new password.`
          );
          addToast?.({
            title: "Password Reset Email Sent",
            description: `Check ${cleanEmail} for your secure reset link.`,
            type: "success",
          });
        }
      } finally {
        isSubmittingRef.current = false;
        setIsLoading(false);
      }
      return;
    }

    if (mode === "reset_password") {
      if (!password || password.length < 8) {
        setErrorMsg("New password must be at least 8 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg("Passwords do not match. Please re-enter both fields.");
        return;
      }

      isSubmittingRef.current = true;
      setIsLoading(true);
      try {
        const res = await changePassword(password);
        if (res.error) {
          setErrorMsg(res.error);
        } else {
          setIsRecoveryMode(false);
          setSuccessMsg("Your password has been updated. You can now sign in with your new password.");
          addToast?.({
            title: "Password Updated",
            description: "Your account password was changed successfully.",
            type: "success",
          });
          setPassword("");
          setConfirmPassword("");
          setMode("login");
        }
      } finally {
        isSubmittingRef.current = false;
        setIsLoading(false);
      }
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    if (mode === "register") {
      if (!password || password.length < 8) {
        setErrorMsg("Password must be at least 8 characters long.");
        return;
      }
      if (!confirmPassword) {
        setErrorMsg("Please confirm your password.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg("Passwords do not match.");
        return;
      }
    } else if (!password) {
      setErrorMsg("Please enter your password.");
      return;
    }

    isSubmittingRef.current = true;
    setIsLoading(true);
    try {
      if (mode === "login") {
        const res = await signInWithEmail(cleanEmail, password);
        if (res.error) {
          setErrorMsg(res.error);
          if (res.isUnconfirmedEmail) {
            setShowResendOption(true);
          }
        } else {
          addToast?.({
            title: "Signed In",
            description: "Welcome back to SnapFind AI.",
            type: "success",
          });
          onClose();
        }
      } else {
        const res = await signUpWithEmail(cleanEmail, password, name.trim());
        if (res.error) {
          setErrorMsg(res.error);
        } else if (res.requiresVerification) {
          setSuccessMsg(
            res.message ||
              "Account created! Verify your email to secure your account. Your First 50 Lifetime Free eligibility is counted after verification; sign in afterward and the claim popup will appear automatically."
          );
          setShowResendOption(true);
          setPassword("");
          setConfirmPassword("");
        } else {
          if (onSignupSuccess) {
            onSignupSuccess();
          } else {
            addToast?.({
              title: "Account Created",
              description: "Welcome to SnapFind AI.",
              type: "success",
            });
          }
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected authentication error occurred.");
    } finally {
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      setErrorMsg("Please enter your email address first.");
      return;
    }
    if (isResending) return;
    setIsResending(true);
    setErrorMsg(null);
    try {
      const res = await resendVerificationEmail(cleanEmail);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(`Verification link resent to ${cleanEmail}. Check your inbox and spam folder.`);
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSubmittingRef.current || isLoading) return;
    isSubmittingRef.current = true;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await signInWithGoogle();
      if (res.error) {
        setErrorMsg(res.error);
      }
    } finally {
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await signOut();
      addToast?.({
        title: "Signed Out",
        description: "You have been signed out of SnapFind AI.",
        type: "info",
      });
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const isAuthenticatedUser = Boolean(user && user.isLoggedIn && user.id !== "guest");

  // Signed-in quick summary dialog (unless completing a password reset)
  if (isAuthenticatedUser && mode !== "reset_password") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080908]/85"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-account-modal-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <div className="relative w-full max-w-md rounded-2xl bg-[#141714] border border-[#30362E] p-6 sm:p-7 text-[#F7F8F5]">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close dialog"
            className="absolute top-4 right-4 p-2 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] text-[#A5AAA1] hover:text-[#F7F8F5] border border-[#30362E] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#1B1F1A] border border-[#30362E] flex items-center justify-center text-[#B7F36B] font-bold text-2xl overflow-hidden">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                (user?.name || "U").charAt(0).toUpperCase()
              )}
            </div>

            <div>
              <h2 id="auth-account-modal-title" className="text-xl font-bold text-[#F7F8F5]">
                {user?.name}
              </h2>
              <p className="text-sm text-[#A5AAA1] mt-0.5">{user?.email}</p>
            </div>

            <div className="w-full p-3.5 rounded-xl bg-[#0D0F0D] border border-[#30362E] flex items-center justify-between text-xs">
              <span className="text-[#A5AAA1]">Current Plan</span>
              <span className="font-semibold text-[#B7F36B]">{user?.plan || "Free"}</span>
            </div>

            <div className="w-full flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-700 text-rose-100 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                Sign Out
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 px-4 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-[#F7F8F5] text-sm font-semibold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const modalTitle =
    mode === "login"
      ? "Sign in to SnapFind AI"
      : mode === "register"
      ? "Create your SnapFind AI account"
      : mode === "forgot_password"
      ? "Reset your password"
      : "Set a new password";

  const modalSubtitle =
    mode === "login"
      ? "Access your searchable screenshot library across sessions."
      : mode === "register"
      ? "Start indexing and finding any screenshot in seconds."
      : mode === "forgot_password"
      ? "Enter your registered email and we will send you a secure reset link."
      : "Choose a strong new password for your account.";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080908]/85 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-heading"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="relative w-full max-w-md my-auto rounded-2xl bg-[#141714] border border-[#30362E] p-6 sm:p-7 text-[#F7F8F5]">
        <button
          type="button"
          onClick={handleClose}
          disabled={isLoading}
          aria-label="Close authentication dialog"
          className="absolute top-4 right-4 p-2 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] text-[#A5AAA1] hover:text-[#F7F8F5] border border-[#30362E] transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand & Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-4">
            <SnapFindLogo size={32} />
            <span className="text-sm font-bold tracking-tight text-[#F7F8F5]">SnapFind AI</span>
          </div>

          <h2 id="auth-modal-heading" className="text-2xl font-bold tracking-tight text-[#F7F8F5]">
            {modalTitle}
          </h2>
          <p className="text-sm text-[#A5AAA1] mt-1 leading-relaxed">{modalSubtitle}</p>
        </div>

        {/* Status Messages */}
        {errorMsg && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-4 p-3.5 rounded-xl bg-rose-950 border border-rose-700 text-rose-100 text-xs leading-relaxed flex flex-col gap-2"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
            {showResendOption && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isResending}
                className="self-start text-xs font-semibold text-[#B7F36B] hover:underline cursor-pointer disabled:opacity-50"
              >
                {isResending ? "Sending verification email..." : "Resend verification email"}
              </button>
            )}
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 p-3.5 rounded-xl bg-[#1B1F1A] border border-[#B7F36B] text-[#F7F8F5] text-xs leading-relaxed flex flex-col gap-2"
          >
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#B7F36B] shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
            {showResendOption && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isResending}
                className="self-start text-xs font-semibold text-[#B7F36B] hover:underline cursor-pointer disabled:opacity-50"
              >
                {isResending ? "Resending..." : "Didn't receive the email? Resend"}
              </button>
            )}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {mode === "register" && (
            <div className="space-y-1.5">
              <label htmlFor="auth-fullname" className="block text-xs font-semibold text-[#F7F8F5]">
                Name (optional)
              </label>
              <div className="relative">
                <UserIcon
                  className="w-4 h-4 text-[#777E74] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  ref={mode === "register" ? primaryInputRef : undefined}
                  id="auth-fullname"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  placeholder="Enter your name (optional)"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0D0F0D] border border-[#30362E] focus:border-[#B7F36B] focus:outline-none text-sm text-[#F7F8F5] placeholder-[#777E74] disabled:opacity-60"
                />
              </div>
            </div>
          )}

          {(mode === "login" || mode === "register" || mode === "forgot_password") && (
            <div className="space-y-1.5">
              <label htmlFor="auth-email" className="block text-xs font-semibold text-[#F7F8F5]">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  className="w-4 h-4 text-[#777E74] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  ref={mode === "login" || mode === "forgot_password" ? primaryInputRef : undefined}
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(errorMsg && /email|registered/i.test(errorMsg))}
                  aria-describedby={errorMsg && /email|registered/i.test(errorMsg) ? "auth-email-error" : undefined}
                  disabled={isLoading}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0D0F0D] border border-[#30362E] focus:border-[#B7F36B] focus:outline-none text-sm text-[#F7F8F5] placeholder-[#777E74] disabled:opacity-60"
                />
              </div>
              {errorMsg && /email|registered/i.test(errorMsg) && <p id="auth-email-error" className="text-[11px] text-rose-300" role="alert">{errorMsg}</p>}
            </div>
          )}

          {(mode === "login" || mode === "register" || mode === "reset_password") && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="auth-password" className="block text-xs font-semibold text-[#F7F8F5]">
                  {mode === "reset_password" ? "New Password" : "Password"}
                </label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => switchMode("forgot_password")}
                    disabled={isLoading}
                    className="text-xs font-semibold text-[#B7F36B] hover:underline cursor-pointer disabled:opacity-50"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock
                  className="w-4 h-4 text-[#777E74] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  ref={mode === "reset_password" ? primaryInputRef : undefined}
                  id="auth-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={mode === "login" ? 1 : 8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(errorMsg && /password/i.test(errorMsg) && !/match/i.test(errorMsg))}
                  aria-describedby={errorMsg && /password/i.test(errorMsg) && !/match/i.test(errorMsg) ? "auth-password-error" : undefined}
                  disabled={isLoading}
                  placeholder={mode === "login" ? "Enter your password" : "Minimum 8 characters"}
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-[#0D0F0D] border border-[#30362E] focus:border-[#B7F36B] focus:outline-none text-sm text-[#F7F8F5] placeholder-[#777E74] disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[#A5AAA1] hover:text-[#F7F8F5] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {(mode === "register" || mode === "reset_password") && (
                <p className="text-[11px] text-[#777E74]">Use at least 8 characters for strong account security.</p>
              )}
              {errorMsg && /password/i.test(errorMsg) && !/match/i.test(errorMsg) && <p id="auth-password-error" className="text-[11px] text-rose-300" role="alert">{errorMsg}</p>}
            </div>
          )}

          {(mode === "register" || mode === "reset_password") && (
            <div className="space-y-1.5">
              <label htmlFor="auth-confirm-password" className="block text-xs font-semibold text-[#F7F8F5]">
                Confirm Password
              </label>
              <div className="relative">
                <ShieldCheck
                  className="w-4 h-4 text-[#777E74] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="auth-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required={mode === "register" || mode === "reset_password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-invalid={Boolean(errorMsg && /match/i.test(errorMsg))}
                  aria-describedby={errorMsg && /match/i.test(errorMsg) ? "auth-confirm-password-error" : undefined}
                  disabled={isLoading}
                  placeholder="Re-enter your password"
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
          )}

          {/* Primary Submit CTA */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-[#B7F36B] hover:bg-[#A5E65A] text-[#080908] text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "login" && (isLoading ? "Signing in..." : "Sign In")}
            {mode === "register" && (isLoading ? "Creating account..." : "Create Account")}
            {mode === "forgot_password" && (
              <>
                {!isLoading && <KeyRound className="w-4 h-4" />}
                <span>{isLoading ? "Sending reset link..." : "Send Reset Link"}</span>
              </>
            )}
            {mode === "reset_password" && (isLoading ? "Updating password..." : "Save New Password")}
          </button>
        </form>

        {/* Google Sign-In option for Login / Signup */}
        {(mode === "login" || mode === "register") && (
          <>
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#30362E]" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#777E74]">or</span>
              <div className="h-px flex-1 bg-[#30362E]" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#1B1F1A] hover:bg-[#222720] border border-[#30362E] text-[#F7F8F5] text-sm font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#F7F8F5"
                  d="M21.35 11.1h-9.18v2.92h5.27c-.23 1.24-.92 2.29-1.97 3l3.18 2.47c1.86-1.71 2.93-4.23 2.93-7.24 0-.7-.06-1.38-.23-2.15z"
                />
                <path
                  fill="#A5AAA1"
                  d="M12.17 22c2.65 0 4.88-.88 6.5-2.38l-3.18-2.47c-.88.59-2 .94-3.32.94-2.55 0-4.71-1.72-5.48-4.04H3.38v2.54C5 19.81 8.33 22 12.17 22z"
                />
                <path
                  fill="#B7F36B"
                  d="M6.69 14.05A5.86 5.86 0 0 1 6.38 12c0-.71.12-1.4.31-2.05V7.41H3.38A9.96 9.96 0 0 0 2.17 12c0 1.61.39 3.13 1.21 4.59l3.31-2.54z"
                />
                <path
                  fill="#F7F8F5"
                  d="M12.17 5.91c1.44 0 2.74.5 3.76 1.47l2.82-2.82C17.04 2.96 14.81 2 12.17 2 8.33 2 5 4.19 3.38 7.41l3.31 2.54c.77-2.32 2.93-4.04 5.48-4.04z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </>
        )}

        {/* Mode Switcher Footer (No full page reload) */}
        <div className="mt-6 pt-4 border-t border-[#30362E] text-center text-sm text-[#A5AAA1]">
          {mode === "login" && (
            <p>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                disabled={isLoading}
                className="font-semibold text-[#B7F36B] hover:underline cursor-pointer disabled:opacity-50"
              >
                Sign up
              </button>
            </p>
          )}

          {mode === "register" && (
            <p>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                disabled={isLoading}
                className="font-semibold text-[#B7F36B] hover:underline cursor-pointer disabled:opacity-50"
              >
                Sign in
              </button>
            </p>
          )}

          {(mode === "forgot_password" || mode === "reset_password") && (
            <button
              type="button"
              onClick={() => switchMode("login")}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 font-semibold text-[#B7F36B] hover:underline cursor-pointer disabled:opacity-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
