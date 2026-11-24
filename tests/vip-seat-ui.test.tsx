import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PricingPageView } from "../src/components/PricingPageView";

vi.mock("../src/context/AuthContext", () => ({
  useAuth: () => ({ user: null, isPro: false, isAuthenticated: false, refreshEntitlement: vi.fn() }),
}));

describe("Pricing page — standard plans without legacy VIP seats", () => {
  it("renders standard pricing without the removed VIP seat counter or seat-claim CTA", () => {
    const { container } = render(<PricingPageView isDark={true} />);
    expect(screen.getByText("Pricing")).toBeInTheDocument();
    expect(container.textContent).toMatch(/FREE/i);
    expect(container.textContent).not.toMatch(/VIP Seat|VIP ACCESS|50 Available|occupied/i);
    expect(screen.queryByRole("button", { name: /Claim Free VIP Seat/i })).toBeNull();
  });
  it("does not render a fabricated VIP availability number", () => {
    const { container } = render(<PricingPageView isDark={true} />);
    expect(container.textContent).not.toContain("/ 50 occupied");
  });
});
