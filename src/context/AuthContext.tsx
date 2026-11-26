import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured, getAuthBearerHeader } from "../services/supabase";
import { UserProfile, UserEntitlement } from "../types";
import { saveUserProfile, clearUserCache } from "../services/storage.ts";
import { StorageManager } from "../services/storage/StorageManager";
import { SyncEngine } from "../services/syncEngine";
import { SubscriptionManager } from "../services/billing/SubscriptionManager";
import { NotificationService } from "../services/notificationService";

export interface GoogleSignInResult {
  error?: string;
  cancelled?: boolean;
}

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
  signInWithGoogle: () => Promise<GoogleSignInResult>;
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
const OAUTH_POPUP_NAME = "snapfind_google_oauth";
const OAUTH_CHANNEL_NAME = "snapfind_oauth_channel";
const OAUTH_POPUP_TIMEOUT_MS = 5 * 60 * 1000;

let activeCallbackKey: string | null = null;
let activeCallbackPromise: Promise<{ session?: Session | null; error?: string; isRecoveryCallback?: boolean; closedPopup?: boolean }> | null = null;

function isSessionExpired(targetSession: Session | null | undefined): boolean {
  if (!targetSession) return false;
  if (typeof targetSession.expires_at !== "number") return false;
  return targetSession.expires_at * 1000 <= Date.now();
}

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
  const oauthPopupRef = useRef<Window | null>(null);
  const pendingOAuthPromiseRef = useRef<Promise<GoogleSignInResult> | null>(null);
  const settlePendingOAuthRef = useRef<((result: GoogleSignInResult) => void) | null>(null);
  const markOAuthCallbackReceivedRef = useRef<(() => void) | null>(null);
  const processedCallbackIdsRef = useRef<Set<string>>(new Set());
  const completedOAuthCodesRef = useRef<Set<string>>(new Set());
  const inFlightCodeExchangesRef = useRef<Map<string, Promise<Session | null>>>(new Map());

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

    const formatOAuthErrorMessage = (rawErr: string, isRecovery: boolean): string => {
      if (isRecovery) {
        return "Your password reset link is invalid or has expired. Please request a new reset link.";
      }
      const lower = rawErr.toLowerCase();
      if (lower.includes("access_denied") || lower.includes("access denied") || lower.includes("403")) {
        return "Google Sign-In returned Access Denied (403). If your Google OAuth consent screen is in Testing mode, add your Google account under Test Users or publish the app to Production in Google Cloud Console.";
      }
      if (lower.includes("redirect_uri_mismatch")) {
        return "Google Sign-In redirect URI mismatch. Ensure the Supabase /auth/v1/callback URL is registered in Google Cloud Authorized Redirect URIs.";
      }
      if (lower.includes("expired") || lower.includes("code verifier") || lower.includes("invalid flow")) {
        return "Your Google Sign-In session expired or could not be verified. Please try signing in again.";
      }
      return `Google sign-in could not be completed (${rawErr}). Please try again.`;
    };

    const postToBroadcastChannel = (message: Record<string, any>) => {
      if (typeof BroadcastChannel === "undefined") return;
      try {
        const channel = new BroadcastChannel(OAUTH_CHANNEL_NAME);
        channel.postMessage(message);
        channel.close();
      } catch {
        // Ignore BroadcastChannel errors in restricted contexts
      }
    };

    const applyAuthenticatedSession = async (
      nextSession: Session,
      isRecoveryCallback: boolean
    ) => {
      setSession(nextSession);
      setSupabaseUser(nextSession.user);
      await syncProfile(nextSession.user);
      SyncEngine.setCurrentUserId(nextSession.user.id);
      setOauthErrorMessage(null);
      if (isRecoveryCallback) {
        setIsRecoveryMode(true);
      }
    };

    const completeCodeExchange = async (
      code: string,
      isRecoveryCallback: boolean,
      flowId?: string
    ): Promise<Session | null> => {
      const existingInFlight = inFlightCodeExchangesRef.current.get(code);
      if (existingInFlight) {
        return existingInFlight;
      }

      const exchangePromise = (async () => {
        const exchangeFn = supabase.auth.exchangeCodeForSession as unknown as (
          authCode: string,
          options?: { flowId?: string }
        ) => Promise<{ data: { session: Session | null } | null; error: any }>;

        const { data, error } = flowId
          ? await exchangeFn.call(supabase.auth, code, { flowId })
          : await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          const existing = await supabase.auth.getSession().catch(() => null);
          if (existing?.data?.session && !isSessionExpired(existing.data.session)) {
            const existingSession = existing.data.session;
            await applyAuthenticatedSession(existingSession, isRecoveryCallback);
            completedOAuthCodesRef.current.add(code);
            return existingSession;
          }
          throw error;
        }

        if (data?.session) {
          if (isSessionExpired(data.session)) {
            throw new Error("OAuth session expired. Please sign in again.");
          }
          await applyAuthenticatedSession(data.session, isRecoveryCallback);
          completedOAuthCodesRef.current.add(code);
          return data.session;
        }
        return null;
      })().finally(() => {
        inFlightCodeExchangesRef.current.delete(code);
      });

      inFlightCodeExchangesRef.current.set(code, exchangePromise);
      return exchangePromise;
    };

    // 1. Callback Handler: Exchange OAuth / Recovery code or hash token for session (StrictMode-safe)
    const processAuthCallback = async () => {
      const searchStr = window.location.search || "";
      const hashStr = window.location.hash || "";
      const urlParams = new URLSearchParams(searchStr);
      const oauthError = urlParams.get("error");
      const oauthErrorDescription = urlParams.get("error_description");
      const oauthErrorCode = urlParams.get("error_code");
      const code = urlParams.get("code");
      const tokenHash = urlParams.get("token_hash");
      const queryType = urlParams.get("type");

      const hashParams =
        hashStr && (hashStr.includes("=") || hashStr.includes("access_token") || hashStr.includes("error"))
          ? new URLSearchParams(hashStr.replace(/^#\/?/, ""))
          : null;
      const hashError = hashParams?.get("error") || null;
      const hashErrorDescription = hashParams?.get("error_description") || null;
      const hashErrorCode = hashParams?.get("error_code") || null;
      const hashType = hashParams?.get("type") || null;
      const hashAccessToken = hashParams?.get("access_token") || null;
      const hashRefreshToken = hashParams?.get("refresh_token") || null;

      const hasCallbackParams = Boolean(
        oauthError || hashError || code || tokenHash || (hashStr && hashStr.includes("access_token"))
      );
      if (!hasCallbackParams) return;

      const callbackKey = `${window.location.pathname}|${searchStr}|${hashStr}`;
      if (activeCallbackKey === callbackKey && activeCallbackPromise) {
        const sharedResult = await activeCallbackPromise;
        if (sharedResult.isRecoveryCallback) setIsRecoveryMode(true);
        if (sharedResult.session) {
          await applyAuthenticatedSession(sharedResult.session, Boolean(sharedResult.isRecoveryCallback));
        } else if (sharedResult.error) {
          setOauthErrorMessage(sharedResult.error);
        }
        return;
      }

      const runCallback = async () => {
        const isRecoveryCallback =
          queryType === "recovery" ||
          hashType === "recovery" ||
          window.location.pathname === "/reset-password";

        if (queryType === "recovery" || hashType === "recovery") {
          setIsRecoveryMode(true);
        }

        const hasPopupOpener = Boolean(window.opener && window.opener !== window);
        const isOAuthPopupWindow = hasPopupOpener || window.name === OAUTH_POPUP_NAME;

        const deliverErrorToOpenerAndClose = (rawError: string) => {
          const payload = {
            type: "OAUTH_AUTH_ERROR",
            error: oauthError || hashError || rawError,
            errorDescription: rawError,
            isRecoveryCallback,
          };
          if (hasPopupOpener) {
            try {
              window.opener.postMessage(payload, window.location.origin);
            } catch (e) {
              console.warn("[AuthContext] Failed to post OAuth error to popup opener:", e);
              postToBroadcastChannel(payload);
            }
          } else {
            postToBroadcastChannel(payload);
          }
          try {
            window.close();
          } catch {}
        };

        if (oauthError || hashError) {
          const reportedErr =
            oauthErrorDescription ||
            hashErrorDescription ||
            oauthError ||
            hashError ||
            oauthErrorCode ||
            hashErrorCode ||
            "Authentication error";
          console.error(`[AuthContext] Auth callback returned error: ${reportedErr}`);

          if (isOAuthPopupWindow) {
            deliverErrorToOpenerAndClose(reportedErr);
            return { error: null as any, isRecoveryCallback, closedPopup: true };
          }

          const cleanPath = window.location.pathname === "/auth/callback" ? "/" : window.location.pathname;
          window.history.replaceState({}, document.title, cleanPath);
          const formatted = formatOAuthErrorMessage(reportedErr, isRecoveryCallback);
          setOauthErrorMessage(formatted);
          return { error: formatted, isRecoveryCallback };
        }

        if (code) {
          if (hasPopupOpener) {
            // Forward the PKCE authorization code to the original window, which owns the PKCE code_verifier.
            try {
              window.opener.postMessage(
                { type: "OAUTH_AUTH_CALLBACK", code, isRecoveryCallback },
                window.location.origin
              );
              window.close();
              return { isRecoveryCallback, closedPopup: true };
            } catch (e) {
              console.warn("[AuthContext] Failed to post PKCE callback code to opener:", e);
            }
          }

          try {
            const exchangedSession = await completeCodeExchange(code, isRecoveryCallback);
            if (exchangedSession && isOAuthPopupWindow) {
              const payload = { type: "OAUTH_AUTH_SUCCESS", session: exchangedSession };
              if (hasPopupOpener) {
                try {
                  window.opener.postMessage(payload, window.location.origin);
                } catch {
                  postToBroadcastChannel(payload);
                }
              } else {
                postToBroadcastChannel(payload);
              }
              try {
                window.close();
              } catch {}
              return { session: exchangedSession, isRecoveryCallback, closedPopup: true };
            }
            return { session: exchangedSession, isRecoveryCallback };
          } catch (err: any) {
            console.error("[AuthContext] Code exchange failed:", err?.message || err);
            const msg = isRecoveryCallback
              ? "Your password reset link is invalid or has expired. Please request a new link."
              : formatOAuthErrorMessage(err?.message || "Sign-in verification failed", false);
            if (isOAuthPopupWindow) {
              deliverErrorToOpenerAndClose(err?.message || "Sign-in verification failed");
              return { error: msg, isRecoveryCallback, closedPopup: true };
            }
            setOauthErrorMessage(msg);
            return { error: msg, isRecoveryCallback };
          } finally {
            const cleanPath =
              isRecoveryCallback
                ? "/reset-password"
                : window.location.pathname === "/auth/callback"
                ? "/"
                : window.location.pathname;
            window.history.replaceState({}, document.title, cleanPath);
          }
        }

        if (tokenHash && queryType && typeof supabase.auth.verifyOtp === "function") {
          try {
            const { data, error } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: queryType as any,
            });
            if (error) throw error;
            if (data?.session) {
              await applyAuthenticatedSession(data.session, isRecoveryCallback);
              return { session: data.session, isRecoveryCallback };
            }
          } catch (err: any) {
            const msg = isRecoveryCallback
              ? "Your password reset link is invalid or has expired. Please request a new link."
              : formatOAuthErrorMessage(err?.message || "Verification link expired", false);
            setOauthErrorMessage(msg);
            return { error: msg, isRecoveryCallback };
          } finally {
            const cleanPath =
              isRecoveryCallback
                ? "/reset-password"
                : window.location.pathname === "/auth/callback"
                ? "/"
                : window.location.pathname;
            window.history.replaceState({}, document.title, cleanPath);
          }
        }

        if (hashStr && hashStr.includes("access_token")) {
          try {
            let resolvedSession: Session | null = null;
            if (hashAccessToken && hashRefreshToken && typeof supabase.auth.setSession === "function") {
              const { data, error } = await supabase.auth.setSession({
                access_token: hashAccessToken,
                refresh_token: hashRefreshToken,
              });
              if (error) throw error;
              resolvedSession = data?.session ?? null;
            } else {
              const { data } = await supabase.auth.getSession();
              resolvedSession = data?.session ?? null;
            }

            if (resolvedSession) {
              if (isSessionExpired(resolvedSession)) {
                throw new Error("Session has expired. Please sign in again.");
              }
              await applyAuthenticatedSession(resolvedSession, isRecoveryCallback);

              if (isOAuthPopupWindow) {
                const payload = { type: "OAUTH_AUTH_SUCCESS", session: resolvedSession };
                if (hasPopupOpener) {
                  try {
                    window.opener.postMessage(payload, window.location.origin);
                  } catch {
                    postToBroadcastChannel(payload);
                  }
                } else {
                  postToBroadcastChannel(payload);
                }
                try {
                  window.close();
                } catch {}
                return { session: resolvedSession, isRecoveryCallback, closedPopup: true };
              }
              return { session: resolvedSession, isRecoveryCallback };
            }
          } catch (err: any) {
            const msg = isRecoveryCallback
              ? "Your password reset link is invalid or has expired. Please request a new link."
              : formatOAuthErrorMessage(err?.message || "Session expired", false);
            if (isOAuthPopupWindow) {
              deliverErrorToOpenerAndClose(err?.message || "Session expired");
            } else {
              setOauthErrorMessage(msg);
            }
            return { error: msg, isRecoveryCallback };
          } finally {
            const cleanPath =
              isRecoveryCallback
                ? "/reset-password"
                : window.location.pathname === "/auth/callback"
                ? "/"
                : window.location.pathname;
            window.history.replaceState({}, document.title, cleanPath);
          }
        }

        return {};
      };

      activeCallbackKey = callbackKey;
      const promise = runCallback().finally(() => {
        if (activeCallbackKey === callbackKey) {
          activeCallbackKey = null;
          activeCallbackPromise = null;
        }
      });
      activeCallbackPromise = promise;
      await promise;
    };

    let isMounted = true;
    let initialAuthSettled = false;

    // Complete OAuth / recovery callback processing before reading the session.
    // Otherwise getSession() can race the PKCE exchange and render the user as signed out.
    const initializeAuth = async () => {
      try {
        await processAuthCallback();
        if (!isMounted) return;

        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!isMounted) return;

        let activeSession = initialSession;
        if (activeSession && isSessionExpired(activeSession)) {
          if (typeof supabase.auth.refreshSession === "function") {
            const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
            if (!refreshErr && refreshed?.session && !isSessionExpired(refreshed.session)) {
              activeSession = refreshed.session;
            } else {
              await supabase.auth.signOut({ scope: "local" }).catch(() => {});
              activeSession = null;
            }
          } else {
            await supabase.auth.signOut({ scope: "local" }).catch(() => {});
            activeSession = null;
          }
        }
        if (!isMounted) return;

        setSession(activeSession);
        setSupabaseUser(activeSession?.user ?? null);
        if (activeSession?.user) {
          SyncEngine.setCurrentUserId(activeSession.user.id);
          await syncProfile(activeSession.user);
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

    const handleOAuthPayload = async (payload: any) => {
      if (!payload || typeof payload !== "object") return;
      const validTypes = new Set([
        "OAUTH_AUTH_ERROR",
        "OAUTH_AUTH_CALLBACK",
        "OAUTH_AUTH_HASH_TOKENS",
        "OAUTH_AUTH_SUCCESS",
      ]);
      if (!validTypes.has(payload.type)) return;

      if (typeof payload.callbackId === "string" && payload.callbackId) {
        if (processedCallbackIdsRef.current.has(payload.callbackId)) {
          return;
        }
        processedCallbackIdsRef.current.add(payload.callbackId);
      }

      if (payload.type === "OAUTH_AUTH_ERROR") {
        markOAuthCallbackReceivedRef.current?.();
        const reportedErr = String(payload.errorDescription || payload.error || "Authentication error");
        const formatted = formatOAuthErrorMessage(reportedErr, Boolean(payload.isRecoveryCallback));
        setOauthErrorMessage(formatted);
        settlePendingOAuthRef.current?.({ error: formatted });
        return;
      }

      if (payload.type === "OAUTH_AUTH_CALLBACK" && typeof payload.code === "string" && payload.code) {
        if (completedOAuthCodesRef.current.has(payload.code)) {
          return;
        }
        markOAuthCallbackReceivedRef.current?.();
        try {
          const exchangedSession = await completeCodeExchange(
            payload.code,
            Boolean(payload.isRecoveryCallback),
            typeof payload.flowId === "string" ? payload.flowId : undefined
          );
          if (exchangedSession?.user) {
            NotificationService.notifyNewLogin({
              email: exchangedSession.user.email || "",
              platform: "Google / Web",
            });
            settlePendingOAuthRef.current?.({});
          } else {
            const msg = "Google sign-in completed without an active session. Please try again.";
            setOauthErrorMessage(msg);
            settlePendingOAuthRef.current?.({ error: msg });
          }
        } catch (err: any) {
          console.error("[AuthContext] Popup code exchange failed:", err?.message || err);
          const msg = formatOAuthErrorMessage(err?.message || "Verification failed", false);
          setOauthErrorMessage(msg);
          settlePendingOAuthRef.current?.({ error: msg });
        }
        return;
      }

      if (
        payload.type === "OAUTH_AUTH_HASH_TOKENS" &&
        typeof payload.accessToken === "string" &&
        payload.accessToken
      ) {
        markOAuthCallbackReceivedRef.current?.();
        try {
          if (
            typeof payload.expiresAt === "number" &&
            payload.expiresAt * 1000 <= Date.now()
          ) {
            const msg = "Your Google authentication session expired. Please try signing in again.";
            setOauthErrorMessage(msg);
            settlePendingOAuthRef.current?.({ error: msg });
            return;
          }

          if (typeof supabase.auth.setSession !== "function") {
            throw new Error("Session initialization is unavailable.");
          }
          const { data, error } = await supabase.auth.setSession({
            access_token: payload.accessToken,
            refresh_token: typeof payload.refreshToken === "string" ? payload.refreshToken : "",
          });
          if (error) throw error;

          const resolvedSession = data?.session;
          if (!resolvedSession || isSessionExpired(resolvedSession)) {
            const msg = "Your Google authentication session expired. Please try signing in again.";
            setOauthErrorMessage(msg);
            settlePendingOAuthRef.current?.({ error: msg });
            return;
          }

          await applyAuthenticatedSession(resolvedSession, Boolean(payload.isRecoveryCallback));
          NotificationService.notifyNewLogin({
            email: resolvedSession.user?.email || "",
            platform: "Google / Web",
          });
          settlePendingOAuthRef.current?.({});
        } catch (err: any) {
          console.warn("[AuthContext] Failed to apply popup hash tokens:", err?.message || err);
          const msg = formatOAuthErrorMessage(err?.message || "Failed to finalize session", false);
          setOauthErrorMessage(msg);
          settlePendingOAuthRef.current?.({ error: msg });
        }
        return;
      }

      if (payload.type === "OAUTH_AUTH_SUCCESS" && payload.session?.access_token) {
        markOAuthCallbackReceivedRef.current?.();
        try {
          const popupSession = payload.session as Session;
          if (isSessionExpired(popupSession)) {
            const msg = "Your Google authentication session expired. Please try signing in again.";
            setOauthErrorMessage(msg);
            settlePendingOAuthRef.current?.({ error: msg });
            return;
          }

          let resolvedSession = popupSession;
          if (popupSession.refresh_token && typeof supabase.auth.setSession === "function") {
            const { data } = await supabase.auth.setSession({
              access_token: popupSession.access_token,
              refresh_token: popupSession.refresh_token,
            });
            if (data?.session) {
              resolvedSession = data.session;
            }
          }
          await applyAuthenticatedSession(resolvedSession, false);
          NotificationService.notifyNewLogin({
            email: resolvedSession.user?.email || "",
            platform: "Google / Web",
          });
          settlePendingOAuthRef.current?.({});
        } catch (err: any) {
          console.warn("[AuthContext] Failed to apply popup session:", err?.message || err);
          const msg = formatOAuthErrorMessage(err?.message || "Failed to finalize session", false);
          setOauthErrorMessage(msg);
          settlePendingOAuthRef.current?.({ error: msg });
        }
      }
    };

    const handlePopupMessage = (event: MessageEvent) => {
      if (typeof window === "undefined" || event.origin !== window.location.origin) {
        return;
      }
      if (event.source === window) {
        return;
      }
      if (!pendingOAuthPromiseRef.current && !oauthPopupRef.current) {
        return;
      }
      if (oauthPopupRef.current && event.source && event.source !== oauthPopupRef.current) {
        return;
      }
      void handleOAuthPayload(event.data);
    };

    window.addEventListener("message", handlePopupMessage);

    let broadcastChannel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        broadcastChannel = new BroadcastChannel(OAUTH_CHANNEL_NAME);
        broadcastChannel.onmessage = (event) => {
          if (!pendingOAuthPromiseRef.current && !oauthPopupRef.current) {
            return;
          }
          void handleOAuthPayload(event.data);
        };
      } catch {
        broadcastChannel = null;
      }
    }

    return () => {
      isMounted = false;
      window.removeEventListener("message", handlePopupMessage);
      try {
        broadcastChannel?.close();
      } catch {}
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

    // Fetch authoritative server-verified entitlement
    const userEntitlement = await SubscriptionManager.syncEntitlementsFromServer(sbUser.id);
    setEntitlement(userEntitlement);

    const { error: profileSyncError } = await supabase.from("profiles").upsert({
      id: sbUser.id,
      name,
      email: sbUser.email || "",
      avatar_url: avatarUrl || null,
      updated_at: new Date().toISOString(),
    });
    if (profileSyncError) console.warn("[AuthContext] Profile sync warning:", profileSyncError.message);

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

  const signInWithGoogle = async (): Promise<GoogleSignInResult> => {
    if (!isSupabaseConfigured) {
      return { error: AUTH_UNCONFIGURED_ERROR };
    }

    // Prevent duplicate concurrent OAuth flows (which would overwrite the PKCE code_verifier)
    if (pendingOAuthPromiseRef.current) {
      if (oauthPopupRef.current && !oauthPopupRef.current.closed) {
        try {
          oauthPopupRef.current.focus();
        } catch {}
      }
      return pendingOAuthPromiseRef.current;
    }

    const flowPromise = (async (): Promise<GoogleSignInResult> => {
      try {
        const canonicalOrigin =
          typeof window !== "undefined"
            ? window.location.origin.replace(/\/+$/, "")
            : "https://snapfind.ai.studio";

        const redirectTo = `${canonicalOrigin}/auth/callback`;

        // Always obtain the OAuth URL without redirecting the current window so we can open a popup.
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

        if (error) {
          console.error("[AuthContext] Supabase Google OAuth error:", error.message);
          return { error: error.message };
        }

        if (!data?.url) {
          return { error: "Could not initialize Google Sign-In URL. Check Supabase Google provider settings." };
        }

        if (typeof window === "undefined") {
          return { error: "Google Sign-In requires a browser window." };
        }

        const width = 520;
        const height = 660;
        const left = Math.max(0, Math.round((window.screen?.width || 1280) / 2 - width / 2));
        const top = Math.max(0, Math.round((window.screen?.height || 800) / 2 - height / 2));
        const popup = window.open(
          data.url,
          OAUTH_POPUP_NAME,
          `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,status=no,resizable=yes,scrollbars=yes`
        );

        if (!popup || popup.closed || typeof popup.closed === "undefined") {
          return {
            error: "Pop-up window was blocked by your browser. Please allow pop-ups for this site and click Continue with Google again.",
          };
        }

        oauthPopupRef.current = popup;
        try {
          popup.focus();
        } catch {}

        return await new Promise<GoogleSignInResult>((resolve) => {
          let settled = false;
          let callbackReceived = false;
          let closeGraceTimer: ReturnType<typeof setTimeout> | null = null;

          const markCallbackReceived = () => {
            callbackReceived = true;
            if (closeGraceTimer) {
              clearTimeout(closeGraceTimer);
              closeGraceTimer = null;
            }
          };

          const cleanup = () => {
            if (pollTimer) clearInterval(pollTimer);
            if (timeoutTimer) clearTimeout(timeoutTimer);
            if (closeGraceTimer) clearTimeout(closeGraceTimer);
            if (settlePendingOAuthRef.current === settle) {
              settlePendingOAuthRef.current = null;
            }
            if (markOAuthCallbackReceivedRef.current === markCallbackReceived) {
              markOAuthCallbackReceivedRef.current = null;
            }
            if (oauthPopupRef.current === popup) {
              oauthPopupRef.current = null;
            }
          };

          const settle = (result: GoogleSignInResult) => {
            if (settled) return;
            settled = true;
            cleanup();
            try {
              if (!popup.closed) popup.close();
            } catch {}
            resolve(result);
          };

          settlePendingOAuthRef.current = settle;
          markOAuthCallbackReceivedRef.current = markCallbackReceived;

          const pollTimer = setInterval(() => {
            try {
              if (popup.closed && !callbackReceived && !closeGraceTimer) {
                // Allow any postMessage/BroadcastChannel message queued right before window.close() to deliver first.
                closeGraceTimer = setTimeout(() => {
                  if (!callbackReceived) {
                    settle({
                      cancelled: true,
                      error: "Google Sign-In was cancelled before completion.",
                    });
                  }
                }, 450);
              }
            } catch {
              // Cross-origin popup access error ignored until closed
            }
          }, 300);

          const timeoutTimer = setTimeout(() => {
            settle({
              error: "Google Sign-In timed out. Please try again.",
            });
          }, OAUTH_POPUP_TIMEOUT_MS);
        });
      } catch (err: any) {
        console.error("[AuthContext] Supabase Google Auth exception:", err);
        return { error: err?.message || "Google authentication failed" };
      }
    })();

    pendingOAuthPromiseRef.current = flowPromise;
    try {
      return await flowPromise;
    } finally {
      if (pendingOAuthPromiseRef.current === flowPromise) {
        pendingOAuthPromiseRef.current = null;
      }
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

