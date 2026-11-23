-- ==============================================================================
-- SnapFind AI — First 50 Signups Lifetime Free VIP Program
-- Date: 2026-11-20
-- Safe & Additive:
--   1. Preserves all existing verified VIP members (#1..#50) and paid Pro users.
--   2. Never retroactively marks existing non-VIP users as eligible.
--   3. Atomically assigns VIP eligibility (first 50 slots) strictly at account signup.
--   4. Requires explicit manual user Claim to activate Lifetime Free VIP.
-- ==============================================================================

-- 1. Extend user_entitlements & notifications with VIP eligibility & reminder metadata columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_entitlements'
  ) THEN
    ALTER TABLE public.user_entitlements
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS can_cloud_sync BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS can_ai_multimodal_search BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS priority_processing BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS signup_number INTEGER,
      ADD COLUMN IF NOT EXISTS vip_eligible BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS vip_claim_status TEXT NOT NULL DEFAULT 'not_eligible',
      ADD COLUMN IF NOT EXISTS vip_claimed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS vip_offer_deferred_at TIMESTAMPTZ;

    -- Ensure valid constraint on vip_claim_status
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'user_entitlements_vip_claim_status_check'
    ) THEN
      ALTER TABLE public.user_entitlements
        ADD CONSTRAINT user_entitlements_vip_claim_status_check
        CHECK (vip_claim_status IN ('not_eligible', 'pending', 'claimed'));
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    ALTER TABLE public.notifications
      ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_entitlements_vip_eligible
  ON public.user_entitlements (vip_eligible, vip_claim_status);

CREATE INDEX IF NOT EXISTS idx_user_entitlements_signup_number
  ON public.user_entitlements (signup_number);

-- 2. Authoritative singleton counter for First-50 Signup Eligibility
CREATE TABLE IF NOT EXISTS public.vip_program_state (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  max_eligible_signups INTEGER NOT NULL DEFAULT 50 CHECK (max_eligible_signups >= 1),
  eligible_slots_assigned INTEGER NOT NULL DEFAULT 0 CHECK (eligible_slots_assigned >= 0),
  total_signups_tracked INTEGER NOT NULL DEFAULT 0 CHECK (total_signups_tracked >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vip_program_state ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.vip_program_state FROM anon, authenticated;
GRANT SELECT ON public.vip_program_state TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Allow read access to vip_program_state" ON public.vip_program_state;
CREATE POLICY "Allow read access to vip_program_state"
  ON public.vip_program_state FOR SELECT
  USING (true);

-- 3. Backfill preserved existing VIP users ONLY (existing non-VIP & paid Pro users remain untouched)
DO $$
DECLARE
  v_preserved_vips INTEGER := 0;
  v_total_auth_users INTEGER := 0;
BEGIN
  -- Sync existing verified founder_claims rows into user_entitlements as claimed VIPs
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'founder_claims'
  ) THEN
    UPDATE public.user_entitlements ue
    SET
      is_founder = TRUE,
      is_pro = TRUE,
      plan = 'founder',
      tier = 'Founder',
      founder_number = COALESCE(ue.founder_number, fc.founder_rank),
      founder_granted_at = COALESCE(ue.founder_granted_at, fc.claimed_at, NOW()),
      vip_eligible = TRUE,
      vip_claim_status = 'claimed',
      vip_claimed_at = COALESCE(ue.vip_claimed_at, fc.claimed_at, ue.founder_granted_at, NOW()),
      updated_at = NOW()
    FROM public.founder_claims fc
    WHERE fc.user_id::text = ue.user_id::text
      AND fc.status = 'claimed'
      AND fc.founder_rank BETWEEN 1 AND 50;
  END IF;

  -- Mark any existing verified VIP user_entitlements rows as claimed
  UPDATE public.user_entitlements
  SET
    vip_eligible = TRUE,
    vip_claim_status = 'claimed',
    vip_claimed_at = COALESCE(vip_claimed_at, founder_granted_at, updated_at, NOW())
  WHERE is_founder = TRUE
    AND founder_number BETWEEN 1 AND 50
    AND vip_claim_status <> 'claimed';

  -- Count preserved VIP accounts + pending eligible slots already initialized
  SELECT COUNT(*)::INTEGER INTO v_preserved_vips
  FROM public.user_entitlements ue
  WHERE ue.vip_eligible = TRUE
    AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id::text = ue.user_id::text);

  SELECT COUNT(*)::INTEGER INTO v_total_auth_users FROM auth.users;

  INSERT INTO public.vip_program_state (id, max_eligible_signups, eligible_slots_assigned, total_signups_tracked, updated_at)
  VALUES (
    TRUE,
    50,
    LEAST(50, GREATEST(0, COALESCE(v_preserved_vips, 0))),
    GREATEST(COALESCE(v_preserved_vips, 0), COALESCE(v_total_auth_users, 0)),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    eligible_slots_assigned = GREATEST(public.vip_program_state.eligible_slots_assigned, LEAST(50, COALESCE(v_preserved_vips, 0))),
    total_signups_tracked = GREATEST(public.vip_program_state.total_signups_tracked, COALESCE(v_total_auth_users, 0)),
    updated_at = NOW();
END $$;

-- 4. Authoritative Non-PII Stats RPC (counts occupied/claimed, assigned eligibility, and remaining slots)
-- Drop previous signature cleanly in case column list changes
DROP FUNCTION IF EXISTS public.get_vip_seat_stats();
CREATE OR REPLACE FUNCTION public.get_vip_seat_stats()
RETURNS TABLE (
    total_spots INTEGER,
    occupied_spots INTEGER,
    remaining_spots INTEGER,
    assigned_slots INTEGER,
    total_signups INTEGER
) AS $$
DECLARE
    v_claimed INTEGER := 0;
    v_assigned INTEGER := 0;
    v_max INTEGER := 50;
    v_total_signups INTEGER := 0;
    v_used_slots INTEGER := 0;
BEGIN
    SELECT COUNT(*)::INTEGER INTO v_claimed
    FROM (
        SELECT fc.user_id::text AS uid
        FROM public.founder_claims fc
        WHERE fc.status = 'claimed'
          AND fc.founder_rank BETWEEN 1 AND 50
          AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id::text = fc.user_id::text)
        UNION
        SELECT ue.user_id::text AS uid
        FROM public.user_entitlements ue
        WHERE ue.is_founder = TRUE
          AND ue.founder_number BETWEEN 1 AND 50
          AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id::text = ue.user_id::text)
    ) verified_vips;

    SELECT
      COALESCE(s.max_eligible_signups, 50),
      COALESCE(s.eligible_slots_assigned, 0),
      COALESCE(s.total_signups_tracked, 0)
    INTO v_max, v_assigned, v_total_signups
    FROM public.vip_program_state s
    WHERE s.id = TRUE;

    v_claimed := LEAST(v_max, GREATEST(0, COALESCE(v_claimed, 0)));
    v_assigned := LEAST(v_max, GREATEST(v_claimed, COALESCE(v_assigned, 0)));
    v_used_slots := LEAST(v_max, GREATEST(v_claimed, v_assigned));

    RETURN QUERY SELECT
      v_max,
      v_claimed,
      GREATEST(0, v_max - v_used_slots),
      v_assigned,
      GREATEST(v_total_signups, v_used_slots);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.get_vip_seat_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vip_seat_stats() TO anon, authenticated, service_role;

-- 5. Signup Trigger: Atomically assigns eligibility to first 50 signups ONLY (NEVER auto-grants VIP)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_max INTEGER := 50;
    v_assigned INTEGER := 0;
    v_total INTEGER := 0;
    v_new_signup_num INTEGER := 1;
    v_is_eligible BOOLEAN := FALSE;
    v_claim_status TEXT := 'not_eligible';
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
    -- Serialize concurrent signups so slots 1..50 are assigned atomically without race conditions
    PERFORM pg_advisory_xact_lock(7982043);

    INSERT INTO public.vip_program_state (id, max_eligible_signups, eligible_slots_assigned, total_signups_tracked, updated_at)
    VALUES (TRUE, 50, 0, 0, NOW())
    ON CONFLICT (id) DO NOTHING;

    SELECT max_eligible_signups, eligible_slots_assigned, total_signups_tracked
    INTO v_max, v_assigned, v_total
    FROM public.vip_program_state
    WHERE id = TRUE
    FOR UPDATE;

    v_new_signup_num := COALESCE(v_total, 0) + 1;

    IF COALESCE(v_assigned, 0) < COALESCE(v_max, 50) THEN
        v_is_eligible := TRUE;
        v_claim_status := 'pending';
        UPDATE public.vip_program_state
        SET eligible_slots_assigned = v_assigned + 1,
            total_signups_tracked = v_new_signup_num,
            updated_at = NOW()
        WHERE id = TRUE;
    ELSE
        v_is_eligible := FALSE;
        v_claim_status := 'not_eligible';
        UPDATE public.vip_program_state
        SET total_signups_tracked = v_new_signup_num,
            updated_at = NOW()
        WHERE id = TRUE;
    END IF;

    INSERT INTO public.profiles (id, name, email, avatar_url, is_pro, storage_limit_mb)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
        FALSE,
        1000
    )
    ON CONFLICT (id) DO NOTHING;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings') THEN
        INSERT INTO public.settings (user_id)
        VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    -- Always initialize with Free tier + signup eligibility flags (VIP is never auto-granted)
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
        status,
        signup_number,
        vip_eligible,
        vip_claim_status,
        vip_claimed_at,
        vip_offer_deferred_at,
        expires_at,
        updated_at
    )
    VALUES (
        NEW.id,
        'free',
        FALSE,
        NULL,
        NULL,
        NULL,
        'Free',
        FALSE,
        v_features,
        250,
        FALSE,
        TRUE,
        FALSE,
        'active',
        v_new_signup_num,
        v_is_eligible,
        v_claim_status,
        NULL,
        NULL,
        NULL,
        NOW()
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. RPC: Check authenticated user's authoritative VIP eligibility state
CREATE OR REPLACE FUNCTION public.get_my_vip_eligibility()
RETURNS TABLE (
    user_id TEXT,
    signup_number INTEGER,
    vip_eligible BOOLEAN,
    vip_claim_status TEXT,
    vip_claimed_at TIMESTAMPTZ,
    vip_offer_deferred_at TIMESTAMPTZ,
    founder_number INTEGER,
    is_founder BOOLEAN,
    total_spots INTEGER,
    assigned_slots INTEGER,
    occupied_spots INTEGER,
    remaining_spots INTEGER
) AS $$
DECLARE
    v_uid TEXT;
    v_row RECORD;
    v_stats RECORD;
BEGIN
    v_uid := auth.uid()::text;
    IF v_uid IS NULL OR LENGTH(TRIM(v_uid)) = 0 THEN
        RETURN;
    END IF;

    SELECT
      ue.signup_number,
      COALESCE(ue.vip_eligible, FALSE) AS vip_eligible,
      CASE
        WHEN ue.is_founder = TRUE AND ue.founder_number BETWEEN 1 AND 50 THEN 'claimed'
        WHEN ue.vip_claim_status IN ('not_eligible', 'pending', 'claimed') THEN ue.vip_claim_status
        ELSE 'not_eligible'
      END AS vip_claim_status,
      ue.vip_claimed_at,
      ue.vip_offer_deferred_at,
      ue.founder_number,
      COALESCE(ue.is_founder, FALSE) AS is_founder
    INTO v_row
    FROM public.user_entitlements ue
    WHERE ue.user_id::text = v_uid
    LIMIT 1;

    SELECT * INTO v_stats FROM public.get_vip_seat_stats() LIMIT 1;

    RETURN QUERY SELECT
      v_uid,
      v_row.signup_number,
      COALESCE(v_row.vip_eligible, FALSE),
      COALESCE(v_row.vip_claim_status, 'not_eligible'),
      v_row.vip_claimed_at,
      v_row.vip_offer_deferred_at,
      v_row.founder_number,
      COALESCE(v_row.is_founder, FALSE),
      COALESCE(v_stats.total_spots, 50),
      COALESCE(v_stats.assigned_slots, 0),
      COALESCE(v_stats.occupied_spots, 0),
      COALESCE(v_stats.remaining_spots, 50);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.get_my_vip_eligibility() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_vip_eligibility() TO authenticated, service_role;

-- 7. RPC: Record "Maybe Later" deferral and persist VIP reminder notification in Postgres
CREATE OR REPLACE FUNCTION public.defer_vip_offer_for_user()
RETURNS TABLE (
    success BOOLEAN,
    vip_eligible BOOLEAN,
    vip_claim_status TEXT,
    vip_offer_deferred_at TIMESTAMPTZ,
    message TEXT
) AS $$
DECLARE
    v_uid TEXT;
    v_eligible BOOLEAN := FALSE;
    v_status TEXT := 'not_eligible';
    v_deferred TIMESTAMPTZ;
    v_notif_id TEXT;
BEGIN
    v_uid := auth.uid()::text;
    IF v_uid IS NULL OR LENGTH(TRIM(v_uid)) = 0 THEN
        RETURN QUERY SELECT FALSE, FALSE, 'not_eligible'::TEXT, NULL::TIMESTAMPTZ, 'Authentication required.'::TEXT;
        RETURN;
    END IF;

    SELECT ue.vip_eligible, ue.vip_claim_status, ue.vip_offer_deferred_at
    INTO v_eligible, v_status, v_deferred
    FROM public.user_entitlements ue
    WHERE ue.user_id::text = v_uid
    LIMIT 1;

    IF COALESCE(v_eligible, FALSE) = FALSE OR v_status = 'not_eligible' THEN
        RETURN QUERY SELECT FALSE, FALSE, 'not_eligible'::TEXT, NULL::TIMESTAMPTZ, 'Your account is not eligible for the First 50 Lifetime Free VIP offer.'::TEXT;
        RETURN;
    END IF;

    IF v_status = 'claimed' THEN
        RETURN QUERY SELECT TRUE, TRUE, 'claimed'::TEXT, v_deferred, 'Lifetime Free VIP is already active on your account.'::TEXT;
        RETURN;
    END IF;

    v_deferred := COALESCE(v_deferred, NOW());
    UPDATE public.user_entitlements
    SET vip_offer_deferred_at = v_deferred,
        updated_at = NOW()
    WHERE user_id::text = v_uid;

    -- Idempotently create persistent VIP waiting reminder notification if notifications table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
        v_notif_id := 'vip_offer_waiting_' || v_uid;
        INSERT INTO public.notifications (
            id, user_id, type, title, message, priority, read, created_at, metadata
        ) VALUES (
            v_notif_id,
            v_uid,
            'SUBSCRIPTION',
            'Your Lifetime Free VIP Offer Is Waiting',
            'Your Lifetime Free VIP offer is waiting! Claim it anytime while your account remains eligible.',
            'high',
            FALSE,
            NOW(),
            '{"eventType":"vip_offer_waiting","actionType":"open_vip_claim"}'::jsonb
        )
        ON CONFLICT (id) DO NOTHING;
    END IF;

    RETURN QUERY SELECT TRUE, TRUE, 'pending'::TEXT, v_deferred, 'Your Lifetime Free VIP offer remains reserved.'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.defer_vip_offer_for_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.defer_vip_offer_for_user() TO authenticated, service_role;

-- 8. Core Claim Helper (Shared between authenticated user RPC and service_role RPC)
--    Strictly enforces First-50 signup eligibility, atomic lock, verified email check,
--    and removes pending VIP reminder notification on activation.
CREATE OR REPLACE FUNCTION public.claim_founder_seat_atomic(
    p_user_id TEXT,
    p_payment_id TEXT DEFAULT 'vip_first50_claim'
)
RETURNS TABLE (
    success BOOLEAN,
    founder_rank INTEGER,
    message TEXT,
    occupied_spots INTEGER,
    remaining_spots INTEGER
) AS $$
DECLARE
    v_uid TEXT := TRIM(COALESCE(p_user_id, ''));
    v_existing_rank INTEGER;
    v_next_rank INTEGER := 1;
    v_occupied INTEGER := 0;
    v_eligible BOOLEAN := FALSE;
    v_claim_status TEXT := 'not_eligible';
    v_email_confirmed TIMESTAMPTZ;
    v_provider TEXT := 'email';
BEGIN
    IF LENGTH(v_uid) = 0 OR v_uid = 'guest' THEN
        RETURN QUERY SELECT FALSE, NULL::INTEGER, 'Sign in required to claim Lifetime Free VIP.', 0, 50;
        RETURN;
    END IF;

    PERFORM pg_advisory_xact_lock(7982043);

    -- Verify email confirmation for email/password accounts when auth.users record exists
    SELECT
      au.email_confirmed_at,
      COALESCE(au.raw_app_meta_data->>'provider', 'email')
    INTO v_email_confirmed, v_provider
    FROM auth.users au
    WHERE au.id::text = v_uid
    LIMIT 1;

    IF v_provider = 'email' AND v_email_confirmed IS NULL THEN
        SELECT g.occupied_spots INTO v_occupied FROM public.get_vip_seat_stats() g;
        RETURN QUERY SELECT FALSE, NULL::INTEGER, 'Please verify your email address before claiming Lifetime Free VIP.', v_occupied, GREATEST(0, 50 - v_occupied);
        RETURN;
    END IF;

    -- 1. Check if this user already claimed VIP in founder_claims or user_entitlements (idempotent return)
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
        UPDATE public.user_entitlements
        SET vip_eligible = TRUE,
            vip_claim_status = 'claimed',
            vip_claimed_at = COALESCE(vip_claimed_at, founder_granted_at, NOW()),
            is_founder = TRUE,
            is_pro = TRUE,
            plan = 'founder',
            tier = 'Founder',
            updated_at = NOW()
        WHERE user_id::text = v_uid;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
            DELETE FROM public.notifications WHERE id = ('vip_offer_waiting_' || v_uid) AND user_id::text = v_uid;
        END IF;

        SELECT g.occupied_spots INTO v_occupied FROM public.get_vip_seat_stats() g;
        RETURN QUERY SELECT
            TRUE,
            v_existing_rank,
            'VIP Member #' || v_existing_rank::TEXT || ' is already active on your account.',
            v_occupied,
            GREATEST(0, 50 - v_occupied);
        RETURN;
    END IF;

    -- 2. Check authoritative signup eligibility (strictly assigned at account creation)
    SELECT ue.vip_eligible, ue.vip_claim_status
    INTO v_eligible, v_claim_status
    FROM public.user_entitlements ue
    WHERE ue.user_id::text = v_uid
    LIMIT 1;

    IF COALESCE(v_eligible, FALSE) = FALSE OR v_claim_status = 'not_eligible' THEN
        SELECT g.occupied_spots INTO v_occupied FROM public.get_vip_seat_stats() g;
        RETURN QUERY SELECT
            FALSE,
            NULL::INTEGER,
            'Your account is not eligible for the First 50 Lifetime Free VIP offer.',
            v_occupied,
            GREATEST(0, 50 - v_occupied);
        RETURN;
    END IF;

    -- 3. Assign lowest unused VIP member number 1..50 (preserving existing VIP members' ranks)
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
        SELECT g.occupied_spots INTO v_occupied FROM public.get_vip_seat_stats() g;
        RETURN QUERY SELECT FALSE, NULL::INTEGER, 'The First 50 Lifetime Free VIP offer has ended.', v_occupied, 0;
        RETURN;
    END IF;

    INSERT INTO public.founder_claims (id, user_id, founder_rank, payment_id, status, claimed_at)
    VALUES (gen_random_uuid()::text, v_uid, v_next_rank, COALESCE(p_payment_id, 'vip_first50_claim'), 'claimed', NOW())
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.user_entitlements
    SET
        plan = 'founder',
        tier = 'Founder',
        is_pro = TRUE,
        is_founder = TRUE,
        founder_number = COALESCE(founder_number, v_next_rank),
        founder_granted_at = COALESCE(founder_granted_at, NOW()),
        max_screenshots = 150000,
        can_cloud_sync = TRUE,
        can_ai_multimodal_search = TRUE,
        priority_processing = TRUE,
        features = '{
            "maxIndexedScreenshots": 150000,
            "maxAIScansPerMonth": 150000,
            "maxStorageMB": 100000,
            "cloudSync": true,
            "advancedSearch": true,
            "aiCollections": true,
            "priorityProcessing": true
        }'::jsonb,
        status = 'active',
        vip_eligible = TRUE,
        vip_claim_status = 'claimed',
        vip_claimed_at = COALESCE(vip_claimed_at, NOW()),
        expires_at = NULL,
        updated_at = NOW()
    WHERE user_id::text = v_uid;

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

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
        DELETE FROM public.notifications WHERE id = ('vip_offer_waiting_' || v_uid) AND user_id::text = v_uid;
    END IF;

    SELECT g.occupied_spots INTO v_occupied FROM public.get_vip_seat_stats() g;
    RETURN QUERY SELECT
        TRUE,
        v_next_rank,
        'Lifetime Free VIP activated! You are VIP Member #' || v_next_rank::TEXT || '.',
        v_occupied,
        GREATEST(0, 50 - v_occupied);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.claim_founder_seat_atomic(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_founder_seat_atomic(TEXT, TEXT) TO service_role;

-- 9. Authenticated user self-claim wrapper (strictly scoped to auth.uid())
CREATE OR REPLACE FUNCTION public.claim_vip_seat_for_user(
    p_payment_id TEXT DEFAULT 'vip_first50_claim'
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
    v_was_claimed BOOLEAN := FALSE;
    v_res RECORD;
BEGIN
    v_uid := auth.uid()::text;
    IF v_uid IS NULL OR LENGTH(TRIM(v_uid)) = 0 THEN
        RETURN QUERY SELECT FALSE, FALSE, NULL::INTEGER, 'Authentication required to claim Lifetime Free VIP.', 0, 50;
        RETURN;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.founder_claims fc
        WHERE fc.user_id::text = v_uid AND fc.status = 'claimed'
    ) OR EXISTS (
        SELECT 1 FROM public.user_entitlements ue
        WHERE ue.user_id::text = v_uid AND ue.is_founder = TRUE
    ) INTO v_was_claimed;

    SELECT * INTO v_res FROM public.claim_founder_seat_atomic(v_uid, p_payment_id) LIMIT 1;

    RETURN QUERY SELECT
        v_res.success,
        COALESCE(v_res.success AND v_was_claimed, FALSE),
        v_res.founder_rank,
        v_res.message,
        v_res.occupied_spots,
        v_res.remaining_spots;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION public.claim_vip_seat_for_user(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_vip_seat_for_user(TEXT) TO authenticated, service_role;
