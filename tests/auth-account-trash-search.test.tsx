import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuthModal } from "../src/components/AuthModal";
import { ResetPasswordView } from "../src/components/ResetPasswordView";
import { AccountPageView } from "../src/components/AccountPageView";
import { TrashView } from "../src/components/TrashView";
import { SearchView } from "../src/components/SearchView";
import { ScreenshotItem, SearchHistoryItem, AppSettings, UserProfile } from "../src/types";

const mockAuthState = {
  user: null as UserProfile | null,
  supabaseUser: null as any,
  session: null as any,
  entitlement: {
    userId: "user-1",
    plan: "free",
    tier: "Free",
    isPro: false,
    isFounder: false,
    features: {
      maxIndexedScreenshots: 250,
      maxAIScansPerMonth: 250,
      maxStorageMB: 1000,
      cloudSync: false,
      advancedSearch: true,
      aiCollections: true,
      priorityProcessing: false,
    },
  },
  isPro: false,
  loading: false,
  isConfigured: true,
  isRecoveryMode: false,
  setIsRecoveryMode: vi.fn(),
  oauthErrorMessage: null as string | null,
  clearOauthError: vi.fn(),
  refreshEntitlement: vi.fn().mockResolvedValue(undefined),
  signInWithEmail: vi.fn().mockResolvedValue({}),
  signUpWithEmail: vi.fn().mockResolvedValue({ message: "Account created successfully." }),
  resendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
  signInWithGoogle: vi.fn().mockResolvedValue({}),
  signOut: vi.fn().mockResolvedValue(undefined),
  signOutAllDevices: vi.fn().mockResolvedValue({}),
  reauthenticate: vi.fn().mockResolvedValue({}),
  updateName: vi.fn().mockResolvedValue({}),
  updateProfilePicture: vi.fn().mockResolvedValue({}),
  changeEmail: vi.fn().mockResolvedValue({ requiresVerification: true }),
  changePassword: vi.fn().mockResolvedValue({}),
  resetPassword: vi.fn().mockResolvedValue({}),
  deleteAccount: vi.fn().mockResolvedValue({}),
};

vi.mock("../src/context/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

vi.mock("../src/services/billing/ManualPaymentService", () => ({
  ManualPaymentService: {
    getMyPaymentRequests: vi.fn().mockResolvedValue([]),
  },
}));

describe("Authentication, Reset Password, Account, Trash & Search Improvements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.user = null;
    mockAuthState.supabaseUser = null;
    mockAuthState.session = null;
    mockAuthState.loading = false;
    mockAuthState.isRecoveryMode = false;
    mockAuthState.oauthErrorMessage = null;
    mockAuthState.signInWithEmail = vi.fn().mockResolvedValue({});
    mockAuthState.signUpWithEmail = vi.fn().mockResolvedValue({ message: "Account created successfully." });
    mockAuthState.resetPassword = vi.fn().mockResolvedValue({});
    mockAuthState.changePassword = vi.fn().mockResolvedValue({});
    mockAuthState.updateName = vi.fn().mockResolvedValue({});
    mockAuthState.changeEmail = vi.fn().mockResolvedValue({ requiresVerification: true });
  });

  describe("1. Login, Signup & Forgot Password (AuthModal)", () => {
    it("switches cleanly between Login, Signup, and Forgot Password without reloading and toggles password visibility", async () => {
      const onClose = vi.fn();
      render(<AuthModal onClose={onClose} initialMode="login" />);

      // Login view checks
      expect(screen.getByText("Sign in to SnapFind AI")).toBeInTheDocument();
      const emailInput = screen.getByLabelText("Email Address") as HTMLInputElement;
      const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
      expect(passwordInput.type).toBe("password");

      // Toggle password visibility
      fireEvent.click(screen.getByRole("button", { name: "Show password" }));
      expect(passwordInput.type).toBe("text");
      fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
      expect(passwordInput.type).toBe("password");

      // Switch Login -> Signup without reload
      fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
      expect(screen.getByText("Create your SnapFind AI account")).toBeInTheDocument();
      expect(screen.getByLabelText("Name (optional)")).toBeInTheDocument();
      expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();

      // Switch Signup -> Login without reload
      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
      expect(screen.getByText("Sign in to SnapFind AI")).toBeInTheDocument();

      // Open Forgot Password form and request reset link
      fireEvent.click(screen.getByRole("button", { name: "Forgot Password?" }));
      expect(screen.getByText("Reset your password")).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "user@example.com" } });
      fireEvent.click(screen.getByRole("button", { name: /Send Reset Link/i }));

      await waitFor(() => {
        expect(mockAuthState.resetPassword).toHaveBeenCalledWith("user@example.com");
      });
      expect(screen.getByText(/Password reset instructions have been sent/i)).toBeInTheDocument();
      expect(emailInput).toBeTruthy();
    });

    it("prevents duplicate submissions while login is in flight", async () => {
      let resolveLogin!: (val: any) => void;
      mockAuthState.signInWithEmail = vi.fn(
        () =>
          new Promise((resolve) => {
            resolveLogin = resolve;
          })
      );

      render(<AuthModal onClose={vi.fn()} initialMode="login" />);

      fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "test@example.com" } });
      fireEvent.change(screen.getByLabelText("Password"), { target: { value: "StrongPass123" } });

      const submitBtn = screen.getByRole("button", { name: "Sign In" });
      fireEvent.click(submitBtn);
      fireEvent.click(submitBtn);

      expect(mockAuthState.signInWithEmail).toHaveBeenCalledTimes(1);
      expect(submitBtn).toBeDisabled();

      resolveLogin({});
      await waitFor(() => {
        expect(mockAuthState.signInWithEmail).toHaveBeenCalledTimes(1);
      });
    });

    it("requires confirm password during signup", () => {
      render(<AuthModal onClose={vi.fn()} initialMode="register" />);

      fireEvent.change(screen.getByLabelText("Name (optional)"), { target: { value: "Wasay" } });
      fireEvent.change(screen.getByLabelText("Email Address"), { target: { value: "wasay@example.com" } });
      fireEvent.change(screen.getByLabelText("Password"), { target: { value: "StrongPass123" } });

      fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
      expect(screen.getAllByText("Please confirm your password.").length).toBeGreaterThan(0);
      expect(mockAuthState.signUpWithEmail).not.toHaveBeenCalled();
    });
  });

  describe("2. Dedicated Reset Password Page (ResetPasswordView)", () => {
    it("allows setting a new password when a valid recovery session is active", async () => {
      mockAuthState.session = { access_token: "recovery-session", user: { id: "u1" } };
      mockAuthState.isRecoveryMode = true;

      render(<ResetPasswordView onNavigate={vi.fn()} onOpenAuth={vi.fn()} />);

      expect(screen.getByText("Set a new password")).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "NewSecurePass99!" } });
      fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "NewSecurePass99!" } });
      fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

      await waitFor(() => {
        expect(mockAuthState.changePassword).toHaveBeenCalledWith("NewSecurePass99!");
      });
      expect(screen.getByText("Password updated")).toBeInTheDocument();
    });

    it("shows a request-new-link form when recovery session is missing or expired", async () => {
      mockAuthState.session = null;
      mockAuthState.isRecoveryMode = false;

      render(<ResetPasswordView onNavigate={vi.fn()} onOpenAuth={vi.fn()} />);

      expect(screen.getByText(/reset session is missing or expired/i)).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Registered Email Address"), {
        target: { value: "recover@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Send Reset Link/i }));

      await waitFor(() => {
        expect(mockAuthState.resetPassword).toHaveBeenCalledWith("recover@example.com");
      });
      expect(screen.getByText(/fresh password reset link has been sent/i)).toBeInTheDocument();
    });
  });

  describe("3. Account Page Management (AccountPageView)", () => {
    const baseSettings = { theme: "dark", syncEnabled: true } as AppSettings;

    it("never shows a fake creation date fallback and supports display name, email, and password updates", async () => {
      const userWithoutDate: UserProfile = {
        id: "user-1",
        name: "Wasay",
        email: "wasay@example.com",
        isLoggedIn: true,
        plan: "Free",
        storageLimitMB: 1000,
        provider: "email",
      };
      mockAuthState.user = userWithoutDate;

      const { container } = render(
        <AccountPageView
          user={userWithoutDate}
          isDark={true}
          indexedCount={12}
          settings={baseSettings}
          onUpdateSettings={vi.fn()}
          onOpenAuth={vi.fn()}
        />
      );

      // Must NOT fabricate "August 2026"
      expect(container.textContent).not.toContain("August 2026");
      expect(screen.getByText("Unavailable")).toBeInTheDocument();

      // Inline display name edit
      fireEvent.click(screen.getByRole("button", { name: "Edit Name" }));
      fireEvent.change(screen.getByLabelText("Display Name"), { target: { value: "Abdul Wasay" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => {
        expect(mockAuthState.updateName).toHaveBeenCalledWith("Abdul Wasay");
      });

      // Change Email flow with verification
      fireEvent.click(screen.getByRole("button", { name: "Change Email" }));
      fireEvent.change(screen.getByLabelText("New Email Address"), { target: { value: "new@example.com" } });
      fireEvent.change(screen.getByLabelText("Current Password (Verification)"), {
        target: { value: "CurrentPass123" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Send Verification" }));
      await waitFor(() => {
        expect(mockAuthState.changeEmail).toHaveBeenCalledWith("new@example.com", "CurrentPass123");
      });
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      // Change Password flow
      fireEvent.click(screen.getByRole("button", { name: "Change Password" }));
      fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: "CurrentPass123" } });
      fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "UpdatedPass456!" } });
      fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "UpdatedPass456!" } });
      fireEvent.click(screen.getByRole("button", { name: "Update Password" }));
      await waitFor(() => {
        expect(mockAuthState.changePassword).toHaveBeenCalledWith("UpdatedPass456!", "CurrentPass123");
      });
    });

    it("navigates to pricing from Upgrade to Pro and hides password prompt for OAuth account deletion", () => {
      const onNavigate = vi.fn();
      const googleUser: UserProfile = {
        id: "google-user-1",
        name: "Google User",
        email: "googleuser@example.com",
        isLoggedIn: true,
        plan: "Free",
        storageLimitMB: 1000,
        provider: "google",
      };
      mockAuthState.user = googleUser;

      render(
        <AccountPageView
          user={googleUser}
          isDark={true}
          indexedCount={5}
          settings={baseSettings}
          onUpdateSettings={vi.fn()}
          onOpenAuth={vi.fn()}
          onNavigate={onNavigate}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Upgrade to Pro" }));
      expect(onNavigate).toHaveBeenCalledWith("pricing");

      fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
      expect(screen.getByText("Delete Account Permanently")).toBeInTheDocument();
      expect(screen.queryByLabelText("Confirm Current Password")).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText("Type DELETE")).toBeInTheDocument();
    });
  });

  describe("4. Trash / Recently Deleted (TrashView)", () => {
    const deletedScreenshots: ScreenshotItem[] = [
      {
        id: "del-1",
        user_id: "user-1",
        title: "Flight Boarding Pass",
        summary: "Boarding pass for flight PK302",
        category: "Ticket & Travel",
        imageUrl: "data:image/png;base64,iVBORw0KGgo=",
        createdAt: new Date().toISOString(),
        isDeleted: true,
        deletedAt: new Date().toISOString(),
      },
      {
        id: "del-2",
        user_id: "user-1",
        title: "Electric Utility Bill",
        summary: "Monthly bill receipt",
        category: "Receipt & Invoice",
        imageUrl: "data:image/png;base64,iVBORw0KGgo=",
        createdAt: new Date().toISOString(),
        isDeleted: true,
        deletedAt: new Date().toISOString(),
      },
    ];

    it("requires confirmation before permanent deletion and supports individual Restore & Restore All", () => {
      const onRestore = vi.fn();
      const onRestoreAll = vi.fn();
      const onPermanentDelete = vi.fn();
      const onEmptyTrash = vi.fn();

      render(
        <TrashView
          screenshots={deletedScreenshots}
          isDark={true}
          onRestoreScreenshot={onRestore}
          onBatchRestore={vi.fn()}
          onRestoreAll={onRestoreAll}
          onPermanentDelete={onPermanentDelete}
          onBatchPermanentDelete={vi.fn()}
          onEmptyTrash={onEmptyTrash}
          onSelectScreenshot={vi.fn()}
        />
      );

      // Shows deleted screenshots and 30d retention
      expect(screen.getByText("Flight Boarding Pass")).toBeInTheDocument();
      expect(screen.getByText("Electric Utility Bill")).toBeInTheDocument();

      // Restore single item
      fireEvent.click(screen.getByRole("button", { name: "Restore Flight Boarding Pass" }));
      expect(onRestore).toHaveBeenCalledWith("del-1");

      // Restore All button
      fireEvent.click(screen.getByRole("button", { name: /Restore All/i }));
      expect(onRestoreAll).toHaveBeenCalledTimes(1);

      // Single permanent delete MUST ask for confirmation first
      fireEvent.click(screen.getByRole("button", { name: "Permanently delete Flight Boarding Pass" }));
      expect(onPermanentDelete).not.toHaveBeenCalled();
      expect(screen.getByText("Delete screenshot permanently?")).toBeInTheDocument();

      // Cancel does not delete
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onPermanentDelete).not.toHaveBeenCalled();

      // Confirm deletes permanently
      fireEvent.click(screen.getByRole("button", { name: "Permanently delete Flight Boarding Pass" }));
      fireEvent.click(screen.getByRole("button", { name: "Delete Permanently" }));
      expect(onPermanentDelete).toHaveBeenCalledWith("del-1");

      // Empty Trash asks confirmation before emptying
      fireEvent.click(screen.getByRole("button", { name: /Empty Trash/i }));
      expect(onEmptyTrash).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: /Empty Trash Permanently/i }));
      expect(onEmptyTrash).toHaveBeenCalledTimes(1);
    });
  });

  describe("5. Search Page Improvements (SearchView & SearchBar)", () => {
    const library: ScreenshotItem[] = [
      {
        id: "sc-1",
        title: "Stripe Invoice #4021",
        summary: "Monthly cloud hosting invoice paid via Visa",
        fullText: "STRIPE INVOICE #4021 Amount Paid $49.00",
        category: "Receipt & Invoice",
        tags: ["invoice", "stripe", "billing"],
        keywords: ["hosting", "receipt"],
        imageUrl: "data:image/png;base64,iVBORw0KGgo=",
        createdAt: "2026-08-15T10:00:00.000Z",
      },
      {
        id: "sc-2",
        title: "React Hook Snippet",
        summary: "TypeScript debounce hook example",
        fullText: "export function useDebounce(value, delay)",
        category: "Code & Dev",
        tags: ["react", "typescript"],
        imageUrl: "data:image/png;base64,iVBORw0KGgo=",
        createdAt: "2026-08-18T12:00:00.000Z",
      },
    ];

    const history: SearchHistoryItem[] = [
      {
        id: "h-1",
        query: "stripe invoice",
        timestamp: new Date().toISOString(),
        resultCount: 1,
      },
    ];

    it("renders recent searches, searches OCR/tags/descriptions, displays metadata, and supports Clear Search", () => {
      const onClearHistory = vi.fn();

      const Wrapper: React.FC = () => {
        const [query, setQuery] = useState("");
        const [cat, setCat] = useState<any>("All");
        return (
          <SearchView
            screenshots={library}
            searchResults={[]}
            query={query}
            setQuery={setQuery}
            onExecuteSearch={setQuery}
            selectedCategory={cat}
            setSelectedCategory={setCat}
            isDark={true}
            isSearching={false}
            onSelectScreenshot={vi.fn()}
            onToggleFavorite={vi.fn()}
            onMoveCategory={vi.fn()}
            onDelete={vi.fn()}
            searchHistory={history}
            onDeleteHistoryItem={vi.fn()}
            onClearHistory={onClearHistory}
          />
        );
      };

      render(<Wrapper />);

      // Recent Searches visible on idle view
      expect(screen.getByText("Recent Searches")).toBeInTheDocument();
      expect(screen.getByText("stripe invoice")).toBeInTheDocument();

      // Clicking a recent search runs the query and filters matching cards + metadata tags
      fireEvent.click(screen.getByText("stripe invoice"));
      expect(screen.getByText("Stripe Invoice #4021")).toBeInTheDocument();
      expect(screen.queryByText("React Hook Snippet")).not.toBeInTheDocument();
      expect(screen.getByText("#invoice")).toBeInTheDocument();

      // Clear Search button restores full view
      fireEvent.click(screen.getByRole("button", { name: "Clear Search" }));
      expect(screen.getByText("React Hook Snippet")).toBeInTheDocument();

      // Clear history action works
      fireEvent.click(screen.getByRole("button", { name: "Clear history" }));
      expect(onClearHistory).toHaveBeenCalledTimes(1);
    });

    it("shows loading skeletons instead of empty state while isSearching is true", () => {
      render(
        <SearchView
          screenshots={library}
          searchResults={[]}
          query="nonexistent-term-being-searched"
          setQuery={vi.fn()}
          onExecuteSearch={vi.fn()}
          selectedCategory="All"
          setSelectedCategory={vi.fn()}
          isDark={true}
          isSearching={true}
          onSelectScreenshot={vi.fn()}
          onToggleFavorite={vi.fn()}
          onMoveCategory={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(screen.getByRole("status", { name: "Searching screenshots" })).toBeInTheDocument();
      expect(screen.queryByText("No matching screenshots found")).not.toBeInTheDocument();
    });
  });
});
