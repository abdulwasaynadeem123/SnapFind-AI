import React, { useState, useEffect, useRef } from "react";
import { SnapFindLogo } from "./SnapFindLogo";
import {
  X,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  LogOut,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  RotateCw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface AuthModalProps {
  onClose: () => void;
  isDark: boolean;
  addToast?: (msg: { title: string; description?: string; type: "success" | "error" | "info" }) => void;
  onSignupSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, addToast, onSignupSuccess }) => {
  const {
    user,
    signInWithEmail,
    signUpWithEmail,
    resendVerificationEmail,
    signInWithGoogle,
    signOut,
    resetPassword,
    changePassword,
    isRecoveryMode,
    oauthErrorMessage,
    clearOauthError,
  } = useAuth();

  const isSubmittingRef = useRef(false);

  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot_password" | "reset_password">(
    isRecoveryMode ? "reset_password" : "login"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isUnconfirmedUser, setIsUnconfirmedUser] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  useEffect(() => {
    if (isRecoveryMode) {
      setAuthMode("reset_password");
    }
  }, [isRecoveryMode]);

  useEffect(() => {
    if (oauthErrorMessage) {
      setErrorMessage(oauthErrorMessage);
    }
  }, [oauthErrorMessage]);

  const validateEmailFormat = (emailStr: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr.trim());
  };

  const handleModeChange = (newMode: "login" | "register" | "forgot_password" | "reset_password") => {
    setAuthMode(newMode);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsUnconfirmedUser(false);
    if (clearOauthError) clearOauthError();
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      setErrorMessage("Please enter your email address to resend verification.");
      return;
    }
    setResendingVerification(true);
    setErrorMessage(null);
    try {
      const res = await resendVerificationEmail(email);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage(`A verification link has been sent to ${email.trim()}.`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to resend verification email.");
    } finally {
      setResendingVerification(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSubmitting) return;
    isSubmittingRef.current = true;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsUnconfirmedUser(false);
    if (clearOauthError) clearOauthError();

    // Validation
    if (authMode !== "reset_password" && !validateEmailFormat(email)) {
      setErrorMessage("Please enter a valid email address.");
      isSubmittingRef.current = false;
      return;
    }

    if (authMode === "register" || authMode === "login" || authMode === "reset_password") {
      if (!password) {
        setErrorMessage("Please enter your password.");
        isSubmittingRef.current = false;
        return;
      }
      if (password.length < 6) {
        setErrorMessage("Password must be at least 6 characters.");
        isSubmittingRef.current = false;
        return;
      }
    }

    if (authMode === "register") {
      if (!name.trim()) {
        setErrorMessage("Please enter your name.");
        isSubmittingRef.current = false;
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match.");
        isSubmittingRef.current = false;
        return;
      }
    }

    if (authMode === "reset_password") {
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match.");
        isSubmittingRef.current = false;
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (authMode === "login") {
        const res = await signInWithEmail(email, password);
        if (res.error) {
          const lower = res.error.toLowerCase();
          if (lower.includes("email not confirmed") || lower.includes("unconfirmed")) {
            setIsUnconfirmedUser(true);
          }
          setErrorMessage(res.error);
        } else {
          addToast?.({
            title: "Signed In",
            description: `Welcome back, ${res.user?.name || "User"}!`,
            type: "success",
          });
          onClose();
        }
      } else if (authMode === "register") {
        const res = await signUpWithEmail(email, password, name.trim());
        if (res.error) {
          setErrorMessage(res.error);
        } else {
          onSignupSuccess?.();
          if (res.user?.isLoggedIn) {
            addToast?.({
              title: "Account Created",
              description: `Welcome to SnapFind, ${res.user.name}!`,
              type: "success",
            });
            onClose();
          } else {
            setSuccessMessage(
              `Confirmation email sent to ${email.trim()}. Please verify your email to log in.`
            );
          }
        }
      } else if (authMode === "forgot_password") {
        const res = await resetPassword(email);
        if (res.error) {
          setErrorMessage(res.error);
        } else {
          setSuccessMessage(`Password recovery link sent to ${email.trim()}. Check your inbox.`);
        }
      } else if (authMode === "reset_password") {
        const res = await changePassword(password);
        if (res.error) {
          setErrorMessage(res.error);
        } else {
          setSuccessMessage("Password updated successfully. You can now sign in.");
          setTimeout(() => {
            handleModeChange("login");
          }, 1500);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const handleGoogleAuth = async () => {
    if (isSubmittingRef.current || isSubmitting) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await signInWithGoogle();
      if (res && res.error) {
        setErrorMessage(res.error);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to initiate Google Sign-In.");
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const handleSignOut = async () => {
    await signOut();
    addToast?.({
      title: "Signed Out",
      description: "You have signed out.",
      type: "info",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-[#334155] bg-[#1E293B] p-6 sm:p-7 shadow-2xl text-[#F1F5F9]">
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          title="Close dialog"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#2C3531] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Logo */}
        <div className="flex items-center gap-3 pb-5 border-b border-[#334155]">
          <SnapFindLogo className="w-9 h-9 rounded-xl object-contain border border-[#334155] bg-[#2C3531] shrink-0" />
          <div>
            <h2 className="font-extrabold text-lg tracking-tight text-[#F1F5F9]">
              {user?.isLoggedIn
                ? "Account"
                : authMode === "forgot_password"
                ? "Reset password"
                : authMode === "reset_password"
                ? "Set new password"
                : authMode === "register"
                ? "Create account"
                : "Welcome back"}
            </h2>
          </div>
        </div>

        {user?.isLoggedIn && authMode !== "reset_password" ? (
          /* Logged In View */
          <div className="space-y-4 pt-5">
            <div className="p-4 rounded-xl border border-[#334155] bg-[#2C3531] flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1E293B] border border-[#334155] text-[#D1E8E2] font-semibold text-sm flex items-center justify-center shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm text-[#F1F5F9] truncate">{user.name}</h3>
                <p className="text-xs text-[#94A3B8] truncate">{user.email}</p>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              type="button"
              className="w-full py-2.5 rounded-xl border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        ) : (
          /* Auth Form */
          <div className="space-y-4 pt-5">
            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p>{errorMessage}</p>
                  {isUnconfirmedUser && (
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendingVerification}
                      className="inline-flex items-center gap-1 text-xs text-white hover:underline font-medium cursor-pointer"
                    >
                      <RotateCw className={`w-3 h-3 ${resendingVerification ? "animate-spin" : ""}`} />
                      <span>{resendingVerification ? "Sending..." : "Resend confirmation email"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Success Banner */}
            {successMessage && (
              <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{successMessage}</p>
                </div>
              </div>
            )}

            {/* Google OAuth (Login & Register) */}
            {(authMode === "login" || authMode === "register") && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl border border-[#334155] bg-[#2C3531] hover:bg-[#334155] text-[#F1F5F9] font-medium text-xs flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <div className="relative flex items-center justify-center my-1">
                  <div className="border-t border-[#334155] w-full" />
                  <span className="bg-[#1E293B] px-2 text-[11px] text-[#94A3B8]">or</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Name field (register only) */}
              {authMode === "register" && (
                <div className="space-y-1 text-xs">
                  <label className="font-medium text-[#94A3B8]">Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      disabled={isSubmitting}
                      required
                      className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[#334155] bg-[#2C3531] text-[#F1F5F9] placeholder-[#94A3B8]/60 focus:border-[#116466] focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Email field */}
              {authMode !== "reset_password" && (
                <div className="space-y-1 text-xs">
                  <label className="font-medium text-[#94A3B8]">Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      disabled={isSubmitting}
                      required
                      className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[#334155] bg-[#2C3531] text-[#F1F5F9] placeholder-[#94A3B8]/60 focus:border-[#116466] focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Password field */}
              {(authMode === "login" || authMode === "register" || authMode === "reset_password") && (
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-[#94A3B8]">
                      {authMode === "reset_password" ? "New password" : "Password"}
                    </label>
                    {authMode === "login" && (
                      <button
                        type="button"
                        onClick={() => handleModeChange("forgot_password")}
                        className="text-[11px] text-[#94A3B8] hover:text-[#D1E8E2] transition-colors cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={isSubmitting}
                      required
                      className="w-full pl-9 pr-9 py-2.5 text-xs rounded-xl border border-[#334155] bg-[#2C3531] text-[#F1F5F9] placeholder-[#94A3B8]/60 focus:border-[#116466] focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F1F5F9] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm password field (register and reset_password) */}
              {(authMode === "register" || authMode === "reset_password") && (
                <div className="space-y-1 text-xs">
                  <label className="font-medium text-[#94A3B8]">Confirm password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={isSubmitting}
                      required
                      className="w-full pl-9 pr-9 py-2.5 text-xs rounded-xl border border-[#334155] bg-[#2C3531] text-[#F1F5F9] placeholder-[#94A3B8]/60 focus:border-[#116466] focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F1F5F9] cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-[#116466] hover:bg-[#157F81] text-[#F1F5F9] font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2 shadow-md shadow-[#116466]/20"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Please wait...</span>
                  </span>
                ) : (
                  <span>
                    {authMode === "login"
                      ? "Sign in"
                      : authMode === "register"
                      ? "Create account"
                      : authMode === "forgot_password"
                      ? "Send reset link"
                      : "Save new password"}
                  </span>
                )}
              </button>

              {/* Mode switch links */}
              {authMode === "login" && (
                <div className="text-center pt-2 text-xs text-[#94A3B8]">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => handleModeChange("register")}
                    className="text-[#D1E8E2] hover:underline font-semibold cursor-pointer"
                  >
                    Sign up
                  </button>
                </div>
              )}

              {authMode === "register" && (
                <div className="text-center pt-2 text-xs text-[#94A3B8]">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => handleModeChange("login")}
                    className="text-[#D1E8E2] hover:underline font-semibold cursor-pointer"
                  >
                    Sign in
                  </button>
                </div>
              )}

              {authMode === "forgot_password" && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => handleModeChange("login")}
                    className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-[#F1F5F9] transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign in</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
