import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { FounderProvider } from "../src/context/FounderContext";
import { PricingPageView } from "../src/components/PricingPageView";
import { FoundersPageView } from "../src/components/FoundersPageView";
import { FounderBanner } from "../src/components/FounderBanner";
import { FounderBadge } from "../src/components/FounderBadge";

let mockAuthState: any = {
  user: null,
  isPro: false,
  isAuthenticated: false,
  refreshEntitlement: vi.fn(),
};

vi.mock("../src/context/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

function mockFounderStatsFetch(payload: { status?: number; body: any }) {
  const status = payload.status ?? 200;
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/billing/founder-stats")) {
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => payload.body,
      } as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as Response;
  });
}

describe("VIP Seat Counter UI, Error Handling & VIP Copy Verification", () => {
  beforeEach(() => {
    localStorage.clear();
    mockAuthState = {
      user: null,
      isPro: false,
      isAuthenticated: false,
      refreshEntitlement: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("displays 0 / 50 occupied and 50 available accurately for logged-out visitors", async () => {
    mockFounderStatsFetch({
      body: { success: true, totalSpots: 50, occupiedSpots: 0, remainingSpots: 50 },
    });

    const { container } = render(
      <FounderProvider>
        <PricingPageView isDark={true} />
      </FounderProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/0 \/ 50 occupied/i)).toBeInTheDocument();
    });
    expect(screen.getAllByText(/50 Available/i).length).toBeGreaterThan(0);
    expect(container.textContent).toContain("VIP ACCESS");
    expect(container.textContent).not.toMatch(/Pioneer|Founder 50|Founder Plan/i);
  });

  it("displays 1 / 50 and 49 / 50 occupied seats accurately", async () => {
    const spy = mockFounderStatsFetch({
      body: { success: true, totalSpots: 50, occupiedSpots: 1, remainingSpots: 49 },
    });

    const { rerender } = render(
      <FounderProvider>
        <FoundersPageView isDark={true} />
      </FounderProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/1 \/ 50 occupied/i)).toBeInTheDocument();
      expect(screen.getByText(/49 of 50 VIP Seats Available/i)).toBeInTheDocument();
    });

    spy.mockRestore();
    mockFounderStatsFetch({
      body: { success: true, totalSpots: 50, occupiedSpots: 49, remainingSpots: 1 },
    });

    rerender(
      <FounderProvider key="second-view">
        <PricingPageView isDark={true} />
      </FounderProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/49 \/ 50 occupied/i)).toBeInTheDocument();
    });
    expect(screen.getAllByText(/1 Available/i).length).toBeGreaterThan(0);
  });

  it("displays 50 / 50 occupied and disables claim when full", async () => {
    mockFounderStatsFetch({
      body: { success: true, totalSpots: 50, occupiedSpots: 50, remainingSpots: 0 },
    });

    render(
      <FounderProvider>
        <PricingPageView isDark={true} />
      </FounderProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/50 \/ 50 occupied/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /All 50 VIP Seats Occupied/i })).toBeDisabled();
  });

  it("shows temporary unavailable error (never fake 0 / 50) on DB/API failure and recovers on Retry", async () => {
    let shouldFail = true;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/billing/founder-stats")) {
        if (shouldFail) {
          return {
            ok: false,
            status: 503,
            json: async () => ({
              success: false,
              error: "VIP seat availability is temporarily unavailable.",
            }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            totalSpots: 50,
            occupiedSpots: 12,
            remainingSpots: 38,
          }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) } as Response;
    });

    const { container } = render(
      <FounderProvider>
        <PricingPageView isDark={true} />
      </FounderProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/VIP seat availability temporarily unavailable/i)).toBeInTheDocument();
    });

    // Must NEVER fabricate 0 / 50 or 50 Available when authoritative stats fail
    expect(container.textContent).not.toMatch(/0 \/ 50 occupied/i);
    expect(container.textContent).not.toMatch(/50 Available/i);

    // Recover when user clicks Retry
    shouldFail = false;
    const retryBtn = screen.getAllByRole("button", { name: /Retry/i })[0];
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText(/12 \/ 50 occupied/i)).toBeInTheDocument();
    });
  });

  it("refreshes count on window focus (cross-device sync) and shows verified VIP Seat #7", async () => {
    mockAuthState = {
      user: {
        id: "vip-7",
        name: "Wasay",
        email: "ad.wasay.123@gmail.com",
        plan: "Founder",
        entitlement: { isFounder: true, isPro: true, founderNumber: 7 },
      },
      isPro: true,
      isAuthenticated: true,
      refreshEntitlement: vi.fn(),
    };

    let currentOccupied = 7;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        totalSpots: 50,
        occupiedSpots: currentOccupied,
        remainingSpots: 50 - currentOccupied,
      }),
    } as Response));

    const { container } = render(
      <FounderProvider>
        <FounderBanner user={mockAuthState.user} isDark={true} />
        <FounderBadge founderNumber={7} />
        <PricingPageView isDark={true} />
      </FounderProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/7 \/ 50 occupied/i)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(container.textContent).toContain("VIP Seat #7");
    });
    expect(container.textContent).toContain("VIP User");
    expect(container.textContent).not.toMatch(/Founder|Pioneer/i);

    // Simulate another device claiming seat #8 -> returning to window triggers immediate refresh
    currentOccupied = 8;
    fireEvent(window, new Event("focus"));

    await waitFor(() => {
      expect(screen.getByText(/8 \/ 50 occupied/i)).toBeInTheDocument();
    });
  });

  it("never prompts an existing VIP Seat #1 holder to claim again on Pricing or VIP pages", async () => {
    mockAuthState = {
      user: {
        id: "vip-1",
        name: "Wasay",
        email: "ad.wasay.123@gmail.com",
        plan: "Free",
      },
      entitlement: {
        userId: "vip-1",
        isFounder: true,
        isPro: true,
        founderNumber: 1,
        plan: "founder",
        tier: "Founder",
      },
      isPro: true,
      loading: false,
      isAuthenticated: true,
      refreshEntitlement: vi.fn(),
    };

    mockFounderStatsFetch({
      body: { success: true, totalSpots: 50, occupiedSpots: 1, remainingSpots: 49 },
    });

    const { container } = render(
      <FounderProvider>
        <PricingPageView isDark={true} />
        <FoundersPageView isDark={true} />
      </FounderProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/1 \/ 50 occupied/i).length).toBeGreaterThan(0);
    });
    expect(container.textContent).toContain("VIP Seat #1");
    expect(screen.queryByRole("button", { name: /Claim Free VIP Seat/i })).toBeNull();
  });

  it("shows verification state while authLoading is true instead of flashing claim button", async () => {
    mockAuthState = {
      user: null,
      entitlement: null,
      isPro: false,
      loading: true,
      isAuthenticated: false,
      refreshEntitlement: vi.fn(),
    };

    mockFounderStatsFetch({
      body: { success: true, totalSpots: 50, occupiedSpots: 1, remainingSpots: 49 },
    });

    render(
      <FounderProvider>
        <PricingPageView isDark={true} />
      </FounderProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/1 \/ 50 occupied/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Verifying Account Status/i })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Claim Free VIP Seat/i })).toBeNull();
  });
});
