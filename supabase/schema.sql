-- ==============================================================================
-- SnapFind AI — Supabase / PostgreSQL Database Architecture & Schema definition
-- ==============================================================================

-- 1. PROFILES TABLE
-- Extends auth.users with application specific metadata, avatars, and storage quotas.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    storage_limit_mb INTEGER NOT NULL DEFAULT 5000,
    is_pro BOOLEAN NOT NULL DEFAULT TRUE
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id OR (auth.jwt() ->> 'email') = 'ash.mary.2006@gmail.com');

CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- Prevent unauthorized client-side tampering of is_pro or storage limits in profiles table
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER AS $$
BEGIN
    -- If called by standard user (non-admin and non-service-role), prevent modification of is_pro & storage_limit_mb
    IF (auth.jwt() ->> 'email') IS DISTINCT FROM 'ash.mary.2006@gmail.com' 
       AND (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'service_role' 
       AND (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin' THEN
        NEW.is_pro := OLD.is_pro;
        NEW.storage_limit_mb := OLD.storage_limit_mb;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

-- 2. SCREENSHOTS TABLE
-- Stores OCR indexed screenshots, extracted entity metadata, tags, and category labels.
CREATE TABLE IF NOT EXISTS public.screenshots (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT NOT NULL,
    ocr_snippet TEXT,
    full_ocr_text TEXT,
    key_entities JSONB NOT NULL DEFAULT '[]'::jsonb,
    tags TEXT[] NOT NULL DEFAULT '{}'::text[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    file_size_mb NUMERIC(5,2) NOT NULL DEFAULT 0.50
);

-- Indexes for lightning-fast search performance
CREATE INDEX IF NOT EXISTS idx_screenshots_user_id ON public.screenshots(user_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_category ON public.screenshots(category);
CREATE INDEX IF NOT EXISTS idx_screenshots_created_at ON public.screenshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_screenshots_user_created ON public.screenshots(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_screenshots_user_category_created ON public.screenshots(user_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_screenshots_user_favorites ON public.screenshots(user_id, created_at DESC) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_screenshots_full_ocr_fts ON public.screenshots USING gin (to_tsvector('english', COALESCE(full_ocr_text, '')));

-- Enable RLS on screenshots
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own screenshots" 
    ON public.screenshots FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own screenshots" 
    ON public.screenshots FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own screenshots" 
    ON public.screenshots FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own screenshots" 
    ON public.screenshots FOR DELETE 
    USING (auth.uid() = user_id);

-- 3. SEARCH_HISTORY TABLE
-- Logs past natural language search queries for rapid re-execution.
CREATE TABLE IF NOT EXISTS public.search_history (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    result_count INTEGER NOT NULL DEFAULT 0,
    category_filter TEXT NOT NULL DEFAULT 'All',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on search history user_id and timestamp
CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON public.search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON public.search_history(created_at DESC);

-- Enable RLS on search history
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own search history" 
    ON public.search_history FOR SELECT 
    USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own search history" 
    ON public.search_history FOR INSERT 
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete own search history" 
    ON public.search_history FOR DELETE 
    USING (auth.uid() = user_id OR user_id IS NULL);

-- 4. SETTINGS TABLE
-- User preference settings, theme modes, and OCR vision model configurations.
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT NOT NULL DEFAULT 'dark',
    ocr_accuracy TEXT NOT NULL DEFAULT 'accurate',
    auto_tagging BOOLEAN NOT NULL DEFAULT TRUE,
    cloud_sync BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own settings" 
    ON public.settings FOR SELECT 
    USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own settings" 
    ON public.settings FOR UPDATE 
    USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own settings" 
    ON public.settings FOR INSERT 
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 5. SYSTEM CONFIGURATIONS TABLE
-- Central configuration for dynamic quotas, plan limits, and configurable Founder 100 benefits.
CREATE TABLE IF NOT EXISTS public.system_configs (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-only access to system_configs"
    ON public.system_configs FOR SELECT
    USING (true);

-- Seed default configurable parameters
INSERT INTO public.system_configs (key, value, description)
VALUES 
(
    'founder_benefit_config',
    '{"max_founder_users": 50, "benefit_duration_days": null, "enabled": true}'::jsonb,
    'Configures maximum number of early users to receive automatic Founder status (strictly first 50 users only, #1 to #50), duration (null = lifetime), and feature activation.'
),
(
    'plan_limits_config',
    '{
        "free": {
            "maxIndexedScreenshots": 100,
            "maxAIScansPerMonth": 20,
            "maxStorageMB": 500,
            "cloudSync": false,
            "advancedSearch": false,
            "aiCollections": true,
            "priorityProcessing": false
        },
        "lifetime": {
            "maxIndexedScreenshots": 999999,
            "maxAIScansPerMonth": 999999,
            "maxStorageMB": 25000,
            "cloudSync": true,
            "advancedSearch": true,
            "aiCollections": true,
            "priorityProcessing": true
        },
        "founder": {
            "maxIndexedScreenshots": 999999,
            "maxAIScansPerMonth": 999999,
            "maxStorageMB": 25000,
            "cloudSync": true,
            "advancedSearch": true,
            "aiCollections": true,
            "priorityProcessing": true
        }
    }'::jsonb,
    'Authoritative plan limits for Free (100 screenshots, PKR 0), Lifetime Pro (PKR 7,999 one-time), and Founder 50 (First 50 users, rank #1 to #50).'
)
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description;

-- 6. SUBSCRIPTIONS TABLE
-- Stores Google Play / Stripe / System purchase records, tokens, order IDs, and period renewals.
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'pro', -- 'pro', 'founder', 'enterprise'
    status TEXT NOT NULL DEFAULT 'active', -- active, grace_period, on_hold, paused, canceled, expired
    provider TEXT NOT NULL DEFAULT 'google_play', -- google_play, stripe, founder_grant, system
    provider_customer_id TEXT,
    provider_subscription_id TEXT,
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    product_id TEXT,
    purchase_token TEXT,
    order_id TEXT,
    platform TEXT NOT NULL DEFAULT 'android_google_play',
    auto_renewing BOOLEAN NOT NULL DEFAULT TRUE,
    price_currency_code TEXT DEFAULT 'USD',
    price_amount_micros BIGINT,
    raw_play_response JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_order_id ON public.subscriptions(order_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own subscriptions"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- 7. USER_ENTITLEMENTS TABLE
-- Authoritative server-calculated entitlement state for feature gating, quotas, & Founder status.
CREATE TABLE IF NOT EXISTS public.user_entitlements (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'free', -- 'free', 'pro', 'founder'
    is_founder BOOLEAN NOT NULL DEFAULT FALSE,
    founder_number INTEGER,
    founder_granted_at TIMESTAMPTZ,
    founder_expires_at TIMESTAMPTZ, -- NULL for lifetime, or timestamp for limited duration
    tier TEXT NOT NULL DEFAULT 'Free', -- 'Free', 'Pro', 'Founder'
    is_pro BOOLEAN NOT NULL DEFAULT FALSE,
    features JSONB NOT NULL DEFAULT '{
        "maxIndexedScreenshots": 500,
        "maxAIScansPerMonth": 20,
        "maxStorageMB": 500,
        "cloudSync": false,
        "advancedSearch": false,
        "aiCollections": false,
        "priorityProcessing": false
    }'::jsonb,
    max_screenshots INTEGER NOT NULL DEFAULT 500,
    can_cloud_sync BOOLEAN NOT NULL DEFAULT FALSE,
    can_ai_multimodal_search BOOLEAN NOT NULL DEFAULT FALSE,
    priority_processing BOOLEAN NOT NULL DEFAULT FALSE,
    active_subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_entitlements_plan ON public.user_entitlements(plan);
CREATE INDEX IF NOT EXISTS idx_user_entitlements_is_founder ON public.user_entitlements(is_founder);

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own entitlements"
    ON public.user_entitlements FOR SELECT
    USING (auth.uid() = user_id);

-- 8. SUBSCRIPTION_EVENTS TABLE
-- Audit log of billing lifecycle events (purchase, renewal, cancellation, founder grant, expiry).
CREATE TABLE IF NOT EXISTS public.subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'founder_granted', 'subscription_created', 'subscription_renewed', 'subscription_canceled', 'quota_warning'
    provider_event_id TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id ON public.subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_event_type ON public.subscription_events(event_type);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own subscription events"
    ON public.subscription_events FOR SELECT
    USING (auth.uid() = user_id);

-- 9. USER REGISTRATION TRIGGER (FREE TIER DEFAULT — NEVER AUTO-GRANTS VIP)
-- Ordinary new signups always receive the canonical Free tier (250 screenshots / 1,000 MB).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_plan TEXT := 'free';
    v_tier TEXT := 'Free';
    v_is_pro BOOLEAN := FALSE;
    v_max_screenshots INTEGER := 250;
    v_storage_limit INTEGER := 1000;
    v_features JSONB := '{
        "maxIndexedScreenshots": 250,
        "maxAIScansPerMonth": 250,
        "maxStorageMB": 1000,
        "cloudSync": false,
        "advancedSearch": true,
        "aiCollections": true,
        "priorityProcessing": false
    }'::jsonb;
BEGIN
    INSERT INTO public.profiles (id, name, email, avatar_url, is_pro, storage_limit_mb)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
        v_is_pro,
        v_storage_limit
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.user_entitlements (
        user_id,
        plan,
        is_founder,
        founder_number,
        founder_granted_at,
        founder_expires_at,
        tier,
        is_pro,
        features,
        max_screenshots,
        can_cloud_sync,
        can_ai_multimodal_search,
        priority_processing,
        expires_at
    )
    VALUES (
        NEW.id,
        v_plan,
        FALSE,
        NULL,
        NULL,
        NULL,
        v_tier,
        FALSE,
        v_features,
        v_max_screenshots,
        FALSE,
        TRUE,
        FALSE,
        NULL
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 9. PAYMENT_REQUESTS TABLE (Manual Payments: Easypaisa & Bank Transfer)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,
    user_name TEXT,
    plan TEXT NOT NULL DEFAULT 'lifetime', -- 'lifetime'
    amount NUMERIC NOT NULL DEFAULT 7999,
    currency TEXT NOT NULL DEFAULT 'PKR',
    payment_method TEXT NOT NULL CHECK (payment_method IN ('easypaisa', 'bank_transfer')),
    transaction_id TEXT NOT NULL,
    receipt_url TEXT,
    sender_account TEXT,
    sender_name TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    verified_by TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_payment_requests_user_id ON public.payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON public.payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_transaction_id ON public.payment_requests(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_submitted_at ON public.payment_requests(submitted_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- 1. Users can view their own payment requests
CREATE POLICY "Users can select own payment requests"
    ON public.payment_requests FOR SELECT
    USING (auth.uid() = user_id);

-- 2. Users can insert their own payment requests with 'pending' status only
CREATE POLICY "Users can insert own payment requests"
    ON public.payment_requests FOR INSERT
    WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- 3. Prevent users from updating payment requests directly (only service role or admin function can verify)
-- (No public UPDATE policy is granted to standard users; only Service Role or Admin RPC can update status, verified_at, verified_by, rejection_reason)

-- Helper RPC for approving manual payment request (Security Definer)
CREATE OR REPLACE FUNCTION public.approve_payment_request(
    p_request_id UUID,
    p_admin_identifier TEXT DEFAULT 'Admin'
)
RETURNS JSONB AS $$
DECLARE
    v_req RECORD;
BEGIN
    -- This SECURITY DEFINER function must never be callable by ordinary users.
    -- Only the trusted service role or an explicitly server-issued admin claim may execute it.
    IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
       AND COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
        RAISE EXCEPTION 'Administrator authorization required.'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_req
    FROM public.payment_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment request not found.');
    END IF;

    IF v_req.status = 'approved' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Payment already approved.');
    END IF;

    -- Update payment request
    UPDATE public.payment_requests
    SET status = 'approved',
        verified_at = NOW(),
        verified_by = p_admin_identifier,
        updated_at = NOW()
    WHERE id = p_request_id;

    -- Upgrade user entitlement to Lifetime Pro (Unlimited screenshots, no expiry)
    UPDATE public.user_entitlements
    SET plan = 'lifetime',
        tier = 'Pro',
        is_pro = TRUE,
        max_screenshots = 999999,
        can_cloud_sync = TRUE,
        can_ai_multimodal_search = TRUE,
        priority_processing = TRUE,
        expires_at = NULL,
        features = '{
            "maxIndexedScreenshots": 999999,
            "maxAIScansPerMonth": 999999,
            "maxStorageMB": 25000,
            "cloudSync": true,
            "advancedSearch": true,
            "aiCollections": true,
            "priorityProcessing": true
        }'::jsonb,
        updated_at = NOW()
    WHERE user_id = v_req.user_id;

    -- Update public.profiles plan
    UPDATE public.profiles
    SET plan = 'Pro',
        is_pro = TRUE,
        storage_limit_mb = 25000,
        updated_at = NOW()
    WHERE id = v_req.user_id;

    -- Log subscription event
    INSERT INTO public.subscription_events (
        user_id,
        provider,
        event_type,
        payload
    )
    VALUES (
        v_req.user_id,
        v_req.payment_method,
        'manual_payment_approved',
        jsonb_build_object(
            'payment_request_id', v_req.id,
            'amount', v_req.amount,
            'currency', v_req.currency,
            'transaction_id', v_req.transaction_id,
            'verified_by', p_admin_identifier,
            'plan', 'lifetime'
        )
    );

    RETURN jsonb_build_object('success', true, 'message', 'Payment approved and Lifetime Pro activated.');
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- SECURITY DEFINER is not sufficient by itself: explicitly deny client execution.
REVOKE ALL ON FUNCTION public.approve_payment_request(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_payment_request(UUID, TEXT) TO service_role;

-- ==============================================================================
-- 10. FEEDBACK TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_email TEXT,
    type TEXT NOT NULL,
    title TEXT,
    description TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    nps_score INTEGER CHECK (nps_score >= 0 AND nps_score <= 10),
    page TEXT,
    screenshot_url TEXT,
    app_version TEXT DEFAULT 'v2.4.0',
    platform TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_page ON public.feedback(page);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to read own feedback"
    ON public.feedback FOR SELECT
    USING (auth.uid()::text = user_id OR user_id IS NULL OR user_id = 'guest' OR (auth.jwt() ->> 'email') = 'ash.mary.2006@gmail.com');

CREATE POLICY "Allow anyone to insert feedback"
    ON public.feedback FOR INSERT
    WITH CHECK (true);

-- ==============================================================================
-- 11. GAME_PROFILES TABLE (SnapDash Separate Game Identity)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.game_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    game_username TEXT UNIQUE NOT NULL,
    high_score INTEGER NOT NULL DEFAULT 0,
    total_games_played INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_game_username_length CHECK (char_length(game_username) >= 3 AND char_length(game_username) <= 20)
);

CREATE INDEX IF NOT EXISTS idx_game_profiles_user_id ON public.game_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_game_profiles_username ON public.game_profiles(game_username);
CREATE INDEX IF NOT EXISTS idx_game_profiles_high_score ON public.game_profiles(high_score DESC);

ALTER TABLE public.game_profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can view game profiles for leaderboard usernames
CREATE POLICY "Allow public select on game_profiles"
    ON public.game_profiles FOR SELECT
    USING (true);

-- Users can insert only their own game profile
CREATE POLICY "Users can insert own game_profile"
    ON public.game_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update only their own game profile (username)
CREATE POLICY "Users can update own game_profile"
    ON public.game_profiles FOR UPDATE
    USING (auth.uid() = user_id);

-- ==============================================================================
-- 12. GAME_SCORES TABLE (SnapDash Anti-Cheat Recorded Score Ledger)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.game_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    game_username TEXT NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0),
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast deterministic leaderboard ranking (highest score first, earlier timestamp as tie-breaker)
CREATE INDEX IF NOT EXISTS idx_game_scores_leaderboard ON public.game_scores(score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_game_scores_user_id ON public.game_scores(user_id);

ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

-- Allow public read for leaderboard
CREATE POLICY "Allow public select on game_scores"
    ON public.game_scores FOR SELECT
    USING (true);

-- Allow authenticated users to insert their own scores
CREATE POLICY "Users can insert own game_scores"
    ON public.game_scores FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Enable Supabase Realtime for game_scores and game_profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_profiles;

-- ==============================================================================
-- 13. SECURE GAME SCORE SUBMISSION & LEADERBOARD RPCs
-- ==============================================================================

-- Anti-cheat verified score submission
CREATE OR REPLACE FUNCTION public.submit_snapdash_score(
    p_score INTEGER,
    p_duration_seconds INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_profile RECORD;
    v_is_new_best BOOLEAN := FALSE;
    v_max_possible_score INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required to save score.');
    END IF;

    -- Basic Anti-Cheat: Max realistic velocity calculation (points per second)
    -- Speed starts slow, max points per second with optimal collectibles is ~120 pts/sec
    v_max_possible_score := GREATEST(500, (COALESCE(p_duration_seconds, 1) + 5) * 160);
    IF p_score < 0 OR p_score > 500000 OR (p_duration_seconds > 0 AND p_score > v_max_possible_score) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or impossible score velocity detected.');
    END IF;

    -- Fetch or create default game profile
    SELECT * INTO v_profile FROM public.game_profiles WHERE user_id = v_user_id;
    IF NOT FOUND THEN
        INSERT INTO public.game_profiles (user_id, game_username, high_score, total_games_played)
        VALUES (v_user_id, 'Player_' || SUBSTRING(v_user_id::text FROM 1 FOR 6), p_score, 1)
        RETURNING * INTO v_profile;
        v_is_new_best := TRUE;
    ELSE
        IF p_score > v_profile.high_score THEN
            v_is_new_best := TRUE;
            UPDATE public.game_profiles
            SET high_score = p_score,
                total_games_played = total_games_played + 1,
                updated_at = NOW()
            WHERE user_id = v_user_id;
        ELSE
            UPDATE public.game_profiles
            SET total_games_played = total_games_played + 1,
                updated_at = NOW()
            WHERE user_id = v_user_id;
        END IF;
    END IF;

    -- Record score row
    INSERT INTO public.game_scores (user_id, game_username, score, duration_seconds)
    VALUES (v_user_id, v_profile.game_username, p_score, COALESCE(p_duration_seconds, 0));

    RETURN jsonb_build_object(
        'success', true,
        'isNewBest', v_is_new_best,
        'highScore', GREATEST(p_score, v_profile.high_score),
        'score', p_score,
        'gameUsername', v_profile.game_username
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;





-- ==============================================================================
-- SnapFind AI — VIP Seat Persistence, Exact Authoritative Count & Cross-Session Retention
-- Date: 2026-11-17
-- Safe & Additive: Preserves all existing verified VIP users and seat numbers (1..50).
-- ==============================================================================

-- 1. Ensure founder_claims allows authenticated users to read their own claim row
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'founder_claims') THEN
    ALTER TABLE public.founder_claims ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can select own founder claims" ON public.founder_claims;
    CREATE POLICY "Users can select own founder claims"
      ON public.founder_claims FOR SELECT
      USING (auth.uid()::text = user_id::text);

    GRANT SELECT ON public.founder_claims TO authenticated;
  END IF;
END $$;

-- 2. Authoritative non-PII VIP seat counter (deduplicates across founder_claims & user_entitlements,
--    only counts verified existing auth.users with a valid seat number 1..50)
CREATE OR REPLACE FUNCTION public.get_vip_seat_stats()
RETURNS TABLE (
    total_spots INTEGER,
    occupied_spots INTEGER,
    remaining_spots INTEGER
) AS $$
DECLARE
    v_occupied INTEGER := 0;
BEGIN
    SELECT COUNT(*)::INTEGER INTO v_occupied
    FROM (
        SELECT fc.user_id::text AS uid
        FROM public.founder_claims fc
        WHERE fc.status = 'claimed'
          AND fc.founder_rank BETWEEN 1 AND 50
          AND EXISTS (
              SELECT 1 FROM auth.users au WHERE au.id::text = fc.user_id::text
          )
        UNION
        SELECT ue.user_id::text AS uid
        FROM public.user_entitlements ue
        WHERE ue.is_founder = TRUE
          AND ue.founder_number BETWEEN 1 AND 50
          AND EXISTS (
              SELECT 1 FROM auth.users au WHERE au.id::text = ue.user_id::text
          )
    ) verified_vips;

    v_occupied := LEAST(50, GREATEST(0, COALESCE(v_occupied, 0)));
    RETURN QUERY SELECT 50, v_occupied, GREATEST(0, 50 - v_occupied);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.get_vip_seat_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vip_seat_stats() TO anon, authenticated, service_role;

-- 3. Authenticated-user self-claim RPC (strictly uses auth.uid(), works even without service_role key)
--    Atomically assigns lowest unused seat 1..50, prevents duplicate claims, preserves existing seat.
CREATE OR REPLACE FUNCTION public.claim_vip_seat_for_user(
    p_payment_id TEXT DEFAULT 'vip_50_free_claim'
)
RETURNS TABLE (
    success BOOLEAN,
    already_claimed BOOLEAN,
    founder_rank INTEGER,
    message TEXT,
    occupied_spots INTEGER,
    remaining_spots INTEGER
) AS $$
DECLARE
    v_uid TEXT;
    v_existing_rank INTEGER;
    v_next_rank INTEGER := 1;
    v_occupied INTEGER := 0;
BEGIN
    v_uid := auth.uid()::text;
    IF v_uid IS NULL OR LENGTH(TRIM(v_uid)) = 0 THEN
        RETURN QUERY SELECT FALSE, FALSE, NULL::INTEGER, 'Authentication required to claim a VIP seat.', 0, 50;
        RETURN;
    END IF;

    -- Serialize concurrent allocations atomically
    PERFORM pg_advisory_xact_lock(7982043);

    -- Check if this user already holds a verified VIP seat in either table (never reassign or double-count)
    SELECT fc.founder_rank INTO v_existing_rank
    FROM public.founder_claims fc
    WHERE fc.user_id::text = v_uid
      AND fc.status = 'claimed'
      AND fc.founder_rank BETWEEN 1 AND 50
    LIMIT 1;

    IF v_existing_rank IS NULL THEN
        SELECT ue.founder_number INTO v_existing_rank
        FROM public.user_entitlements ue
        WHERE ue.user_id::text = v_uid
          AND ue.is_founder = TRUE
          AND ue.founder_number BETWEEN 1 AND 50
        LIMIT 1;
    END IF;

    IF v_existing_rank IS NOT NULL THEN
        -- Ensure both tables stay synchronized for this user
        INSERT INTO public.founder_claims (id, user_id, founder_rank, payment_id, status, claimed_at)
        VALUES (gen_random_uuid()::text, v_uid, v_existing_rank, p_payment_id, 'claimed', NOW())
        ON CONFLICT (user_id) DO NOTHING;

        INSERT INTO public.user_entitlements (
            user_id, plan, tier, is_pro, is_founder, founder_number, founder_granted_at,
            max_screenshots, can_cloud_sync, can_ai_multimodal_search, priority_processing,
            features, status, updated_at
        ) VALUES (
            v_uid, 'founder', 'Founder', TRUE, TRUE, v_existing_rank, NOW(),
            150000, TRUE, TRUE, TRUE,
            '{"maxIndexedScreenshots":150000,"maxAIScansPerMonth":150000,"maxStorageMB":100000,"cloudSync":true,"advancedSearch":true,"aiCollections":true,"priorityProcessing":true}'::jsonb,
            'active', NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
            plan = 'founder',
            tier = 'Founder',
            is_pro = TRUE,
            is_founder = TRUE,
            founder_number = COALESCE(public.user_entitlements.founder_number, v_existing_rank),
            founder_granted_at = COALESCE(public.user_entitlements.founder_granted_at, NOW()),
            max_screenshots = 150000,
            can_cloud_sync = TRUE,
            can_ai_multimodal_search = TRUE,
            priority_processing = TRUE,
            features = EXCLUDED.features,
            status = 'active',
            updated_at = NOW();

        SELECT g.occupied_spots INTO v_occupied FROM public.get_vip_seat_stats() g;
        RETURN QUERY SELECT
            TRUE,
            TRUE,
            v_existing_rank,
            'VIP Seat #' || v_existing_rank::TEXT || ' is already active on your account.',
            v_occupied,
            GREATEST(0, 50 - v_occupied);
        RETURN;
    END IF;

    -- Enforce hard maximum of 50 seats
    SELECT g.occupied_spots INTO v_occupied FROM public.get_vip_seat_stats() g;
    IF v_occupied >= 50 THEN
        RETURN QUERY SELECT FALSE, FALSE, NULL::INTEGER, 'All 50 VIP seats have been occupied.', v_occupied, 0;
        RETURN;
    END IF;

    -- Assign lowest unused seat rank 1..50 (preserving all existing seat numbers)
    SELECT s.n INTO v_next_rank
    FROM generate_series(1, 50) AS s(n)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.founder_claims fc
        WHERE fc.founder_rank = s.n AND fc.status = 'claimed'
    )
    AND NOT EXISTS (
        SELECT 1 FROM public.user_entitlements ue
        WHERE ue.founder_number = s.n AND ue.is_founder = TRUE
    )
    ORDER BY s.n ASC
    LIMIT 1;

    IF v_next_rank IS NULL OR v_next_rank > 50 THEN
        RETURN QUERY SELECT FALSE, FALSE, NULL::INTEGER, 'All 50 VIP seats have been occupied.', v_occupied, 0;
        RETURN;
    END IF;

    INSERT INTO public.founder_claims (id, user_id, founder_rank, payment_id, status, claimed_at)
    VALUES (gen_random_uuid()::text, v_uid, v_next_rank, p_payment_id, 'claimed', NOW())
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.user_entitlements (
        user_id, plan, tier, is_pro, is_founder, founder_number, founder_granted_at,
        max_screenshots, can_cloud_sync, can_ai_multimodal_search, priority_processing,
        features, status, updated_at
    ) VALUES (
        v_uid,
        'founder',
        'Founder',
        TRUE,
        TRUE,
        v_next_rank,
        NOW(),
        150000,
        TRUE,
        TRUE,
        TRUE,
        '{
            "maxIndexedScreenshots": 150000,
            "maxAIScansPerMonth": 150000,
            "maxStorageMB": 100000,
            "cloudSync": true,
            "advancedSearch": true,
            "aiCollections": true,
            "priorityProcessing": true
        }'::jsonb,
        'active',
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        plan = 'founder',
        tier = 'Founder',
        is_pro = TRUE,
        is_founder = TRUE,
        founder_number = COALESCE(public.user_entitlements.founder_number, EXCLUDED.founder_number),
        founder_granted_at = COALESCE(public.user_entitlements.founder_granted_at, NOW()),
        max_screenshots = 150000,
        can_cloud_sync = TRUE,
        can_ai_multimodal_search = TRUE,
        priority_processing = TRUE,
        features = EXCLUDED.features,
        status = 'active',
        updated_at = NOW();

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        UPDATE public.profiles
        SET is_pro = TRUE,
            is_founder = TRUE,
            founder_rank = v_next_rank,
            plan = 'Founder',
            storage_limit_mb = 100000,
            updated_at = NOW()
        WHERE id::text = v_uid;
    END IF;

    SELECT g.occupied_spots INTO v_occupied FROM public.get_vip_seat_stats() g;
    RETURN QUERY SELECT
        TRUE,
        FALSE,
        v_next_rank,
        'VIP Seat #' || v_next_rank::TEXT || ' successfully allocated.',
        v_occupied,
        GREATEST(0, 50 - v_occupied);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.claim_vip_seat_for_user(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_vip_seat_for_user(TEXT) TO authenticated, service_role;

-- 4. Keep service_role atomic helper aligned with verified 1..50 rank logic
CREATE OR REPLACE FUNCTION public.claim_founder_seat_atomic(
    p_user_id TEXT,
    p_payment_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    founder_rank INTEGER,
    message TEXT,
    occupied_spots INTEGER,
    remaining_spots INTEGER
) AS $$
DECLARE
    v_existing_rank INTEGER;
    v_next_rank INTEGER := 1;
    v_occupied INTEGER := 0;
BEGIN
    IF p_user_id IS NULL OR LENGTH(TRIM(p_user_id)) = 0 OR p_user_id = 'guest' THEN
        RETURN QUERY SELECT FALSE, NULL::INTEGER, 'Sign in required to claim a VIP seat.', 0, 50;
        RETURN;
    END IF;

    PERFORM pg_advisory_xact_lock(7982043);

    SELECT fc.founder_rank INTO v_existing_rank
    FROM public.founder_claims fc
    WHERE fc.user_id::text = p_user_id
      AND fc.status = 'claimed'
      AND fc.founder_rank BETWEEN 1 AND 50
    LIMIT 1;

    IF v_existing_rank IS NULL THEN
        SELECT ue.founder_number INTO v_existing_rank
        FROM public.user_entitlements ue
        WHERE ue.user_id::text = p_user_id
          AND ue.is_founder = TRUE
          AND ue.founder_number BETWEEN 1 AND 50
        LIMIT 1;
    END IF;

    IF v_existing_rank IS NOT NULL THEN
        SELECT g.occupied_spots INTO v_occupied FROM public.get_vip_seat_stats() g;
        RETURN QUERY SELECT
            TRUE,
            v_existing_rank,
            'VIP Seat #' || v_existing_rank::TEXT || ' is already active on your account.',
            v_occupied,
            GREATEST(0, 50 - v_occupied);
        RETURN;
    END IF;

    SELECT g.occupied_spots INTO v_occupied FROM public.get_vip_seat_stats() g;
    IF v_occupied >= 50 THEN
        RETURN QUERY SELECT FALSE, NULL::INTEGER, 'All 50 VIP seats have been occupied.', v_occupied, 0;
        RETURN;
    END IF;

    SELECT s.n INTO v_next_rank
    FROM generate_series(1, 50) AS s(n)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.founder_claims fc
        WHERE fc.founder_rank = s.n AND fc.status = 'claimed'
    )
    AND NOT EXISTS (
        SELECT 1 FROM public.user_entitlements ue
        WHERE ue.founder_number = s.n AND ue.is_founder = TRUE
    )
    ORDER BY s.n ASC
    LIMIT 1;

    IF v_next_rank IS NULL OR v_next_rank > 50 THEN
        RETURN QUERY SELECT FALSE, NULL::INTEGER, 'All 50 VIP seats have been occupied.', v_occupied, 0;
        RETURN;
    END IF;

    INSERT INTO public.founder_claims (id, user_id, founder_rank, payment_id, status, claimed_at)
    VALUES (gen_random_uuid()::text, p_user_id, v_next_rank, p_payment_id, 'claimed', NOW())
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.user_entitlements (
        user_id, plan, tier, is_pro, is_founder, founder_number, founder_granted_at,
        max_screenshots, can_cloud_sync, can_ai_multimodal_search, priority_processing,
        features, status, updated_at
    ) VALUES (
        p_user_id,
        'founder',
        'Founder',
        TRUE,
        TRUE,
        v_next_rank,
        NOW(),
        150000,
        TRUE,
        TRUE,
        TRUE,
        '{
            "maxIndexedScreenshots": 150000,
            "maxAIScansPerMonth": 150000,
            "maxStorageMB": 100000,
            "cloudSync": true,
            "advancedSearch": true,
            "aiCollections": true,
            "priorityProcessing": true
        }'::jsonb,
        'active',
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        plan = 'founder',
        tier = 'Founder',
        is_pro = TRUE,
        is_founder = TRUE,
        founder_number = COALESCE(public.user_entitlements.founder_number, EXCLUDED.founder_number),
        founder_granted_at = COALESCE(public.user_entitlements.founder_granted_at, NOW()),
        max_screenshots = 150000,
        can_cloud_sync = TRUE,
        can_ai_multimodal_search = TRUE,
        priority_processing = TRUE,
        features = EXCLUDED.features,
        status = 'active',
        updated_at = NOW();

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        UPDATE public.profiles
        SET is_pro = TRUE,
            is_founder = TRUE,
            founder_rank = v_next_rank,
            plan = 'Founder',
            storage_limit_mb = 100000,
            updated_at = NOW()
        WHERE id::text = p_user_id;
    END IF;

    SELECT g.occupied_spots INTO v_occupied FROM public.get_vip_seat_stats() g;
    RETURN QUERY SELECT
        TRUE,
        v_next_rank,
        'VIP Seat #' || v_next_rank::TEXT || ' successfully allocated.',
        v_occupied,
        GREATEST(0, 50 - v_occupied);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.claim_founder_seat_atomic(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_founder_seat_atomic(TEXT, TEXT) TO service_role;
