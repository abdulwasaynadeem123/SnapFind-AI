-- ==============================================================================
-- SnapFind AI — VIP Seat Persistence, Exact Authoritative Count & Cross-Session Retention
-- Date: 2026-11-17
-- Safe & Additive: Preserves all existing verified VIP users and seat numbers (1..50).
-- ==============================================================================

-- 0. Ensure required entitlement/profile columns exist safely across all environments
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_entitlements') THEN
    ALTER TABLE public.user_entitlements
      ADD COLUMN IF NOT EXISTS can_cloud_sync BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS can_ai_multimodal_search BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS priority_processing BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS is_founder BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS founder_rank INTEGER,
      ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'Free';
  END IF;
END $$;

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
