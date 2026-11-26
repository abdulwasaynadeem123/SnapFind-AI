import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured, getAuthBearerHeader } from "../services/supabase";
import { UserProfile, UserEntitlement } from "../types";
import { saveUserProfile, clearUserCache } from "../services/storage.ts";
import { StorageManager } from "../services/storage/StorageManager";
import { SyncEngine } from "../services/syncEngine";
import { SubscriptionManager } from "../services/billing/SubscriptionManager";
import { NotificationService } from "../services/notificationService";

interface AuthContextType {
  user: UserProfile | null;
  supabaseUser: User | null;
  session: Session | null;
  entitlement: UserEntitlement;
  isPro: boolean;
  loading: boolean;
  isConfigured: boolean;
  isRecoveryMode: boolean;
  setIsRecoveryMode: (val: boolean) => void;
  oauthErrorMessage: string | null;
  clearOauthError: () => void;
  refreshEntitlement: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<{ error?: string; isUnconfirmedEmail?: boolean }>;
  signUpWithEmail: (email: string, pass: string, name?: string) => Promise<{ error?: string; requiresVerification?: boolean; message?: string }>;
  resendVerificationEmail: (email: string) => Promise<{ error?: string; success?: boolean }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  signOutAllDevices: () => Promise<{ error?: string }>;
  reauthenticate: (password: string) => Promise<{ error?: string }>;
  updateName: (newName: string) => Promise<{ error?: string }>;
  updateUsername: (newUsername: string) => Promise<{ error?: string }>;
  updateProfilePicture: (avatarUrl: string) => Promise<{ error?: string }>;
  changeEmail: (newEmail: string, currentPassword?: string) => Promise<{ error?: string; requiresVerification?: boolean }>;
  changePassword: (newPass: string, currentPassword?: string) => Promise<{ error?: string }>;
  resetPassword: (email?: string) => Promise<{ error?: string }>;
  deleteAccount: (currentPassword?: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GUEST_USER: UserProfile = {
  id: "guest",
  name: "Sign In",
  email: "",
  avatarUrl: "",
  isLoggedIn: false,
  plan: "Free",
  storageLimitMB: 1000,
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AUTH_UNCONFIGURED_ERROR =
  "Authentication service is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable sign-in and account management.";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  // Security: Never trust localStorage as the source of authentication or paid entitlements.
  const [user, setUser] = useState<UserProfile | null>(null);
  const [entitlement, setEntitlement] = useState<UserEntitlement>(() => SubscriptionManager.getEntitlement());
  const [loading, setLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    return (
      hash.includes("type=recovery") ||
      search.includes("type=recovery")
    );
  });
  const [oauthErrorMessage, setOauthErrorMessage] = useState<string | null>(null);

  const clearOauthError = () => setOauthErrorMessage(null);

  // Subscribe to SubscriptionManager real-time entitlement changes
  useEffect(() => {
    const unsub = SubscriptionManager.subscribe((newEntitlement) => {
      setEntitlement(newEntitlement);
      setUser((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          plan: newEntitlement.tier,
          storageLimitMB: newEntitlement.features?.maxStorageMB ?? (newEntitlement.isPro || newEntitlement.isFounder ? 50000 : 1000),
          entitlement: newEntitlement,
        };
        saveUserProfile(updated);
        return updated;
      });
    });
    return unsub;
  }, []);

  const refreshEntitlement = async () => {
    const userId = supabaseUser?.id || user?.id || "guest";
    const ent = await SubscriptionManager.syncEntitlementsFromServer(userId);
    setEntitlement(ent);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      SubscriptionManager.resetToFree();
      SyncEngine.setCurrentUserId("guest");
      setUser(null);
      setLoading(false);
      return;
    }

    // 1. Callback Handler: Exchange OAuth / Recovery code or hash token for session
    const processAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const oauthError = urlParams.get("error");
      const oauthErrorDescription = urlParams.get("error_description");
      const code = urlParams.get("code");
      const queryType = urlParams.get("type");
      const hash = window.location.hash;

      const hashParams =
        hash && (hash.includes("=") || hash.includes("access_token") || hash.includes("error"))
          ? new URLSearchParams(hash.replace(/^#\/?/, ""))
          : null;
      const hashError = hashParams?.get("error") || null;
      const hashErrorDescription = hashParams?.get("error_description") || null;
      const hashType = hashParams?.get("type") || null;

      const isRecoveryCallback =
        queryType === "recovery" ||
        hashType === "recovery" ||
        window.location.pathname === "/reset-password";

      if (queryType === "recovery" || hashType === "recovery") {
        setIsRecoveryMode(true);
      }

      if (oauthError || hashError) {
        const reportedErr = oauthErrorDescription || hashErrorDescription || oauthError || hashError || "Authentication error";
        console.error(`[AuthContext] Auth callback returned error: ${reportedErr}`);
        if (isRecoveryCallback) {
          setOauthErrorMessage("Your password reset link is invalid or has expired. Please request a new reset email.");
        } else {
          setOauthErrorMessage(
            "Google sign-in could not be completed. Please sign in using your email and password."
          );
        }
        // Strip error parameters from URL
        const cleanPath = window.location.pathname === "/auth/callback" ? "/" : window.location.pathname;
        window.history.replaceState({}, document.title, cleanPath);
        return;
      }

      if (code) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("[AuthContext] Code exchange failed:", error.message);
            setOauthErrorMessage(
              isRecoveryCallback
                ? "Your password reset link is invalid or has expired. Please request a new link."
                : "Sign-in verification failed: " + error.message
            );
          } else if (data?.session) {
            setSession(data.session);
            setSupabaseUser(data.session.user);
            await syncProfile(data.session.user);
            SyncEngine.setCurrentUserId(data.session.user.id);
            setOauthErrorMessage(null);
            if (isRecoveryCallback) {
              setIsRecoveryMode(true);
            }

            if (window.opener && window.opener !== window) {
              try {
                window.opener.postMessage(
                  { type: "OAUTH_AUTH_SUCCESS", session: data.session },
                  window.location.origin
                );
              } catch (e) {
                console.warn("[AuthContext] Failed to postMessage to popup opener:", e);
              }
              window.close();
              return;
            }
          }
        } catch (err) {
          console.error("[AuthContext] Exception during code exchange");
          setOauthErrorMessage(
            isRecoveryCallback
              ? "Your password reset link could not be verified. Please request a new one."
              : "Sign-in verification failed. Please sign in with email."
          );
        } finally {
          // Security: Strip code and sensitive tokens from URL immediately
          const cleanPath =
            isRecoveryCallback
              ? "/reset-password"
              : window.location.pathname === "/auth/callback"
              ? "/"
              : window.location.pathname;
          window.history.replaceState({}, document.title, cleanPath);
        }
      } else if (hash && hash.includes("access_token")) {
        // Handle hash fragment authentication / recovery
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          setSession(data.session);
          setSupabaseUser(data.session.user);
          await syncProfile(data.session.user);
          SyncEngine.setCurrentUserId(data.session.user.id);
          setOauthErrorMessage(null);
          if (isRecoveryCallback) {
            setIsRecoveryMode(true);
          }

          if (window.opener && window.opener !== window) {
            try {
              window.opener.postMessage(
                { type: "OAUTH_AUTH_SUCCESS", session: data.session },
                window.location.origin
              );
            } catch (e) {
              console.warn("[AuthContext] Failed to postMessage to popup opener:", e);
            }
            window.close();
            return;
          }
        }
        // Security: Never leave access_token or recovery tokens in URL hash
        const cleanPath =
          isRecoveryCallback
            ? "/reset-password"
            : window.location.pathname === "/auth/callback"
            ? "/"
            : window.location.pathname;
        window.history.replaceState({}, document.title, cleanPath);
      }
    };

    let isMounted = true;
    let initialAuthSettled = false;

    // Complete OAuth / recovery callback processing before reading the session.
    // Otherwise getSession() can race the PKCE exchange and render the user as signed out.
    const initializeAuth = async () => {
      try {
        await processAuthCallback();
        if (!isMounted) return;

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!isMounted) return;

        setSession(session);
        setSupabaseUser(session?.user ?? null);
        if (session?.user) {
          SyncEngine.setCurrentUserId(session.user.id);
          await syncProfile(session.user);
        } else {
          SubscriptionManager.resetToFree();
          SyncEngine.setCurrentUserId("guest");
          setUser(null);
        }
      } catch (err) {
        console.warn("[AuthContext] Initial session check warning:", err);
        if (isMounted) {
          SubscriptionManager.resetToFree();
          SyncEngine.setCurrentUserId("guest");
          setUser(null);
        }
      } finally {
        if (isMounted) {
          initialAuthSettled = true;
          setLoading(false);
        }
      }
    };

    void initializeAuth();

    // 3. Listen to persistent Auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Keep this callback synchronous. Calling Supabase again from inside it can
      // deadlock the auth lock (syncProfile fetches the session for its API token).
      setSession(nextSession);
      setSupabaseUser(nextSession?.user ?? null);
      if (_event === "PASSWORD_RECOVERY") setIsRecoveryMode(true);
      if (nextSession?.user) {
        SyncEngine.setCurrentUserId(nextSession.user.id);
        const activeUser = nextSession.user;
        setTimeout(() => {
          syncProfile(activeUser).catch((err) =>
            console.warn("[AuthContext] Deferred profile sync warning:", err)
          );
        }, 0);
      } else if (_event === "SIGNED_OUT") {
        SubscriptionManager.resetToFree();
        SyncEngine.setCurrentUserId("guest");
        clearUserCache();
        setIsRecoveryMode(false);
        setUser(null);
        saveUserProfile(GUEST_USER);
      }
      if (initialAuthSettled) setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const syncProfile = async (sbUser: User) => {
    const name =
      sbUser.user_metadata?.full_name ||
      sbUser.user_metadata?.name ||
      sbUser.user_metadata?.username ||
      sbUser.email?.split("@")[0] ||
      "User";
    const username =
      sbUser.user_metadata?.username ||
      sbUser.user_metadata?.preferred_username ||
      name;
    const avatarUrl =
      sbUser.user_metadata?.avatar_url ||
      sbUser.user_metadata?.picture ||
      undefined;

    // Authentication must not fail because a secondary profile/entitlement sync is temporarily unavailable.
    let userEntitlement = SubscriptionManager.getEntitlement();
    try {
      userEntitlement = await SubscriptionManager.syncEntitlementsFromServer(sbUser.id);
      setEntitlement(userEntitlement);
    } catch (entitlementError: any) {
      console.warn("[AuthContext] Entitlement sync deferred:", entitlementError?.message || entitlementError);
      setEntitlement(userEntitlement);
    }

    try {
      const { error: profileSyncError } = await supabase.from("profiles").upsert({
        id: sbUser.id,
        name,
        email: sbUser.email || "",
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString(),
      });
      if (profileSyncError) console.warn("[AuthContext] Profile sync warning:", profileSyncError.message);
    } catch (profileError: any) {
      console.warn("[AuthContext] Profile sync deferred:", profileError?.message || profileError);
    }

    const updatedProfile: UserProfile = {
      id: sbUser.id,
      name,
      username,
      email: sbUser.email || "",
      avatarUrl,
      isLoggedIn: true,
      plan: userEntitlement.tier,
      storageLimitMB: userEntitlement.features?.maxStorageMB ?? ((userEntitlement.isPro || userEntitlement.isFounder) ? 50000 : 1000),
      createdAt: sbUser.created_at,
      emailConfirmedAt: sbUser.email_confirmed_at,
      provider: sbUser.app_metadata?.provider || "email",
      entitlement: userEntitlement,
    };
    setUser(updatedProfile);
    saveUserProfile(updatedProfile);
  };

  const signInWithEmail = async (
    email: string,
    pass: string
  ): Promise<{ error?: string; isUnconfirmedEmail?: boolean }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      return { error: "Please enter a valid email address." };
    }
    if (!pass) {
      return { error: "Please enter your account password." };
    }

    if (!isSupabaseConfigured) {
      return { error: AUTH_UNCONFIGURED_ERROR };
    }

    let data: any;
    let error: any;
    try {
      const result = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass,
      });
      data = result.data;
      error = result.error;
    } catch (err: any) {
      return { error: err?.message || "Sign-in request failed. Check your internet connection and try again." };
    }
    if (error) {
      const lower = error.message.toLowerCase();
      const isUnconfirmed = lower.includes("email not confirmed");
      const isInvalidCreds = lower.includes("invalid login credentials");
      return {
        error: isUnconfirmed
          ? "Your email address has not been confirmed yet. Please verify your email using the link sent to your inbox."
          : isInvalidCreds
          ? "Incorrect email address or password. Please check your credentials and try again."
          : error.message,
        isUnconfirmedEmail: isUnconfirmed,
      };
    }
    if (data?.session?.user) {
      setSession(data.session);
      setSupabaseUser(data.session.user);
      SyncEngine.setCurrentUserId(data.session.user.id);
      try {
        await syncProfile(data.session.user);
      } catch (profileError) {
        console.warn("[AuthContext] Sign-in succeeded but profile sync will retry:", profileError);
      }
      NotificationService.notifyNewLogin({ email: cleanEmail, platform: "Email / Web" });
    }
    return {};
  };

  const signUpWithEmail = async (
    email: string,
    pass: string,
    name?: string
  ): Promise<{ error?: string; requiresVerification?: boolean; message?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (name || "").trim();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      return { error: "Please enter a valid email address." };
    }
    if (!pass || pass.length < 8) {
      return { error: "Password must be at least 8 characters long." };
    }

    if (!isSupabaseConfigured) {
      return { error: AUTH_UNCONFIGURED_ERROR };
    }

    let data: any;
    let error: any;
    try {
      const result = await supabase.auth.signUp({
        email: cleanEmail,
        password: pass,
        options: {
          data: {
            full_name: cleanName || cleanEmail.split("@")[0],
          },
          emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : "https://snapfind.ai.studio/",
        },
      });
      data = result.data;
      error = result.error;
    } catch (err: any) {
      return { error: err?.message || "Signup request failed. Check your internet connection and try again." };
    }

    if (error) {
      const msg = error.message || "";
      const lower = msg.toLowerCase();

      const secondsMatch = msg.match(/after (\d+) seconds/i);
      if (secondsMatch) {
        return {
          error: `For security purposes, please wait ${secondsMatch[1]} seconds before requesting another verification email.`,
        };
      }

      if (error.code === "over_email_send_rate_limit" || lower.includes("email rate limit exceeded") || lower.includes("rate limit")) {
        return {
          error: "Too many verification emails were sent recently. Please wait a few minutes or sign in if you already created an account.",
        };
      }

      if (lower.includes("user already registered") || lower.includes("already registered") || lower.includes("already exists")) {
        return {
          error: "An account with this email address already exists. Please sign in instead.",
        };
      }

      if (lower.includes("password should be at least")) {
        return {
          error: "Password must be at least 8 characters long.",
        };
      }

      return { error: msg };
    }

    if (data?.user && !data?.session) {
      if (data.user.identities && data.user.identities.length === 0) {
        return {
          error: "An account with this email address already exists. Please sign in instead.",
        };
      }
      return {
        requiresVerification: true,
        message: "Account created! Verify your email first. Your First 50 Lifetime Free eligibility is counted after verification; then sign in and the claim popup will appear automatically.",
      };
    }

    if (data?.session?.user) {
      setSession(data.session);
      setSupabaseUser(data.session.user);
      await syncProfile(data.session.user);
      SyncEngine.setCurrentUserId(data.session.user.id);
      NotificationService.notifyNewLogin({ email: cleanEmail, platform: "Email / Web" });
    }

    return { message: "Account created successfully." };
  };

  const resendVerificationEmail = async (
    email: string
  ): Promise<{ error?: string; success?: boolean }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      return { error: "Please enter a valid email address to resend confirmation." };
    }
    if (!isSupabaseConfigured) {
      return { error: AUTH_UNCONFIGURED_ERROR };
    }
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: cleanEmail,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : "https://snapfind.ai.studio/",
      },
    });
    if (error) {
      const msg = error.message || "";
      const secondsMatch = msg.match(/after (\d+) seconds/i);
      if (secondsMatch) {
        return { error: `For security purposes, please wait ${secondsMatch[1]} seconds before requesting another email.` };
      }
      if (msg.toLowerCase().includes("rate limit")) {
        return { error: "Email delivery rate limit reached. Please wait a moment before requesting another verification link." };
      }
      return { error: msg };
    }
    return { success: true };
  };

  const signInWithGoogle = async (): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured) {
      return { error: AUTH_UNCONFIGURED_ERROR };
    }

    // Open the window synchronously while still inside the user's click gesture.
    // Opening it after awaiting the OAuth request is commonly blocked by browsers.
    let popup: Window | null = null;
    try {
      popup = window.open(
        "about:blank",
        "snapfind-google-signin",
        "popup=yes,width=520,height=680,resizable=yes,scrollbars=yes"
      );
      if (!popup) {
        return { error: "Google sign-in popup was blocked. Allow pop-ups for snapfind.ai.studio and try again." };
      }

      const isProduction =
        window.location.hostname === "snapfind.ai.studio" ||
        window.location.origin.includes("snapfind.ai.studio");
      const canonicalOrigin = isProduction
        ? "https://snapfind.ai.studio"
        : window.location.origin.replace(/\\/+$/, "");
      const redirectTo = `${canonicalOrigin}/`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: "select_account",
            access_type: "offline",
          },
        },
      });

      if (error || !data?.url) {
        popup.close();
        return { error: error?.message || "Could not start Google sign-in. Please try again." };
      }

      popup.location.href = data.url;
      popup.focus();
      return {};
    } catch (err: any) {
      try { popup?.close(); } catch { /* ignore popup cleanup errors */ }
      console.error("[AuthContext] Google popup sign-in exception:", err);
      return { error: err?.message || "Google authentication failed. Please try again." };
    }
  };

  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut().catch((err) => console.warn("[AuthContext] signOut error:", err));
    }
    SubscriptionManager.resetToFree();
    SyncEngine.setCurrentUserId("guest");
    clearUserCache();
    setIsRecoveryMode(false);
    setSession(null);
    setSupabaseUser(null);
    setUser(null);
    saveUserProfile(GUEST_USER);
  };

  const signOutAllDevices = async (): Promise<{ error?: string }> => {
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.signOut({ scope: "global" });
        if (error) {
          return { error: error.message };
        }
      }
      SubscriptionManager.resetToFree();
      SyncEngine.setCurrentUserId("guest");
      clearUserCache();
      setIsRecoveryMode(false);
      setSession(null);
      setSupabaseUser(null);
      setUser(null);
      saveUserProfile(GUEST_USER);
      return {};
    } catch (err: any) {
      return { error: err?.message || "Failed to sign out from all devices" };
    }
  };

  // Re-authentication helper for sensitive operations
  const reauthenticate = async (password: string): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured) return { error: AUTH_UNCONFIGURED_ERROR };
    const email = supabaseUser?.email || user?.email;
    if (!email) return { error: "No active user email found." };
    if (!password) return { error: "Current password is required for verification." };

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: "Current password is incorrect. Please try again." };
      return {};
    } catch (err: any) {
      return { error: err?.message || "Could not verify your password. Check your connection and try again." };
    }
  };

  const updateName = async (newName: string): Promise<{ error?: string }> => {
    const cleanName = newName.trim();
    if (cleanName.length < 2) return { error: "Display name must be at least 2 characters." };
    if (cleanName.length > 80) return { error: "Display name cannot exceed 80 characters." };

    if (!isSupabaseConfigured) {
      return { error: AUTH_UNCONFIGURED_ERROR };
    }
    if (!supabaseUser || !session) {
      return { error: "You must be signed in to update your display name." };
    }

    const { data, error } = await supabase.auth.updateUser({
      data: { full_name: cleanName, name: cleanName },
    });
    if (error) return { error: error.message };

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: supabaseUser.id,
      name: cleanName,
      email: supabaseUser.email,
      updated_at: new Date().toISOString(),
    });
    if (profileError) {
      console.warn("[AuthContext] Profile table name update warning:", profileError.message);
    }

    if (data?.user) {
      setSupabaseUser(data.user);
      await syncProfile(data.user);
    } else if (user) {
      const updated = { ...user, name: cleanName };
      setUser(updated);
      saveUserProfile(updated);
    }

    NotificationService.notifyProfileUpdated("Updated account display name");
    return {};
  };

  const updateUsername = async (newUsername: string): Promise<{ error?: string }> => {
    const cleanUsername = newUsername.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      return { error: "Username must be 3–24 characters and use only lowercase letters, numbers, or underscores." };
    }
    if (!isSupabaseConfigured) return { error: AUTH_UNCONFIGURED_ERROR };
    if (!supabaseUser || !session) return { error: "You must be signed in to update your username." };

    const previousUsername = String(supabaseUser.user_metadata?.username || "");
    const { data, error } = await supabase.auth.updateUser({
      data: { username: cleanUsername },
    });
    if (error) {
      const message = error.message || "";
      if (message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("unique")) {
        return { error: "That username is already taken. Please choose another one." };
      }
      return { error: message };
    }

    const { error: usernameError } = await supabase.rpc("set_my_username", {
      p_username: cleanUsername,
    });
    if (usernameError) {
      // The auth metadata update may have fired the profile sync trigger already.
      // Restore metadata if the database rejected the username.
      if (previousUsername) {
        await supabase.auth.updateUser({ data: { username: previousUsername } }).catch(() => undefined);
      }
      const message = usernameError.message || "";
      if (message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("unique")) {
        return { error: "That username is already taken. Please choose another one." };
      }
      return { error: message };
    }

    if (data?.user) {
      setSupabaseUser(data.user);
      await syncProfile(data.user);
    }
    NotificationService.notifyProfileUpdated("Updated account username");
    return {};
  };

  const updateProfilePicture = async (avatarUrl: string): Promise<{ error?: string }> => {
    const cleanAvatar = avatarUrl.trim();
    if (!isSupabaseConfigured) {
      return { error: AUTH_UNCONFIGURED_ERROR };
    }
    if (!supabaseUser || !session) {
      return { error: "You must be signed in to update your profile picture." };
    }

    const { data, error } = await supabase.auth.updateUser({
      data: { avatar_url: cleanAvatar, picture: cleanAvatar },
    });
    if (error) return { error: error.message };

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: supabaseUser.id,
      name: user?.name || supabaseUser.user_metadata?.full_name || supabaseUser.email?.split("@")[0] || "User",
      email: supabaseUser.email,
      avatar_url: cleanAvatar,
      updated_at: new Date().toISOString(),
    });
    if (profileError) {
      console.warn("[AuthContext] Profile avatar update warning:", profileError.message);
    }

    if (data?.user) {
      setSupabaseUser(data.user);
      await syncProfile(data.user);
    } else if (user) {
      const updated = { ...user, avatarUrl: cleanAvatar };
      setUser(updated);
      saveUserProfile(updated);
    }

    NotificationService.notifyProfileUpdated("Updated profile photo avatar");
    return {};
  };

  const changeEmail = async (
    newEmail: string,
    currentPassword?: string
  ): Promise<{ error?: string; requiresVerification?: boolean }> => {
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      return { error: "Please enter a valid email address." };
    }
    if (!isSupabaseConfigured) {
      return { error: AUTH_UNCONFIGURED_ERROR };
    }
    if (!supabaseUser || !session) {
      return { error: "You must be signed in to change your email address." };
    }

    const currentEmail = (supabaseUser.email || user?.email || "").trim().toLowerCase();
    if (currentEmail && cleanEmail === currentEmail) {
      return { error: "The new email address must be different from your current email." };
    }

    const provider = supabaseUser.app_metadata?.provider || user?.provider || "email";
    if (provider === "email") {
      if (!currentPassword) {
        return { error: "Please enter your current password to verify this email change." };
      }
      const reauthRes = await reauthenticate(currentPassword);
      if (reauthRes.error) return reauthRes;
    } else if (currentPassword) {
      const reauthRes = await reauthenticate(currentPassword);
      if (reauthRes.error) return reauthRes;
    }

    // Security: Do not overwrite public.profiles.email until the user confirms the verification link.
    try {
      const attributes: any = { email: cleanEmail };
      if (provider === "email" && currentPassword) {
        // Supabase validates the current password in the same Auth request;
        // avoid signing in again and accidentally replacing the active session.
        attributes.current_password = currentPassword;
      }
      const { error } = await supabase.auth.updateUser(
        attributes,
        { emailRedirectTo: `${window.location.origin}/` }
      );
      if (error) return { error: error.message };
      return { requiresVerification: true };
    } catch (err: any) {
      return { error: err?.message || "Email change request failed. Please try again." };
    }
  };

  const changePassword = async (
    newPass: string,
    currentPassword?: string
  ): Promise<{ error?: string }> => {
    if (!newPass || newPass.length < 8) {
      return { error: "Password must be at least 8 characters long." };
    }

    if (!isSupabaseConfigured) {
      return { error: AUTH_UNCONFIGURED_ERROR };
    }

    if (!session) {
      return { error: "Your session is inactive or expired. Please sign in or request a new password reset link." };
    }

    const provider = supabaseUser?.app_metadata?.provider || user?.provider || "email";
    if (!isRecoveryMode && provider === "email") {
      if (!currentPassword) {
        return { error: "Please enter your current password to confirm this change." };
      }
      const reauthRes = await reauthenticate(currentPassword);
      if (reauthRes.error) return reauthRes;
    } else if (!isRecoveryMode && currentPassword) {
      const reauthRes = await reauthenticate(currentPassword);
      if (reauthRes.error) return reauthRes;
    }

    try {
      const attributes: any = { password: newPass };
      if (!isRecoveryMode && provider === "email" && currentPassword) {
        // Send current_password atomically with the password change.
        // This works with Supabase's "require current password" Auth setting.
        attributes.current_password = currentPassword;
      }
      const { error } = await supabase.auth.updateUser(attributes);
      if (error) return { error: error.message };
    } catch (err: any) {
      return { error: err?.message || "Password update failed. Please try again." };
    }

    if (isRecoveryMode) {
      setIsRecoveryMode(false);
    }

    const targetEmail = user?.email || supabaseUser?.email;
    NotificationService.notifyPasswordChanged(targetEmail);
    return {};
  };

  const resetPassword = async (emailToUse?: string): Promise<{ error?: string }> => {
    const targetEmail = (emailToUse || user?.email || supabaseUser?.email || "").trim();
    if (!targetEmail || !EMAIL_REGEX.test(targetEmail)) {
      return { error: "Please enter a valid registered email address." };
    }

    if (!isSupabaseConfigured) {
      return { error: AUTH_UNCONFIGURED_ERROR };
    }

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin.replace(/\/+$/, "")}/reset-password`
        : "https://snapfind.ai.studio/reset-password";

    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo,
    });

    if (error) {
      const msg = error.message || "";
      const secondsMatch = msg.match(/after (\d+) seconds/i);
      if (secondsMatch) {
        return { error: `For security purposes, please wait ${secondsMatch[1]} seconds before requesting another password reset email.` };
      }
      if (msg.toLowerCase().includes("rate limit")) {
        return { error: "Email delivery rate limit reached. Please wait a moment before requesting another reset link." };
      }
      return { error: msg };
    }

    NotificationService.notifyAccountRecovery(targetEmail);
    return {};
  };

  const deleteAccount = async (currentPassword?: string): Promise<{ error?: string }> => {
    if (!isSupabaseConfigured || !supabaseUser || !session) {
      return { error: "You must be signed in to permanently delete your account." };
    }

    const provider = supabaseUser.app_metadata?.provider || user?.provider || "email";
    if (provider === "email") {
      if (!currentPassword) return { error: "Enter your current password to confirm account deletion." };
      const reauthRes = await reauthenticate(currentPassword);
      if (reauthRes.error) return reauthRes;
    }

    try {
      const authHeaders = await getAuthBearerHeader();
      const delRes = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      });
      let payload: any = null;
      try { payload = await delRes.json(); } catch {}
      if (!delRes.ok || payload?.success !== true) {
        return { error: payload?.error || `Account deletion failed (HTTP ${delRes.status}). No local data was cleared.` };
      }

      // Only clear local data after the server confirms the Auth user was deleted.
      try { await supabase.auth.signOut({ scope: "local" }); } catch {}
      try {
        const providerStore = StorageManager.getProvider();
        await providerStore.clearAllData();
      } catch (storageError) {
        console.warn("[AuthContext] Local account data cleanup warning:", storageError);
      }
      try { localStorage.clear(); } catch {}

      SubscriptionManager.resetToFree();
      clearUserCache();
      setSession(null);
      setSupabaseUser(null);
      setUser(null);
      SyncEngine.setCurrentUserId("guest");
      return {};
    } catch (err: any) {
      console.error("[AuthContext] Delete account error:", err);
      return { error: err?.message || "Failed to delete account. Your data has not been cleared locally." };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        session,
        entitlement,
        isPro: Boolean(entitlement?.isPro),
        loading,
        isConfigured: isSupabaseConfigured,
        isRecoveryMode,
        setIsRecoveryMode,
        oauthErrorMessage,
        clearOauthError,
        refreshEntitlement,
        signInWithEmail,
        signUpWithEmail,
        resendVerificationEmail,
        signInWithGoogle,
        signOut,
        signOutAllDevices,
        reauthenticate,
        updateName,
        updateUsername,
        updateProfilePicture,
        changeEmail,
        changePassword,
        resetPassword,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

