import { describe, it, expect, beforeEach } from "vitest";
import {
  SubscriptionManager,
  PLAN_CONFIG,
  PLAN_LIMITS,
  FOUNDER_BENEFIT_CONFIG,
} from "../src/services/billing/SubscriptionManager";
import { UsageService } from "../src/services/billing/UsageService";
import { ScreenshotItem } from "../src/types";

describe("Canonical Pricing, Limits & Founder 50 Program", () => {
  beforeEach(() => {
    localStorage.clear();
    SubscriptionManager.resetToFree();
  });

  it("enforces exact canonical pricing and limits across all 5 plans", () => {
    expect(PLAN_CONFIG.free.monthlyPrice).toBe(0);
    expect(PLAN_CONFIG.free.features.maxIndexedScreenshots).toBe(250);
    expect(PLAN_CONFIG.free.features.maxAIScansPerMonth).toBe(250);
    expect(PLAN_CONFIG.free.features.maxStorageMB).toBe(1000);

    expect(PLAN_CONFIG.monthly.monthlyPrice).toBe(249);
    expect(PLAN_CONFIG.monthly.features.maxIndexedScreenshots).toBe(2500);
    expect(PLAN_CONFIG.monthly.features.maxStorageMB).toBe(5000);

    expect(PLAN_CONFIG.yearly.yearlyPrice).toBe(1999);
    expect(PLAN_CONFIG.yearly.features.maxIndexedScreenshots).toBe(30000);
    expect(PLAN_CONFIG.yearly.features.maxStorageMB).toBe(15000);

    expect(PLAN_CONFIG.lifetime.lifetimePrice).toBe(5999);
    expect(PLAN_CONFIG.lifetime.features.maxIndexedScreenshots).toBe(100000);
    expect(PLAN_CONFIG.lifetime.features.maxStorageMB).toBe(50000);

    expect(PLAN_CONFIG.founder.monthlyPrice).toBe(0);
    expect(PLAN_CONFIG.founder.lifetimePrice).toBe(0);
    expect(PLAN_CONFIG.founder.features.maxIndexedScreenshots).toBe(150000);
    expect(PLAN_CONFIG.founder.features.maxStorageMB).toBe(100000);

    expect(FOUNDER_BENEFIT_CONFIG.MAX_FOUNDER_USERS).toBe(50);
    expect(FOUNDER_BENEFIT_CONFIG.PRICE_PKR).toBe(0);
    expect(PLAN_LIMITS.FREE_MAX_SCREENSHOTS).toBe(250);
    expect(PLAN_LIMITS.PRO_LIFETIME_MAX_SCREENSHOTS).toBe(100000);
    expect(PLAN_LIMITS.FOUNDER_MAX_SCREENSHOTS).toBe(150000);
  });

  it("allows indexing up to 249 screenshots on Free tier and blocks at 250", () => {
    const allowedCheck = SubscriptionManager.canIndexScreenshot(249);
    expect(allowedCheck.allowed).toBe(true);
    expect(allowedCheck.limit).toBe(250);
    expect(allowedCheck.remaining).toBe(1);

    const blockedCheck = SubscriptionManager.canIndexScreenshot(250);
    expect(blockedCheck.allowed).toBe(false);
    expect(blockedCheck.limit).toBe(250);
    expect(blockedCheck.remaining).toBe(0);
  });

  it("computes Free tier usage metrics with 250 limit and 1,000 MB storage cap", () => {
    const sampleScreenshots: ScreenshotItem[] = Array.from({ length: 12 }, (_, idx) => ({
      id: `shot-${idx}`,
      imageUri: "data:image/png;base64,iVBORw0KGgo=",
      createdAt: new Date().toISOString(),
      category: "Other",
      ocrText: `Sample receipt ${idx}`,
      fileSizeBytes: 512 * 1024,
    }));

    const metrics = UsageService.computeMetrics(sampleScreenshots);
    expect(metrics.plan).toBe("free");
    expect(metrics.screenshotsLimit).toBe(250);
    expect(metrics.aiAnalysesLimit).toBe(250);
    expect(metrics.storageLimitBytes).toBe(1000 * 1024 * 1024);
    expect(metrics.screenshotsIndexed).toBe(12);
    expect(metrics.screenshotsRemaining).toBe(238);
  });
});
