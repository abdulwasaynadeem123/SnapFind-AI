import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SidebarNavigation } from "../src/components/SidebarNavigation";
import { ScreenshotGrid } from "../src/components/ScreenshotGrid";
import { PricingPageView } from "../src/components/PricingPageView";
import { SearchHistoryView } from "../src/components/SearchHistoryView";
import { ScreenshotItem } from "../src/types";

vi.mock("../src/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      name: "Wasay",
      email: "ad.wasay.123@gmail.com",
      plan: "Free",
    },
    isPro: false,
    isAuthenticated: true,
    refreshEntitlement: vi.fn(),
  }),
}));

vi.mock("../src/context/FounderContext", () => ({
  useFounder: () => ({
    claimed: 12,
    totalSpots: 50,
    remaining: 38,
    isLive: true,
    claimFounderSpot: vi.fn(),
    refreshFounderStatus: vi.fn(),
  }),
}));

describe("UI Components Integrity, Navigation, Pagination & Branding", () => {
  it("connects the empty search-history action to the search view", () => {
    const onStartSearch = vi.fn();
    render(
      <SearchHistoryView
        history={[]}
        onExecuteSearch={vi.fn()}
        onClearHistory={vi.fn()}
        onStartSearch={onStartSearch}
        isDark={true}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /start a search/i }));
    expect(onStartSearch).toHaveBeenCalledTimes(1);
  });

  it("renders all 10 required sidebar navigation items and unread notifications badge", () => {
    const setActiveView = vi.fn();
    const { container } = render(
      <SidebarNavigation
        activeView="gallery"
        setActiveView={setActiveView}
        isDark={true}
        indexedCount={18}
        favoriteCount={4}
        trashCount={2}
        unreadNotificationCount={3}
      />
    );

    const expectedLabels = [
      "Home",
      "Search",
      "Gallery",
      "Smart Collections",
      "Favorites",
      "Recently Deleted",
      "Notifications",
      "Account",
      "Pricing",
      "Settings",
    ];
    for (const label of expectedLabels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Supabase|Vercel|Gemini|Paddle/i);
  });

  it("paginates large screenshot galleries cleanly at 12 items per page", () => {
    const items: ScreenshotItem[] = Array.from({ length: 30 }, (_, idx) => ({
      id: `gallery-${idx + 1}`,
      imageUri: "data:image/png;base64,iVBORw0KGgo=",
      createdAt: new Date().toISOString(),
      category: "Other",
      title: `Screenshot Item ${idx + 1}`,
      ocrText: `Body text ${idx + 1}`,
    }));

    const { container } = render(
      <ScreenshotGrid
        screenshots={items}
        searchResults={[]}
        searchQuery=""
        selectedCategory="All"
        setSelectedCategory={vi.fn()}
        isDark={true}
        onSelect={vi.fn()}
        onToggleFavorite={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Page 1 shows 12 items and PaginationControls switches to page 2
    expect(screen.getByText("Screenshot Item 1")).toBeInTheDocument();
    expect(screen.queryByText("Screenshot Item 15")).not.toBeInTheDocument();

    const page2Btn = container.querySelector('button[aria-label="Page 2"]') || screen.getByRole("button", { name: /^2$/ });
    fireEvent.click(page2Btn);
    expect(screen.getByText("Screenshot Item 15")).toBeInTheDocument();
  });

  it("renders PricingPageView with canonical PKR 0 / 249 / 1,999 / 5,999 tiers and zero third-party infra leakage", () => {
    const { container } = render(<PricingPageView isDark={true} />);
    const text = container.textContent || "";

    expect(text).toContain("PKR 249");
    expect(text).toContain("PKR 1,999");
    expect(text).toContain("PKR 5,999");
    expect(text).toContain("250");
    expect(text).not.toMatch(/7,?999/);
    expect(text).not.toMatch(/Supabase|Vercel|Gemini|Paddle|AI Studio/i);
  });
});
