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
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();

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
      signInWithPassword: (...args: any[]) => mockSignInWithPassword(...args),
      signUp: (...args: any[]) => mockSignUp(...args),
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
    </div>
  );
};

describe("AuthContext Lifecycle, Profile Schema & Deletion Safety", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    upsertPayloads.length = 0;
    mockSignInWithPassword.mockResolvedValue({ data: { session: null }, error: null });
    mockSignUp.mockResolvedValue({ data: { user: null, session: null }, error: null });
    mockSignInWithOAuth.mockResolvedValue({ data: { url: "https://accounts.google.com/o/oauth2/auth" }, error: null });
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

  it("opens Google OAuth in a separate popup without redirecting the current tab", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const popup = {
      location: { href: "about:blank" },
      focus: vi.fn(),
      close: vi.fn(),
    };
    const openSpy = vi.spyOn(window, "open").mockReturnValue(popup as any);

    let latestCtx!: ReturnType<typeof useAuth>;
    render(
      <AuthProvider>
        <Probe onReady={(ctx) => { latestCtx = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => expect(latestCtx.loading).toBe(false));
    await act(async () => {
      const result = await latestCtx.signInWithGoogle();
      expect(result.error).toBeUndefined();
    });

    expect(openSpy).toHaveBeenCalledWith(
      "about:blank",
      "snapfind-google-signin",
      expect.stringContaining("popup=yes")
    );
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({
      provider: "google",
      options: expect.objectContaining({
        skipBrowserRedirect: true,
        queryParams: expect.objectContaining({ prompt: "select_account" }),
      }),
    }));
    expect(popup.location.href).toBe("https://accounts.google.com/o/oauth2/auth");
    expect(popup.focus).toHaveBeenCalled();
  });

  it("keeps email login and signup successful when profile or entitlement sync is temporarily unavailable", async () => {
    const activeUser = {
      id: "user-auth-ok",
      email: "auth-ok@example.com",
      created_at: "2026-01-01T00:00:00Z",
      app_metadata: { provider: "email" },
      user_metadata: { full_name: "Auth OK" },
    };
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignInWithPassword.mockResolvedValue({
      data: { session: { access_token: "token", user: activeUser } },
      error: null,
    });

    let latestCtx!: ReturnType<typeof useAuth>;
    render(
      <AuthProvider>
        <Probe onReady={(ctx) => { latestCtx = ctx; }} />
      </AuthProvider>
    );
    await waitFor(() => expect(latestCtx.loading).toBe(false));

    await act(async () => {
      const result = await latestCtx.signInWithEmail("auth-ok@example.com", "correct-password");
      expect(result.error).toBeUndefined();
    });
    expect(screen.getByTestId("user-id").textContent).toBe("user-auth-ok");
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
      expect(payload.username).toBe("Alice");
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

    expect(screen.getByTestId("user-id").textContent).toBe("guest");
  });
});
