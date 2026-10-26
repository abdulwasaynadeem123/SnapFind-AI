import React, { useState, useEffect, useRef } from "react";
import { SnapFindLogo } from "./SnapFindLogo";
import {
  X,
  User,
  Mail,
  Lock,
  ShieldCheck,
  CheckCircle2,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  LogOut,
  AlertCircle,
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

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, isDark: _isDark, addToast, onSignupSuccess }) => {
  const {
    user,
    signInWithEmail,
    signUpWithEmail,
    resendVerificationEmail,
    signInWithGoogle,
    signOut,
    isConfigured,
    resetPassword,
    changePassword,
    isRecoveryMode,
    setIsRecoveryMode,
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
        setSuccessMessage(`A new verification link has been sent to ${email.trim()}. Please check your inbox.`);
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

    // Validation checks
    if (authMode !== "reset_password" && !validateEmailFormat(email)) {
      setErrorMessage("Please enter a valid email address (e.g., name@example.com).");
      isSubmittingRef.current = false;
      return;
    }

    if (authMode === "register" || authMode === "login" || authMode === "reset_password") {
      if (!password) {
        setErrorMessage("Password cannot be empty.");
        isSubmittingRef.current = false;
        return;
      }
      if (password.length < 6) {
        setErrorMessage("Password must be at least 6 characters long.");
        isSubmittingRef.current = false;
        return;
      }
    }

    if (authMode === "register") {
      if (!name.trim()) {
        setErrorMessage("Please enter your full name.");
        isSubmittingRef.current = false;
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match. Please re-enter.");
        isSubmittingRef.current = false;
        return;
      }
    }

    if (authMode === "reset_password") {
      if (password !== confirmPassword) {
        setErrorMessage("New passwords do not match. Please re-enter.");
        isSubmittingRef.current = false;
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (authMode === "login") {
        const res = await signInWithEmail(email, password);
        if (res.error) {
          if (res.error.toLowerCase().includes("email not confirmed")) {
            setIsUnconfirmedUser(true);
            setErrorMessage("Please verify your email address before signing in. Check your inbox or request a new link.");
          } else if (res.error.toLowerCase().includes("invalid login credentials")) {
            setErrorMessage("Invalid email or password. Please verify your credentials or register a new account.");
          } else {
            setErrorMessage(res.error);
          }
        } else {
          addToast?.({
            title: "Signed In Successfully",
            description: `Welcome back, ${email.split("@")[0] || "Vault Owner"}!`,
            type: "success",
          });
          onClose();
        }
      } else if (authMode === "register") {
        const res = await signUpWithEmail(email, password, name);
        if (res.error) {
          if (res.error.toLowerCase().includes("already registered") || res.error.toLowerCase().includes("user already exists")) {
            setErrorMessage("This email is already registered. Please sign in or reset your password.");
          } else if (res.error.toLowerCase().includes("rate limit") || res.error.toLowerCase().includes("email rate limit exceeded")) {
            setErrorMessage(
              "Account created, but email verification limit was temporarily reached. You can already try signing in with this email, or check your spam/junk folder."
            );
          } else {
            setErrorMessage(res.error);
          }
        } else {
          setSuccessMessage(
            `Registration successful! We've sent a verification email to ${email.trim()}. Please click the link to activate your vault.`
          );
          onSignupSuccess?.();
          addToast?.({
            title: "Account Created",
            description: `Verification link sent to ${email.trim()}`,
            type: "success",
          });
        }
      } else if (authMode === "forgot_password") {
        const res = await resetPassword(email);
        if (res.error) {
          setErrorMessage(res.error);
        } else {
          setSuccessMessage(
            `A password recovery link has been sent to ${email.trim()}. Please follow the instructions in your inbox.`
          );
          addToast?.({
            title: "Recovery Link Sent",
            description: `Check your inbox at ${email.trim()}`,
            type: "info",
          });
        }
      } else if (authMode === "reset_password") {
        const res = await changePassword(password);
        if (res.error) {
          setErrorMessage(res.error);
        } else {
          setSuccessMessage("Your password has been successfully updated. You may now sign in.");
          setIsRecoveryMode(false);
          setAuthMode("login");
          addToast?.({
            title: "Password Updated",
            description: "Your vault is now secured with the new password.",
            type: "success",
          });
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred during authentication.");
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

    try {
      const res = await signInWithGoogle();
      if (res.error) {
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
      description: "You have signed out of your account.",
      type: "info",
    });
    onClose();
  };

  const passwordsMatch = Boolean(confirmPassword && password && password === confirmPassword);
  const passwordsMismatch = Boolean(confirmPassword && password && password !== confirmPassword);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl border border-[#334155] bg-[#1E293B] p-6 sm:p-7 shadow-2xl text-[#F1F5F9] space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          title="Close dialog"
          className="absolute top-4 right-4 p-2 rounded-xl text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#243347] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Logo */}
        <div className="flex items-center gap-3 pb-3 border-b border-[#334155]">
          <SnapFindLogo className="w-10 h-10 rounded-xl object-contain border border-[#334155] bg-[#2C3531] shrink-0" />
          <div>
            <h2 className="font-extrabold text-lg tracking-tight text-[#F1F5F9]">
              {user?.isLoggedIn
                ? "Your Account Vault"
                : authMode === "forgot_password"
                ? "Reset Your Password"
                : authMode === "reset_password"
                ? "Set New Password"
                : authMode === "register"
                ? "Create SnapFind Account"
                : "Sign In to SnapFind"}
            </h2>
            <p className="text-xs text-[#94A3B8]">
              {user?.isLoggedIn
                ? `Active account: ${user.email}`
                : authMode === "forgot_password"
                ? "Enter your email to receive a recovery link"
                : authMode === "reset_password"
                ? "Choose a strong password for your vault"
                : authMode === "register"
                ? "Free account with private local storage"
                : isConfigured
                ? "Secure authentication via Supabase"
                : "Local storage mode active"}
            </p>
          </div>
        </div>

        {user?.isLoggedIn && authMode !== "reset_password" ? (
          /* User Logged In Profile Card */
          <div className="space-y-4 pt-1">
            <div className="p-4 rounded-xl border border-[#334155] bg-[#2C3531] flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#1E293B] border border-[#334155] text-[#D1E8E2] font-semibold text-base flex items-center justify-center shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm text-[#F1F5F9] truncate">{user.name}</h3>
                <p className="text-xs text-[#94A3B8] truncate">{user.email}</p>
                <div className="flex items-center gap-1.5 text-xs text-[#D1E8E2] mt-1 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#D1E8E2]" />
                  <span>Session Active ({user.plan || "Free"})</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              type="button"
              className="w-full py-2.5 rounded-xl border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out of Account</span>
            </button>
          </div>
        ) : (
          /* Login / Register / Forgot Password Forms */
          <div className="space-y-4">
            {/* Tab Switcher for login / register */}
            {(authMode === "login" || authMode === "register") && (
              <div className="grid grid-cols-2 p-1 rounded-xl bg-[#2C3531] border border-[#334155] text-xs font-medium">
                <button
                  type="button"
                  onClick={() => handleModeChange("login")}
                  className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    authMode === "login"
                      ? "bg-[#116466] text-[#F1F5F9] font-bold shadow-sm"
                      : "text-[#94A3B8] hover:text-[#F1F5F9]"
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("register")}
                  className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    authMode === "register"
                      ? "bg-[#116466] text-[#F1F5F9] font-bold shadow-sm"
                      : "text-[#94A3B8] hover:text-[#F1F5F9]"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register</span>
                </button>
              </div>
            )}

            {/* Back button if in forgot password mode */}
            {authMode === "forgot_password" && (
              <button
                type="button"
                onClick={() => handleModeChange("login")}
                className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-[#F1F5F9] transition-colors font-medium cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            )}

            {/* Google OAuth Button */}
            {(authMode === "login" || authMode === "register") && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl border border-[#334155] bg-[#2C3531] hover:bg-[#243347] text-[#F1F5F9] font-medium text-xs flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                <p className="text-[10px] text-[#94A3B8]/70 text-center px-1">
                  Google sign-in requires a standard browser (Chrome, Safari, Firefox, Edge).
                </p>

                <div className="relative flex items-center justify-center my-1">
                  <div className="border-t border-[#334155] w-full" />
                  <span className="bg-[#1E293B] px-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Or with email
                  </span>
                </div>
              </>
            )}

            {/* Error banner */}
            {errorMessage && (
              <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <p>{errorMessage}</p>
                  {isUnconfirmedUser && (
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendingVerification}
                      className="inline-flex items-center gap-1 text-xs text-white hover:underline font-medium cursor-pointer"
                    >
                      <RotateCw className={`w-3 h-3 ${resendingVerification ? "animate-spin" : ""}`} />
                      <span>{resendingVerification ? "Sending link..." : "Resend confirmation email"}</span>
                    </button>
                  )}
                  {authMode === "register" &&
                    (errorMessage.toLowerCase().includes("already exists") ||
                      errorMessage.toLowerCase().includes("rate limit") ||
                      errorMessage.toLowerCase().includes("sign in")) && (
                      <div>
                        <button
                          type="button"
                          onClick={() => handleModeChange("login")}
                          className="inline-flex items-center gap-1 text-xs text-white hover:underline font-semibold cursor-pointer"
                        >
                          Sign In with this email instead →
                        </button>
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Success banner */}
            {successMessage && (
              <div className="p-3 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <p>{successMessage}</p>
                  {authMode === "register" && (
                    <button
                      type="button"
                      onClick={() => handleModeChange("login")}
                      className="text-xs text-white hover:underline font-semibold cursor-pointer"
                    >
                      Go to Sign In
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Name field (register only) */}
              {authMode === "register" && (
                <div className="space-y-1 text-xs">
                  <label className="font-medium text-zinc-400">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Morgan"
                      disabled={isSubmitting}
                      required
                      className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-zinc-800 bg-zinc-900 text-white placeholder-zinc-500 focus:border-white focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Email field (for login, register, forgot_password) */}
              {authMode !== "reset_password" && (
                <div className="space-y-1 text-xs">
                  <label className="font-medium text-[#94A3B8]">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      disabled={isSubmitting}
                      required
                      className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[#334155] bg-[#2C3531] text-[#F1F5F9] placeholder-[#94A3B8]/60 focus:border-[#116466] focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Password field for login and register */}
              {(authMode === "login" || authMode === "register") && (
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-[#94A3B8]">Password</label>
                    {authMode === "login" && (
                      <button
                        type="button"
                        onClick={() => handleModeChange("forgot_password")}
                        className="text-[11px] text-[#94A3B8] hover:text-[#F1F5F9] transition-colors cursor-pointer"
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
                      placeholder="At least 6 characters"
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

              {/* Confirm Password field (for register and reset_password) */}
              {(authMode === "register" || authMode === "reset_password") && (
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-[#94A3B8]">
                      {authMode === "register" ? "Confirm Password" : "Confirm New Password"}
                    </label>
                    {passwordsMatch && (
                      <span className="text-[11px] text-[#D1E8E2] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-[#D1E8E2]" /> Matches
                      </span>
                    )}
                    {passwordsMismatch && (
                      <span className="text-[11px] text-rose-400">
                        Does not match
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      disabled={isSubmitting}
                      required
                      className={`w-full pl-9 pr-9 py-2.5 text-xs rounded-xl border bg-[#2C3531] text-[#F1F5F9] placeholder-[#94A3B8]/60 focus:outline-none transition-colors ${
                        passwordsMismatch
                          ? "border-rose-500 focus:border-rose-500"
                          : "border-[#334155] focus:border-[#116466]"
                      }`}
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

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-[#116466] hover:bg-[#157F81] text-[#F1F5F9] font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1 shadow-[0_0_12px_rgba(17,100,102,0.3)] border border-[#116466]"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing...</span>
                  </span>
                ) : (
                  <span>
                    {authMode === "login"
                      ? "Sign In"
                      : authMode === "register"
                      ? "Create Free Account"
                      : authMode === "forgot_password"
                      ? "Send Password Reset Link"
                      : "Save New Password"}
                  </span>
                )}
              </button>

              {/* Direct links between Registration and Login */}
              {authMode === "register" && (
                <div className="text-center pt-2 text-xs text-[#94A3B8]">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => handleModeChange("login")}
                    className="text-[#D1E8E2] hover:text-[#F1F5F9] hover:underline font-semibold cursor-pointer"
                  >
                    Sign In
                  </button>
                </div>
              )}
              {authMode === "login" && (
                <div className="text-center pt-2 text-xs text-[#94A3B8]">
                  Don't have an account yet?{" "}
                  <button
                    type="button"
                    onClick={() => handleModeChange("register")}
                    className="text-[#D1E8E2] hover:text-[#F1F5F9] hover:underline font-semibold cursor-pointer"
                  >
                    Create Free Account
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
