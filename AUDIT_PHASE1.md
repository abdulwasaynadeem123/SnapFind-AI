# SnapFind AI — Phase 1 Audit Report

**Audit branch:** `audit/phase1-hardening-2026-11-24`  
**Baseline:** `main` at `53bd86609959ec41c16076789b74afd94c279aba`  
**Scope completed:** repository structure, Express request handling, OCR upload validation, selected auth/account routes, selected Supabase migrations, indexing/search implementation, existing tests, and GitHub Actions workflows.

## Executive summary

Phase 1 found and addressed two concrete API hardening issues, added regression tests, removed committed Gradle cache files, and removed an unsafe automatic dependency-workflow push to `main`.

This is **not** a claim that the entire application is secure or fully audited. No production endpoint, live Supabase project, production database, or production load test was accessed. Automated verification is delegated to the new branch CI workflow; its result must be checked before merge.

## Changes made on this branch

| Area | Change | Evidence / status |
|---|---|---|
| OCR upload validation | Validate decoded bytes against PNG, JPEG, WebP, GIF, or PDF signatures; do not trust multipart `mimetype` or a declared base64 MIME type. | Implemented in `server.ts`. |
| OCR filename handling | Normalize client-provided filenames to a bounded safe character set. | Implemented in `server.ts`. |
| API request parsing | Move the general API rate-limit middleware before JSON parsing; reduce JSON body limit from 50 MiB to 38 MiB and URL-encoded body limit from 50 MiB to 1 MiB. | Implemented in `server.ts`. |
| Regression tests | Add tests for invalid multipart bytes and base64 that only claims to be an image. | Added to `tests/security-api.test.ts`; CI execution pending. |
| Dependency audit workflow | Remove write permission, `npm audit fix`, and the automatic commit/push to `main`. Generate a report and fail on high/critical findings instead. | Updated `.github/workflows/dependency-security-audit.yml`. |
| Repository hygiene | Ignore Gradle/IDE output and remove 21 tracked `android/.gradle` cache files (about 2.99 MB). | Implemented on this branch. |
| Verification | Add a branch-scoped workflow for type-check, tests, production build, and high-severity dependency audit. | Added `.github/workflows/audit-ci.yml`; run status must be checked. |

## Findings still requiring remediation or verification

### F-01 — Rate limits are process-local
The Express limiter uses an in-memory `Map`. Its counters reset on process restart and are not shared between serverless instances. The pre-parser ordering change reduces waste within one instance, but it does **not** create a global limit.

**Next step:** enforce a shared limit at the hosting edge or through a shared atomic store. Verify the actual deployment topology before choosing the implementation.

### F-02 — Public AI endpoints can consume paid API quota
The OCR, screenshot analysis, semantic search, and Ask-AI endpoints do not all require a verified account. This may be intentional for guest mode, but IP-based process-local limits alone are not strong abuse protection.

**Next step:** decide which features must remain available to guests, then enforce server-side guest budgets, authenticated-user budgets, and shared per-IP limits. Do not rely on client-supplied device IDs as identity.

### F-03 — CSP policies are inconsistent and allow inline scripts
The Express CSP and Vercel CSP differ. The Vercel policy includes broad `connect-src https: wss:`, while both policies permit inline scripts. A nonce/hash migration needs a full inventory of OAuth, Tesseract workers, scripts, fonts, and external requests.

**Next step:** consolidate the policies, test in report-only mode, then remove broad sources and inline script allowances where compatible. Not changed blindly in Phase 1 to avoid breaking authentication or OCR workers.

### F-04 — Live account deletion cannot be verified from repository access
The frontend correctly requires an HTTP-success response **and** `payload.success === true`. The server route requires a server-side Supabase admin key and the `list_user_storage_objects` RPC migration. The explicit Vercel function file exists.

**Next step:** verify Vercel environment variables, deployed migration/RPC, Storage ownership behavior, and the live function response in a controlled test account. No live deletion was attempted.

### F-05 — Supabase RLS review is incomplete
Selected migrations show ownership policies for `public.screenshots` and service-role-only execution for the Storage lookup RPC. This does not establish that every exposed table, view, RPC, and Storage bucket is correctly protected.

**Next step:** inventory all public tables, views, functions, grants, and bucket policies; test cross-user read/write denial using two disposable accounts.

### F-06 — Performance and load claims remain unverified
The existing stress test constructs 1,200 synthetic records and asserts a broad 1.5-second ceiling. That is useful as a regression test, not evidence of production throughput, p95/p99 latency, memory ceilings, or concurrent-user capacity.

**Next step:** run repeatable isolated benchmarks at increasing library sizes and controlled concurrency. Do not send uncontrolled load to production or use real user screenshots.

### F-07 — Dependency audit results need CI evidence
The old dependency workflow could modify and push the lockfile directly to `main` without application tests. That behavior is removed on this branch. The new audit CI should provide the actual current dependency findings.

## Verification status

- Source changes committed to the isolated audit branch.
- Regression tests added, **not yet executed in this environment**.
- Type-check, full test suite, production build, and `npm audit`: pending GitHub Actions result.
- No production stress test, penetration test against a live service, database mutation, account deletion, or live RLS test was performed.

## Merge gate

Do not merge until the audit CI is green and the remaining deployment-specific checks are completed. Review the diff and CI run first; this branch does not modify `main` or deploy to production.


## Additional findings and fixes

### F-08 — First-50 offer RPC name mismatch (fixed on branch)
The frontend called `get_founder_promo_status` and `dismiss_founder_promo`, but the checked-in migrations define `get_my_vip_eligibility` and `defer_vip_offer_for_user`. Updated the frontend to call the migration-backed RPCs and map their actual result columns. Added regression tests for both calls.

### F-09 — `user_usage` lacked owner-scoped RLS (migration added)
The older security migration grants authenticated users table DML broadly. The checked-in migrations did not enable RLS or define an owner policy for `public.user_usage`. Added a migration that enables RLS, permits authenticated users to select only their own row, and revokes direct insert/update/delete privileges. Server-side quota writes continue through the security-definer usage RPC.

### F-10 — Client-controlled quota decrement (fixed on branch)
The public usage-recording route and database RPC accepted `delete_screenshot`, allowing a caller to decrement their recorded quota without a verified deletion. Removed that action from the API allowlist and usage RPC, with a regression test.

### F-11 — SECURITY DEFINER search paths (migration added)
Several First-50 functions used `search_path = public, auth`. Added a migration to set empty search paths on the relevant trigger/RPC functions and revoke direct execution of the trigger-only signup function. Also hardened the usage-recording RPC search path.

### F-12 — Search/indexing hot paths (optimized on branch)
- FlexSearch was queried inside the per-screenshot scoring function, repeating the same query for each candidate. The search result IDs are now computed once per user query.
- Modified candidates were identified with repeated array scans. Replaced this with a `Set` lookup.
- Added a regression assertion that FlexSearch runs once per query.

### F-13 — Profile update overwrote usernames (fixed on branch)
Profile sync and avatar updates included a derived username in profile upserts. Removed those username writes so ordinary profile changes do not overwrite a manually selected unique username.

### F-14 — Duplicate password validation message (fixed on branch)
Signup confirmation errors were shown in both the general error banner and inline field message. Updated field-level error routing so the same validation message is shown once.

## Latest CI evidence (run 13)

Run: https://github.com/abdulwasaynadeem123/SnapFind-AI/actions/runs/45405483094

- TypeScript check: passed.
- Targeted security + indexing regression tests: passed.
- Production build: passed.
- npm audit: passed; reported **0 vulnerabilities**.
- Full test suite: failed, with 6 of 12 test files failing. Most remaining failures are legacy VIP tests calling removed `/api/vip/*` endpoints and expecting the former VIP-seat API/UI behavior. The current implementation uses the migration-backed Supabase RPC flow. One AuthModal assertion also needs rechecking after the latest validation-message fix.

The full suite remains a merge blocker until the legacy tests are updated to verify the current implementation rather than the removed endpoints. The report does not mark the overall test suite green.
