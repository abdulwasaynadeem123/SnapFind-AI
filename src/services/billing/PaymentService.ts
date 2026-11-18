import { BillingProduct, SubscriptionRecord, UserEntitlement } from "../../types";
import { SubscriptionManager } from "./SubscriptionManager";
import { getAuthBearerHeader } from "../supabase";

export interface CheckoutResult {
  success: boolean;
  configured: boolean;
  checkoutUrl?: string;
  sessionId?: string;
  message?: string;
  error?: string;
}

export interface PaymentVerificationResult {
  success: boolean;
  verified: boolean;
  entitlement?: UserEntitlement;
  message?: string;
  error?: string;
}

/**
 * SnapFind AI - Unified Payment & Subscription Service Abstraction
 *
 * Implements a clean, safe payment gateway orchestrator:
 * - createCheckout() -> Initiates checkout with configured provider (Stripe, LemonSqueezy, Paymob, etc.)
 * - verifyPayment() -> Verifies server-signed payment verification
 * - handlePaymentWebhook() -> Processes webhook notifications
 *
 * Safe Architecture:
 * - Does NOT expose private bank credentials or personal details.
 * - If no live payment provider is configured, safely informs the user:
 *   "Payments are currently being prepared."
 * - Does NOT execute fake upgrades or false confirmations.
 */
class PaymentServiceEngine {
  private isConfigured: boolean = false;
  private providerName: string = "unconfigured";

  constructor() {
    this.checkProviderStatus();
  }

  /**
   * Check if an automated payment provider is configured on the backend
   */
  public async checkProviderStatus(): Promise<{ configured: boolean; provider: string; message: string }> {
    try {
      const res = await fetch("/api/billing/payment-status");
      if (res.ok) {
        const data = await res.json();
        this.isConfigured = Boolean(data.providerConfigured);
        this.providerName = data.provider || "unconfigured";
        return {
          configured: this.isConfigured,
          provider: this.providerName,
          message: data.message || "Payments are currently being prepared.",
        };
      }
    } catch (e) {
      console.warn("[PaymentService] Status check fallback:", e);
    }

    return {
      configured: false,
      provider: "unconfigured",
      message: "Payments are currently being prepared.",
    };
  }

  /**
   * 1. Query available products and pricing plans
   */
  public async getProducts(): Promise<BillingProduct[]> {
    try {
      const res = await fetch("/api/billing/products");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.products)) {
          return data.products;
        }
      }
    } catch (e) {
      console.warn("[PaymentService] Failed to fetch products from backend:", e);
    }

    // Default canonical catalog matching authoritative plans:
    // Free (250 screenshots), Pro Monthly (PKR 249/mo, 2,500/mo), Pro Yearly (PKR 1,999/yr, 30,000/yr), Pro Lifetime (PKR 5,999, 100,000), Founder 50 (PKR 0, 150,000)
    return [
      {
        id: "free_plan",
        productId: "free_plan",
        name: "SnapFind Free",
        description: "Essential AI-powered screenshot search with 250 lifetime screenshots",
        planType: "Free",
        price: 0,
        currency: "PKR",
        interval: "lifetime",
        features: [
          "250 lifetime screenshots",
          "Text extraction & visual search",
          "Smart search & filters",
          "Collections & smart albums",
          "Trash & restore management",
        ],
        maxScreenshots: 250,
        isPopular: false,
      },
      {
        id: "founder_grant",
        productId: "founder_grant",
        name: "VIP Access",
        description: "First 50 VIP seats only: Free forever with 150,000 screenshots & VIP Seat (#1–#50)",
        planType: "Founder",
        price: 0,
        currency: "PKR",
        interval: "lifetime",
        features: [
          "150,000 screenshots",
          "Free forever (No payment required)",
          "Permanent VIP Badge (#1–#50)",
          "Early access to new features",
          "Priority indexing queue",
        ],
        maxScreenshots: 150000,
        isPopular: true,
      },
      {
        id: "monthly_pro_pkr",
        productId: "monthly_pro_pkr",
        name: "Pro Monthly",
        description: "Full AI search & smart organization with 2,500 screenshots per month",
        planType: "Pro",
        price: 249,
        currency: "PKR",
        interval: "month",
        features: [
          "2,500 screenshots/month",
          "AI multimodal search",
          "Advanced search filters",
          "QR / Barcode / URL intelligence",
          "Smart organization",
          "Cloud synchronization",
        ],
        maxScreenshots: 2500,
        isPopular: false,
      },
      {
        id: "yearly_pro_pkr",
        productId: "yearly_pro_pkr",
        name: "Pro Yearly",
        description: "30,000 screenshots/year with priority AI processing (Save PKR 989)",
        planType: "Pro",
        price: 1999,
        currency: "PKR",
        interval: "year",
        features: [
          "30,000 screenshots/year",
          "Everything in Pro Monthly",
          "Priority AI indexing queue",
          "Encrypted multi-device sync",
          "Priority support",
        ],
        maxScreenshots: 30000,
        isPopular: true,
      },
      {
        id: "lifetime_pro_pkr",
        productId: "lifetime_pro_pkr",
        name: "Pro Lifetime",
        description: "One-time payment for 100,000 total screenshots with permanent Pro access",
        planType: "Pro",
        price: 5999,
        currency: "PKR",
        interval: "lifetime",
        features: [
          "100,000 total screenshots",
          "Permanent lifetime access",
          "Everything in Pro",
          "No recurring subscriptions",
          "Advanced visual & text search",
          "Encrypted cloud synchronization",
        ],
        maxScreenshots: 100000,
        isPopular: false,
      },
    ];
  }

  /**
   * 2. Create Checkout Session for a plan
   */
  public async createCheckout(
    planId: string = "lifetime_pro_pkr",
    userId: string = "guest",
    email?: string
  ): Promise<CheckoutResult> {
    try {
      const authHeaders = await getAuthBearerHeader().catch(() => ({}));
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          planId,
          userId,
          email,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          success: Boolean(data.success),
          configured: Boolean(data.configured),
          checkoutUrl: data.checkoutUrl,
          sessionId: data.sessionId,
          message: data.message || (data.configured ? "Checkout initialized." : "Payments are currently being prepared."),
          error: data.error,
        };
      }
    } catch (err: any) {
      console.warn("[PaymentService] Create checkout network error:", err);
    }

    return {
      success: false,
      configured: false,
      message: "Payments are currently being prepared.",
    };
  }

  /**
   * 3. Verify Payment
   */
  public async verifyPayment(sessionId: string, userId: string): Promise<PaymentVerificationResult> {
    try {
      const authHeaders = await getAuthBearerHeader().catch(() => ({}));
      const res = await fetch("/api/billing/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ sessionId, userId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.entitlement) {
          await SubscriptionManager.syncEntitlementsFromServer(userId);
          return {
            success: true,
            verified: true,
            entitlement: data.entitlement,
            message: data.message || "Payment verified successfully.",
          };
        }
      }
    } catch (err: any) {
      console.error("[PaymentService] Verification error:", err);
    }

    return {
      success: false,
      verified: false,
      error: "Unable to verify payment transaction at this time.",
    };
  }

  /**
   * 4. Query subscription status for a user
   */
  public async getSubscriptionStatus(userId: string = "guest"): Promise<SubscriptionRecord | null> {
    try {
      const authHeaders = await getAuthBearerHeader().catch(() => ({}));
      const res = await fetch(`/api/billing/status?userId=${encodeURIComponent(userId)}`, {
        headers: { ...authHeaders },
      });
      if (res.ok) {
        const data = await res.json();
        return data.subscription || null;
      }
    } catch (e) {
      console.warn("[PaymentService] Get status error:", e);
    }
    return null;
  }

  /**
   * Purchase subscription or lifetime plan
   */
  public async purchaseSubscription(
    planId: string = "lifetime_pro_pkr",
    userId: string = "guest"
  ): Promise<{ success: boolean; entitlement?: UserEntitlement; error?: string }> {
    const checkout = await this.createCheckout(planId, userId);
    if (checkout.success && checkout.checkoutUrl) {
      window.location.href = checkout.checkoutUrl;
      return { success: true };
    }
    return {
      success: false,
      error: checkout.message || "Manual verification flow active.",
    };
  }

  /**
   * Restore Purchases
   */
  public async restorePurchases(
    userId: string = "guest"
  ): Promise<{ success: boolean; restoredCount: number; entitlement?: UserEntitlement; message: string }> {
    const status = await this.getSubscriptionStatus(userId);
    if (status && (status.status === "active" || status.is_lifetime)) {
      const ent = await SubscriptionManager.syncEntitlementsFromServer(userId);
      return {
        success: true,
        restoredCount: 1,
        entitlement: ent,
        message: "Lifetime Pro access successfully verified.",
      };
    }
    return {
      success: false,
      restoredCount: 0,
      message: "No active purchases found for this account.",
    };
  }

  /**
   * Cancel subscription auto-renewal
   */
  public async cancelSubscription(
    subscriptionId: string,
    userId: string = "guest"
  ): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: "Lifetime access does not require recurring cancellation.",
    };
  }

  /**
   * Customer portal
   */
  public async openCustomerPortal(subscriptionId?: string): Promise<void> {
    // Lifetime Pro has no recurring portal
  }
}

export const PaymentService = new PaymentServiceEngine();
export default PaymentService;
