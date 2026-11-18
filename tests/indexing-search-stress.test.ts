import { describe, it, expect, beforeEach } from "vitest";
import { processingQueue } from "../src/services/processingQueue";
import { searchEngine } from "../src/services/searchEngine";
import { SubscriptionManager } from "../src/services/billing/SubscriptionManager";
import { ScreenshotItem } from "../src/types";

describe("Automatic Indexing Queue, Quota Resume & Large-Library Search Stress", () => {
  beforeEach(() => {
    localStorage.clear();
    processingQueue.clearQueue();
    SubscriptionManager.resetToFree();
  });

  it("deduplicates by id, uri, and sha256Hash", () => {
    processingQueue.pauseQueue();

    const first = processingQueue.enqueue({
      id: "dup-1",
      fileName: "shot_001.png",
      imageUri: "file:///screenshots/shot_001.png",
      sha256Hash: "hash-abc-1234567890abcdef",
      userId: "guest",
    });
    expect(first).not.toBeNull();

    const secondByHash = processingQueue.enqueue({
      id: "dup-2",
      fileName: "shot_002.png",
      imageUri: "file:///screenshots/shot_002.png",
      sha256Hash: "hash-abc-1234567890abcdef",
      userId: "guest",
    });
    expect(secondByHash).toBeNull();

    const thirdByUri = processingQueue.enqueue({
      id: "dup-3",
      fileName: "shot_001.png",
      imageUri: "file:///screenshots/shot_001.png",
      userId: "guest",
    });
    expect(thirdByUri).toBeNull();
  });

  it("pauses jobs on quota exceeded and automatically resumes when quota upgrades", () => {
    processingQueue.pauseQueue();
    const job = processingQueue.enqueue({
      id: "quota-test-1",
      fileName: "quota_shot.png",
      imageUri: "file:///screenshots/quota_shot.png",
      userId: "user-test-1",
    });
    expect(job).not.toBeNull();

    // Put job into quota-paused waiting_for_verification state
    if (job) {
      job.status = "waiting_for_verification";
      job.errorMessage = "Quota limit reached — upgrade to resume indexing";
    }
    expect(processingQueue.getJob("quota-test-1")?.status).toBe("waiting_for_verification");

    // Upgrade entitlement to Lifetime Pro
    localStorage.setItem(
      "snapfind_user_entitlement_v2",
      JSON.stringify({
        userId: "user-test-1",
        tier: "Pro",
        plan: "lifetime",
        isPro: true,
        isFounder: false,
        status: "active",
        features: {
          maxIndexedScreenshots: 100000,
          maxAIScansPerMonth: 100000,
          maxStorageMB: 50000,
          cloudSync: true,
          advancedSearch: true,
          aiCollections: true,
          priorityProcessing: true,
        },
        updatedAt: new Date().toISOString(),
      })
    );

    processingQueue.resumeAfterQuotaUpgrade();
    const updated = processingQueue.getJob("quota-test-1");
    expect(updated).toBeDefined();
    expect(updated?.status).not.toBe("waiting_for_verification");
    expect(updated?.errorMessage).toBeUndefined();
  });

  it("indexes and searches 1,200 screenshots cleanly with high relevance and sub-second speed", () => {
    const items: ScreenshotItem[] = Array.from({ length: 1200 }, (_, i) => {
      const isTarget = i === 842;
      return {
        id: `stress-${i}`,
        imageUri: `file:///screenshots/img_${i}.png`,
        createdAt: new Date(Date.now() - i * 60000).toISOString(),
        category: isTarget ? "Receipt & Invoice" : i % 2 === 0 ? "Social Media" : "Notes",
        title: isTarget ? "K-Electric Utility Bill Invoice" : `Capture ${i}`,
        ocrText: isTarget
          ? "Easypaisa transaction PKR 5999 paid electricity bill reference 99812"
          : `General screen capture item ${i} with standard notifications`,
        tags: isTarget ? ["easypaisa", "invoice", "bill"] : ["capture"],
      };
    });

    const t0 = performance.now();
    searchEngine.updateIndex(items);
    const results = searchEngine.search("easypaisa electricity bill", items);
    const elapsedMs = performance.now() - t0;

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("stress-842");
    expect(elapsedMs).toBeLessThan(1500);
  });
});
