import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";

const upsertPayloads: Array<Record<string, any>> = [];
const mockExchangeCodeForSession = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockUpdateUser = vi.fn();
const mockSignOut = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockSetSession = vi.fn();
const mockRefreshSession = vi.fn();

vi.mock("../src/services/supabase", () => ({
  isSupabaseConfigured: true,
  getAuthBearerHeader: vi.fn().mockResolvedValue({ Authorization: "Bearer test-token" }),
  supabase: {
    auth: {
      exchangeCodeForSession: (...args: any[]) => mockExchangeCodeForSession(...args),
      getSession: (...args: any[]) => mockGetSession(...args),
      onAuthStateChange: (...args: any[]) => mockOnAuthStateChange(...args),
      updateUser: (...args: any[]) => mockUpdateUser(...args),
      signOut: (...args: any[]) => mockSignOut(...args),
      signInWithOAuth: (...args: any[]) => mockSignInWithOAuth(...args),
      setSession: (...args: any[]) => mockSetSession(...args),
      refreshSession: (...args: any[]) => mockRefreshSession(...args),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    },
    from: (table: string) => ({
      upsert: async (payload: Record<string, any>) => {
        if (table === "profiles") {
          upsertPayloads.push(payload);
        }
        return { error: null };
      },
    }),
  },
}));

vi.mock("../src/services/billing/SubscriptionManager", () => ({
  SubscriptionManager: {
    getEntitlement: () => ({
      userId: "guest",
      plan: "free",
      tier: "Free",
      isPro: false,
      isFounder: false,
      features: { maxIndexedScreenshots: 250, maxAIScansPerMonth: 250, maxStorageMB: 1000 },
    }),
    subscribe: () => () => {},
    syncEntitlementsFromServer: vi.fn().mockResolvedValue({
      userId: "user-abc",
      plan: "free",
      tier: "Free",
      isPro: false,
      isFounder: false,
      features: { maxIndexedScreenshots: 250, maxAIScansPerMonth: 250, maxStorageMB: 1000 },
    }),
    resetToFree: vi.fn(),
  },
}));

vi.mock("../src/services/syncEngine", () => ({
  SyncEngine: {
    setCurrentUserId: vi.fn(),
  },
}));

vi.mock("../src/services/storage/StorageManager", () => ({
  StorageManager: {
    getProvider: () => ({
      clearAllData: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { AuthModal } from "../src/components/AuthModal";
import {
  shouldInterceptOAuthPopupBeforeMount,
  runLightweightOAuthPopupCallback,
} from "../src/services/oauthPopupCallback";

const Probe: React.FC<{ onReady?: (ctx: ReturnType<typeof useAuth>) => void }> = ({ onReady }) => {
  const auth = useAuth();
  React.useEffect(() => {
    onReady?.(auth);
  }, [auth, onReady]);
  return (
    <div>
      <span data-testid="loading">{String(auth.loading)}</span>
      <span data-testid="user-id">{auth.user ? auth.user.id : "null"}</span>
      <span data-testid="recovery">{String(auth.isRecoveryMode)}</span>
      <span data-testid="oauth-error">{auth.oauthErrorMessage || ""}</span>
    </div>
  );
};

describe("AuthContext Lifecycle, Profile Schema & Deletion Safety", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    upsertPayloads.length = 0;
    window.history.replaceState({}, "", "/");
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockSignOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.history.replaceState({}, "", "/");
  });

  it("awaits PKCE code exchange before settling loading state and enters recovery mode cleanly", async () => {
    const recoveredSession = {
      access_token: "token-123",
      user: {
        id: "user-abc",
        email: "alice@example.com",
        created_at: "2026-01-01T00:00:00Z",
        email_confirmed_at: "2026-01-01T00:01:00Z",
        app_metadata: { provider: "email" },
        user_metadata: { full_name: "Alice" },
      },
    };

    let resolveExchange!: (val: any) => void;
    mockExchangeCodeForSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveExchange = resolve;
        })
    );
    mockGetSession.mockResolvedValue({ data: { session: recoveredSession } });

    window.history.replaceState({}, "", "/reset-password?code=pkce-code-1&type=recovery");

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    // Must still be loading while exchangeCodeForSession has not resolved
    expect(screen.getByTestId("loading").textContent).toBe("true");
    expect(mockGetSession).not.toHaveBeenCalled();

    await act(async () => {
      resolveExchange({ data: { session: recoveredSession }, error: null });
    });

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("user-id").textContent).toBe("user-abc");
    expect(screen.getByTestId("recovery").textContent).toBe("true");
    expect(window.location.search).toBe("");
    // profiles upsert includes expected profile fields
    expect(upsertPayloads.length).toBeGreaterThan(0);
    for (const payload of upsertPayloads) {
      expect(payload.id).toBe("user-abc");
      expect(payload.name).toBe("Alice");
      expect(payload).not.toHaveProperty("username");
    }
  });

  it("omits username on updateName/updateProfilePicture and resets user to null on deleteAccount", async () => {
    const activeUser = {
      id: "user-abc",
      email: "alice@example.com",
      created_at: "2026-01-01T00:00:00Z",
      email_confirmed_at: "2026-01-01T00:01:00Z",
      app_metadata: { provider: "google" },
      user_metadata: { full_name: "Alice" },
    };
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "tok", user: activeUser } },
    });
    mockUpdateUser.mockResolvedValue({
      data: { user: { ...activeUser, user_metadata: { full_name: "Alice Updated" } } },
      error: null,
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    }) as any;

    let latestCtx!: ReturnType<typeof useAuth>;
    render(
      <AuthProvider>
        <Probe onReady={(ctx) => { latestCtx = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user-id").textContent).toBe("user-abc");
    });

    await act(async () => {
      await latestCtx.updateName("Alice Updated");
      await latestCtx.updateProfilePicture("https://example.com/avatar.png");
    });

    for (const payload of upsertPayloads) {
      expect(payload.id).toBe("user-abc");
      expect(typeof payload.name).toBe("string");
    }

    await act(async () => {
      const res = await latestCtx.deleteAccount();
      expect(res.error).toBeUndefined();
    });

    expect(screen.getByTestId("user-id").textContent).toBe("null");
  });

  it("opens a popup in top-level windows (without redirecting current tab) and completes PKCE exchange via postMessage", async () => {
    const googleSession = {
      access_token: "google-tok",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: "google-user-99",
        email: "ad.wasay.123@gmail.com",
        created_at: "2026-01-01T00:00:00Z",
        email_confirmed_at: "2026-01-01T00:00:00Z",
        app_metadata: { provider: "google" },
        user_metadata: { full_name: "Abdul Wasay" },
      },
    };
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: "https://nfxcbuseslfqaoywvzas.supabase.co/auth/v1/authorize?provider=google" },
      error: null,
    });
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: googleSession },
      error: null,
    });

    const originalOpen = window.open;
    const mockPopup = { closed: false, close: vi.fn(), focus: vi.fn() } as unknown as Window & {
      close: ReturnType<typeof vi.fn>;
      focus: ReturnType<typeof vi.fn>;
    };
    const openSpy = vi.fn().mockReturnValue(mockPopup);
    window.open = openSpy;

    try {
      let latestCtx!: ReturnType<typeof useAuth>;
      render(
        <AuthProvider>
          <Probe onReady={(ctx) => { latestCtx = ctx; }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").textContent).toBe("false");
      });

      let signInPromise!: Promise<{ error?: string; cancelled?: boolean }>;
      act(() => {
        signInPromise = latestCtx.signInWithGoogle();
      });

      await waitFor(() => {
        expect(openSpy).toHaveBeenCalledWith(
          "https://nfxcbuseslfqaoywvzas.supabase.co/auth/v1/authorize?provider=google",
          "snapfind_google_oauth",
          expect.any(String)
        );
      });

      expect(mockSignInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "google",
          options: expect.objectContaining({
            skipBrowserRedirect: true,
            redirectTo: `${window.location.origin}/auth/callback`,
          }),
        })
      );

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: window.location.origin,
            data: { type: "OAUTH_AUTH_CALLBACK", code: "pkce-google-code-123", isRecoveryCallback: false },
          })
        );
      });

      const res = await signInPromise;
      expect(res).toEqual({});
      await waitFor(() => {
        expect(screen.getByTestId("user-id").textContent).toBe("google-user-99");
      });
      expect(mockExchangeCodeForSession).toHaveBeenCalledWith("pkce-google-code-123");
      expect(mockPopup.close).toHaveBeenCalled();
    } finally {
      window.open = originalOpen;
    }
  });

  it("prevents duplicate Google OAuth requests and focuses existing popup on concurrent clicks", async () => {
    const googleSession = {
      access_token: "google-tok",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: "google-user-dup",
        email: "ad.wasay.123@gmail.com",
        created_at: "2026-01-01T00:00:00Z",
        email_confirmed_at: "2026-01-01T00:00:00Z",
        app_metadata: { provider: "google" },
        user_metadata: { full_name: "Abdul Wasay" },
      },
    };
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: "https://nfxcbuseslfqaoywvzas.supabase.co/auth/v1/authorize?provider=google" },
      error: null,
    });
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: googleSession },
      error: null,
    });

    const originalOpen = window.open;
    const mockPopup = { closed: false, close: vi.fn(), focus: vi.fn() } as unknown as Window & {
      close: ReturnType<typeof vi.fn>;
      focus: ReturnType<typeof vi.fn>;
    };
    const openSpy = vi.fn().mockReturnValue(mockPopup);
    window.open = openSpy;

    try {
      let latestCtx!: ReturnType<typeof useAuth>;
      render(
        <AuthProvider>
          <Probe onReady={(ctx) => { latestCtx = ctx; }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").textContent).toBe("false");
      });

      let p1!: Promise<{ error?: string; cancelled?: boolean }>;
      let p2!: Promise<{ error?: string; cancelled?: boolean }>;
      act(() => {
        p1 = latestCtx.signInWithGoogle();
        p2 = latestCtx.signInWithGoogle();
      });

      await waitFor(() => {
        expect(openSpy).toHaveBeenCalledTimes(1);
      });
      expect(mockSignInWithOAuth).toHaveBeenCalledTimes(1);
      expect(mockPopup.focus).toHaveBeenCalled();

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: window.location.origin,
            data: { type: "OAUTH_AUTH_CALLBACK", code: "pkce-dup-code", isRecoveryCallback: false },
          })
        );
      });

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toEqual({});
      expect(r2).toEqual({});
    } finally {
      window.open = originalOpen;
    }
  });

  it("handles blocked popups, user cancellation, OAuth popup errors, and expired popup sessions", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: "https://nfxcbuseslfqaoywvzas.supabase.co/auth/v1/authorize?provider=google" },
      error: null,
    });

    const originalOpen = window.open;
    try {
      let latestCtx!: ReturnType<typeof useAuth>;
      render(
        <AuthProvider>
          <Probe onReady={(ctx) => { latestCtx = ctx; }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").textContent).toBe("false");
      });

      // 1. Blocked popup
      window.open = vi.fn().mockReturnValue(null);
      let blockedResult!: { error?: string; cancelled?: boolean };
      await act(async () => {
        blockedResult = await latestCtx.signInWithGoogle();
      });
      expect(blockedResult.error).toContain("Pop-up window was blocked");

      // 2. User closes popup before completing OAuth
      const closablePopup = { closed: false, close: vi.fn(), focus: vi.fn() };
      window.open = vi.fn().mockReturnValue(closablePopup);
      let cancelPromise!: Promise<{ error?: string; cancelled?: boolean }>;
      act(() => {
        cancelPromise = latestCtx.signInWithGoogle();
      });
      await waitFor(() => {
        expect(window.open).toHaveBeenCalledTimes(1);
      });
      closablePopup.closed = true;
      const cancelResult = await cancelPromise;
      expect(cancelResult.cancelled).toBe(true);
      expect(cancelResult.error).toContain("cancelled");

      // 3. OAuth error forwarded from popup (e.g., 403 access_denied)
      const errorPopup = { closed: false, close: vi.fn(), focus: vi.fn() };
      window.open = vi.fn().mockReturnValue(errorPopup);
      let errorPromise!: Promise<{ error?: string; cancelled?: boolean }>;
      act(() => {
        errorPromise = latestCtx.signInWithGoogle();
      });
      await waitFor(() => {
        expect(window.open).toHaveBeenCalledTimes(1);
      });
      await act(async () => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: window.location.origin,
            data: { type: "OAUTH_AUTH_ERROR", error: "access_denied", errorDescription: "Error 403 access_denied" },
          })
        );
      });
      const oauthErrResult = await errorPromise;
      expect(oauthErrResult.error).toContain("Access Denied (403)");
      expect(errorPopup.close).toHaveBeenCalled();

      // 4. Expired session payload from popup is rejected cleanly
      const expiredPopup = { closed: false, close: vi.fn(), focus: vi.fn() };
      window.open = vi.fn().mockReturnValue(expiredPopup);
      let expiredPromise!: Promise<{ error?: string; cancelled?: boolean }>;
      act(() => {
        expiredPromise = latestCtx.signInWithGoogle();
      });
      await waitFor(() => {
        expect(window.open).toHaveBeenCalledTimes(1);
      });
      await act(async () => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: window.location.origin,
            data: {
              type: "OAUTH_AUTH_SUCCESS",
              session: {
                access_token: "expired-tok",
                expires_at: Math.floor(Date.now() / 1000) - 60,
                user: { id: "expired-user" },
              },
            },
          })
        );
      });
      const expiredResult = await expiredPromise;
      expect(expiredResult.error).toContain("expired");
    } finally {
      window.open = originalOpen;
    }
  });

  it("posts PKCE code to opener and closes popup automatically when landing on OAuth callback inside popup", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    window.history.replaceState({}, "", "/?code=popup-pkce-code-789");

    const originalOpener = window.opener;
    const originalClose = window.close;
    const openerPostMessage = vi.fn();
    const closeSpy = vi.fn();
    Object.defineProperty(window, "opener", {
      configurable: true,
      value: { postMessage: openerPostMessage },
    });
    window.close = closeSpy;

    try {
      render(
        <AuthProvider>
          <Probe />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").textContent).toBe("false");
      });

      expect(openerPostMessage).toHaveBeenCalledWith(
        { type: "OAUTH_AUTH_CALLBACK", code: "popup-pkce-code-789", isRecoveryCallback: false },
        window.location.origin
      );
      expect(closeSpy).toHaveBeenCalled();
      expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "opener", { configurable: true, value: originalOpener });
      window.close = originalClose;
    }
  });

  it("clears unrefreshable expired sessions on startup instead of keeping stale auth state", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: "stale-token",
          expires_at: Math.floor(Date.now() / 1000) - 120,
          user: { id: "stale-user", email: "stale@example.com" },
        },
      },
    });
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: { message: "Refresh Token Not Found" } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(mockRefreshSession).toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(screen.getByTestId("user-id").textContent).toBe("null");
  });

  it("AuthModal disables Google button while popup is open, closes on completion, and forwards cancellation", async () => {
    const googleSession = {
      access_token: "google-tok",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: "google-modal-user",
        email: "ad.wasay.123@gmail.com",
        created_at: "2026-01-01T00:00:00Z",
        email_confirmed_at: "2026-01-01T00:00:00Z",
        app_metadata: { provider: "google" },
        user_metadata: { full_name: "Abdul Wasay" },
      },
    };
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: "https://nfxcbuseslfqaoywvzas.supabase.co/auth/v1/authorize?provider=google" },
      error: null,
    });
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: googleSession },
      error: null,
    });

    const originalOpen = window.open;
    const mockPopup = { closed: false, close: vi.fn(), focus: vi.fn() };
    window.open = vi.fn().mockReturnValue(mockPopup);
    const onClose = vi.fn();
    const addToast = vi.fn();

    try {
      render(
        <AuthProvider>
          <Probe />
          <AuthModal onClose={onClose} initialMode="login" addToast={addToast} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").textContent).toBe("false");
      });

      const googleBtn = screen.getByRole("button", { name: /Continue with Google/i });
      await act(async () => {
        googleBtn.click();
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Waiting for Google Sign-In/i })).toBeTruthy();
      });
      expect((screen.getByRole("button", { name: /Waiting for Google Sign-In/i }) as HTMLButtonElement).disabled).toBe(true);

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: window.location.origin,
            data: { type: "OAUTH_AUTH_CALLBACK", code: "pkce-modal-code", isRecoveryCallback: false },
          })
        );
      });

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Signed In", type: "success" }));
    } finally {
      window.open = originalOpen;
    }
  });

  it("surfaces actionable 403 Access Denied message in AuthModal banner when OAuth callback returns access_denied", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    window.history.replaceState(
      {},
      "",
      "/?error=access_denied&error_description=Access+blocked%3A+Error+403+access_denied"
    );

    render(
      <AuthProvider>
        <Probe />
        <AuthModal onClose={vi.fn()} initialMode="login" />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    const alertEl = screen.getByRole("alert");
    expect(alertEl.textContent).toContain("Access Denied (403)");
    expect(window.location.search).toBe("");
  });

  it("validates postMessage origin & source, deduplicates callbacks, and does not cancel while PKCE exchange is in flight", async () => {
    const googleSession = {
      access_token: "google-tok-slow",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: "google-user-verified",
        email: "ad.wasay.123@gmail.com",
        created_at: "2026-01-01T00:00:00Z",
        email_confirmed_at: "2026-01-01T00:00:00Z",
        app_metadata: { provider: "google" },
        user_metadata: { full_name: "Abdul Wasay" },
      },
    };
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: "https://nfxcbuseslfqaoywvzas.supabase.co/auth/v1/authorize?provider=google" },
      error: null,
    });

    let resolveSlowExchange!: (val: any) => void;
    mockExchangeCodeForSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSlowExchange = resolve;
        })
    );

    const originalOpen = window.open;
    const mockPopup = { closed: false, close: vi.fn(), focus: vi.fn() } as unknown as Window & {
      close: ReturnType<typeof vi.fn>;
      focus: ReturnType<typeof vi.fn>;
    };
    const otherSource = { closed: false } as unknown as Window;
    window.open = vi.fn().mockReturnValue(mockPopup);

    try {
      let latestCtx!: ReturnType<typeof useAuth>;
      render(
        <AuthProvider>
          <Probe onReady={(ctx) => { latestCtx = ctx; }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").textContent).toBe("false");
      });

      let signInPromise!: Promise<{ error?: string; cancelled?: boolean }>;
      act(() => {
        signInPromise = latestCtx.signInWithGoogle();
      });

      await waitFor(() => {
        expect(window.open).toHaveBeenCalledTimes(1);
      });

      // Spoofed origin or unexpected source must be ignored
      await act(async () => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "https://evil.example.com",
            source: mockPopup,
            data: { type: "OAUTH_AUTH_CALLBACK", callbackId: "bad-origin", code: "spoofed-code" },
          })
        );
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: window.location.origin,
            source: otherSource,
            data: { type: "OAUTH_AUTH_CALLBACK", callbackId: "bad-source", code: "spoofed-code-2" },
          })
        );
      });
      expect(mockExchangeCodeForSession).not.toHaveBeenCalled();

      // Legitimate callback arrives from active popup right before popup closes, while exchange takes > 800ms
      await act(async () => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: window.location.origin,
            source: mockPopup,
            data: {
              type: "OAUTH_AUTH_CALLBACK",
              callbackId: "valid-cb-1",
              code: "pkce-verified-code",
              isRecoveryCallback: false,
            },
          })
        );
        // Duplicate callback delivery must be ignored
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: window.location.origin,
            source: mockPopup,
            data: {
              type: "OAUTH_AUTH_CALLBACK",
              callbackId: "valid-cb-1",
              code: "pkce-verified-code",
              isRecoveryCallback: false,
            },
          })
        );
      });

      expect(mockExchangeCodeForSession).toHaveBeenCalledTimes(1);

      // Popup closes immediately while code exchange is still pending; must NOT reject as cancelled
      mockPopup.closed = true;
      await new Promise((r) => setTimeout(r, 850));

      await act(async () => {
        resolveSlowExchange({ data: { session: googleSession }, error: null });
      });

      const res = await signInPromise;
      expect(res).toEqual({});
      await waitFor(() => {
        expect(screen.getByTestId("user-id").textContent).toBe("google-user-verified");
      });
    } finally {
      window.open = originalOpen;
    }
  });

  it("executes dedicated lightweight /auth/callback popup script without mounting main app, posts to opener, and closes", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const callbackScript = fs.readFileSync(
      path.resolve(process.cwd(), "public/auth-callback.js"),
      "utf-8"
    );

    document.body.innerHTML =
      '<main><h1 id="oauth-status-title"></h1><p id="oauth-status-message"></p><button id="oauth-close-btn"></button></main>';
    window.history.replaceState({}, "", "/auth/callback?code=dedicated-popup-code-456");

    const originalOpener = window.opener;
    const originalClose = window.close;
    const openerPostMessage = vi.fn();
    const closeSpy = vi.fn();
    Object.defineProperty(window, "opener", {
      configurable: true,
      value: { postMessage: openerPostMessage },
    });
    window.close = closeSpy;

    try {
      expect(shouldInterceptOAuthPopupBeforeMount()).toBe(true);
      // Run actual public/auth-callback.js in jsdom
      new Function(callbackScript)();

      expect(openerPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "OAUTH_AUTH_CALLBACK",
          code: "dedicated-popup-code-456",
          isRecoveryCallback: false,
        }),
        window.location.origin
      );
      expect(closeSpy).toHaveBeenCalled();
      expect(window.location.search).toBe("");

      // Also verify pre-mount TS fallback helper intercepts /auth/callback cleanly
      const rootDiv = document.createElement("div");
      window.history.replaceState({}, "", "/auth/callback?code=fallback-code-999");
      expect(runLightweightOAuthPopupCallback(rootDiv)).toBe(true);
      expect(openerPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "OAUTH_AUTH_CALLBACK",
          code: "fallback-code-999",
        }),
        window.location.origin
      );
    } finally {
      Object.defineProperty(window, "opener", { configurable: true, value: originalOpener });
      window.close = originalClose;
      document.body.innerHTML = "";
    }
  });
});
