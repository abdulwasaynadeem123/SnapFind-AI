-- ==============================================================================
-- SnapFind AI: Authoritative 50-Seat VIP Counter & Non-Auto Signup Migration
-- Date: 2026-11-14
-- Preserves all existing VIP seat allocations (#1..#50) while stopping
-- automatic VIP grants for ordinary signups and providing public RPC stats.
-- ==============================================================================

-- 1. Update founder_benefit_config safely (never wipes existing claims)
INSERT INTO public.system_configs (key, value, description)
VALUES (
  'founder_benefit_config',
  '{"max_founder_users": 50, "benefit_duration_days": null, "enabled": true}'::jsonb,
  'Maximum 50 VIP seats (#1 to #50), lifetime duration (null = lifetime).'
)
ON CONFLICT (key) DO UPDATE SET
  value = jsonb_set(
    COALESCE(public.system_configs.value, '{}'::jsonb),
    '{max_founder_users}',
    '50'::jsonb,
    true
  ),
  updated_at = NOW();

-- 2. Replace handle_new_user() so ordinary signups start on Free (NEVER auto-grant VIP)
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Public non-PII RPC for accurate 50-seat VIP availability (bypasses per-user RLS safely)
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
        SELECT ue.user_id::text AS uid
        FROM public.user_entitlements ue
        WHERE ue.is_founder = TRUE
        UNION
        SELECT fc.user_id::text AS uid
        FROM public.founder_claims fc
        WHERE fc.status = 'claimed'
    ) verified_vips;

    v_occupied := LEAST(50, GREATEST(0, COALESCE(v_occupied, 0)));
    RETURN QUERY SELECT 50, v_occupied, GREATEST(0, 50 - v_occupied);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION public.get_vip_seat_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vip_seat_stats() TO anon, authenticated, service_role;

-- 4. Hardened atomic VIP seat allocation RPC (deduplicated, preserves existing ranks 1..50)
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

    -- Serialize concurrent allocations atomically
    PERFORM pg_advisory_xact_lock(7982043);

    -- Check if user already holds a verified VIP allocation (preserve seat number, idempotent)
    SELECT COALESCE(fc.founder_rank, ue.founder_number) INTO v_existing_rank
    FROM (SELECT p_user_id AS uid) req
    LEFT JOIN public.founder_claims fc
        ON fc.user_id::text = req.uid AND fc.status = 'claimed'
    LEFT JOIN public.user_entitlements ue
        ON ue.user_id::text = req.uid AND ue.is_founder = TRUE
    WHERE fc.founder_rank IS NOT NULL OR ue.founder_number IS NOT NULL
    LIMIT 1;

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

    -- Count current verified VIP allocations
    SELECT g.occupied_spots INTO v_occupied FROM public.get_vip_seat_stats() g;
    IF v_occupied >= 50 THEN
        RETURN QUERY SELECT FALSE, NULL::INTEGER, 'All 50 VIP seats have been occupied.', v_occupied, 0;
        RETURN;
    END IF;

    -- Pick lowest unused seat number in 1..50 (preserving all existing seat numbers)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.claim_founder_seat_atomic(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_founder_seat_atomic(TEXT, TEXT) TO service_role;
