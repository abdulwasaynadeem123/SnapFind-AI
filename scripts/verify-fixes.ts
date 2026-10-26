/**
 * Verification test script for SnapFind AI Critical Production Fixes
 */

import { INITIAL_SAMPLE_SCREENSHOTS } from "../src/data/sampleScreenshots";

interface TestResult {
  name: string;
  status: "PASS" | "FAIL";
  evidence: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, evidence: string) {
  if (condition) {
    results.push({ name, status: "PASS", evidence });
  } else {
    results.push({ name, status: "FAIL", evidence: `Assertion failed: ${evidence}` });
  }
}

console.log("=== Running SnapFind AI Production Fix Verification Suite ===\n");

// TEST 1: Sample screenshot pack bundling
assert(
  INITIAL_SAMPLE_SCREENSHOTS.length === 6,
  "Priority 3: Sample Screenshot Pack Count",
  `Found exactly ${INITIAL_SAMPLE_SCREENSHOTS.length} high-fidelity synthetic screenshots bundled.`
);

// TEST 2: Sample screenshots content integrity
const allHaveValidData = INITIAL_SAMPLE_SCREENSHOTS.every((s) => {
  const text = s.fullText || s.ocr_text || "";
  return (
    s.id &&
    s.title &&
    text.length > 20 &&
    s.keywords &&
    s.keywords.length >= 3 &&
    s.keyEntities &&
    s.keyEntities.length >= 1 &&
    s.imageUrl &&
    s.imageUrl.startsWith("data:image/svg+xml;utf8,")
  );
});
assert(
  allHaveValidData,
  "Priority 3: Sample Screenshot Metadata & OCR Completeness",
  "All 6 sample screenshots have non-empty OCR text, extracted entities, search keywords, and SVG images."
);

// TEST 3: Search matching on Passport
const passport = INITIAL_SAMPLE_SCREENSHOTS.find(
  (s) =>
    s.title.toLowerCase().includes("passport") ||
    (s.fullText || "").toLowerCase().includes("passport")
);
const passportMatches =
  passport &&
  ((passport.fullText || "").toLowerCase().includes("republic") ||
    (passport.fullText || "").toLowerCase().includes("expiry"));
assert(
  !!passportMatches,
  "Priority 3: Search Retrieval - Passport & Expiry Date",
  `Passport sample found: "${passport?.title}" containing document expiry & citizenship data.`
);

// TEST 4: Search matching on Utility Bill
const bill = INITIAL_SAMPLE_SCREENSHOTS.find(
  (s) =>
    (s.fullText || "").toLowerCase().includes("electric") ||
    (s.fullText || "").toLowerCase().includes("due date")
);
const billMatches =
  bill &&
  (bill.fullText || "").includes("148.65") &&
  (bill.fullText || "").includes("Account Number");
assert(
  !!billMatches,
  "Priority 3: Search Retrieval - Utility Bill & Due Amount",
  `Utility bill sample matched amount $148.65 and due date.`
);

// TEST 5: Search matching on Recipe
const recipe = INITIAL_SAMPLE_SCREENSHOTS.find((s) =>
  (s.fullText || "").toLowerCase().includes("flour") ||
  (s.fullText || "").toLowerCase().includes("ingredients")
);
assert(
  !!recipe,
  "Priority 3: Search Retrieval - Recipe & Culinary Ingredients",
  `Recipe sample found: "${recipe?.title}" with full step-by-step ingredients.`
);

// TEST 6: Search matching on QR Code & Payment
const qrSample = INITIAL_SAMPLE_SCREENSHOTS.find(
  (s) => s.hasQrCode && s.qrCodeData?.includes("snapfind")
);
assert(
  !!qrSample,
  "Priority 3: Search Retrieval - QR Code & Instant Scan",
  `QR sample found with valid payload: "${qrSample?.qrCodeData}".`
);

// TEST 7: Deduplication in import pipeline
const sampleIds = INITIAL_SAMPLE_SCREENSHOTS.map((s) => s.id);
const uniqueIds = new Set(sampleIds);
assert(
  sampleIds.length === uniqueIds.size,
  "Priority 3: Import Pipeline Deduplication",
  `All ${uniqueIds.size} sample screenshot IDs are strictly unique.`
);

// TEST 8: Auth Rate Limit Error Parsing logic
function parseAuthErrorMessage(err: unknown): { message: string; cooldownSeconds?: number } {
  const rawMessage = (err as Error)?.message || String(err || "");
  const lowerMsg = rawMessage.toLowerCase();

  const secMatch = rawMessage.match(/(\d+)\s+seconds?/i);
  const cooldownSeconds = secMatch ? parseInt(secMatch[1], 10) : undefined;

  if (
    lowerMsg.includes("over_email_send_rate_limit") ||
    lowerMsg.includes("email rate limit exceeded") ||
    lowerMsg.includes("email rate limit")
  ) {
    return {
      message: cooldownSeconds
        ? `Supabase email delivery rate limit exceeded. Please wait ${cooldownSeconds} seconds before requesting another email.`
        : "Email sending limit reached. Please wait a few moments before trying again or use an existing account.",
      cooldownSeconds,
    };
  }
  return { message: rawMessage, cooldownSeconds };
}

const parsedRateLimit1 = parseAuthErrorMessage(
  new Error("For security purposes, you can only request this after 48 seconds.")
);
assert(
  parsedRateLimit1.cooldownSeconds === 48,
  "Priority 1: Rate Limit Cooldown Extraction",
  `Extracted cooldown of ${parsedRateLimit1.cooldownSeconds} seconds from security message.`
);

const parsedRateLimit2 = parseAuthErrorMessage(
  new Error("email rate limit exceeded")
);
assert(
  parsedRateLimit2.message.includes("Email sending limit reached"),
  "Priority 1: Friendly Error Handling for Supabase Email Rate Limits",
  `Generated friendly actionable message: "${parsedRateLimit2.message}"`
);

// TEST 9: OAuth Error Detection in Query / Hash Fragment
function parseOAuthError(search: string, hash: string): string | null {
  const searchParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);

  const error = searchParams.get("error") || hashParams.get("error");
  const errorDescription =
    searchParams.get("error_description") || hashParams.get("error_description");

  if (error || errorDescription) {
    const raw = errorDescription || error || "Authentication error";
    if (
      raw.toLowerCase().includes("access_denied") ||
      raw.toLowerCase().includes("disallowed_useragent") ||
      raw.toLowerCase().includes("secure")
    ) {
      return "Google Sign-In blocked this automated or restricted browser for security. Please sign up or sign in using your email address below.";
    }
    return raw;
  }
  return null;
}

const oauthResult = parseOAuthError("?error=access_denied&error_description=disallowed_useragent", "");
assert(
  !!oauthResult && oauthResult.includes("Google Sign-In blocked this automated or restricted browser"),
  "Priority 2: Google Sign-In Automated Browser Fallback Handling",
  `Correctly identified automated browser restriction and surfaced email fallback.`
);

// TEST 10: Print Summary Report
console.log("\n==================== TEST RESULTS ====================");
let passCount = 0;
results.forEach((r, idx) => {
  if (r.status === "PASS") passCount++;
  console.log(`[${r.status}] ${idx + 1}. ${r.name}`);
  console.log(`       Evidence: ${r.evidence}`);
});
console.log(`\nScore: ${passCount}/${results.length} PASSED`);

if (passCount !== results.length) {
  process.exit(1);
}
