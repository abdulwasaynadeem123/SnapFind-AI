-- SnapFind account/profile and quota integrity repair.
-- Username is unique case-insensitively and can only be changed by its owner.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_ci_unique
ON public.profiles (lower(username))
WHERE username IS NOT NULL AND btrim(username) <> '';

CREATE OR REPLACE FUNCTION public.set_my_username(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_username text := lower(btrim(coalesce(p_username, '')));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF v_username !~ '^[a-z0-9_]{3,24}$' THEN
    RAISE EXCEPTION 'Username must be 3-24 characters using lowercase letters, numbers, or underscores';
  END IF;

  UPDATE public.profiles
  SET username = v_username, updated_at = pg_catalog.now()
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for authenticated user';
  END IF;

  RETURN v_username;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'USERNAME_TAKEN' USING ERRCODE = '23505';
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_username(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_my_username(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_my_username(text) TO authenticated;

-- Atomic quota enforcement. The row is locked before checking and incrementing,
-- preventing simultaneous requests from exceeding a plan's stored limits.
CREATE OR REPLACE FUNCTION public.record_snapfind_usage(
  p_user_id uuid,
  p_action text,
  p_count integer DEFAULT 1,
  p_bytes bigint DEFAULT 0
)
RETURNS public.user_usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_row public.user_usage;
  v_ent public.user_entitlements;
  v_count integer := greatest(1, least(coalesce(p_count, 1), 1000));
  v_bytes bigint := greatest(0, coalesce(p_bytes, 0));
  v_plan text := 'free';
  v_is_pro boolean := false;
  v_is_founder boolean := false;
  v_features jsonb := '{}'::jsonb;
  v_max_screenshots integer := 250;
  v_max_ai integer := 250;
  v_max_storage_mb integer := 1000;
  v_cloud_sync boolean := false;
  v_period_start date;
  v_next_reset date;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user required' USING ERRCODE = '42501';
  END IF;
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'You may only update your own usage' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('ai_scan', 'index_screenshot', 'delete_screenshot', 'cloud_sync', 'analyze_screenshot') THEN
    RAISE EXCEPTION 'Unsupported usage action';
  END IF;

  SELECT * INTO v_ent
  FROM public.user_entitlements
  WHERE user_id = p_user_id;

  IF FOUND THEN
    v_plan := lower(coalesce(v_ent.plan, 'free'));
    v_is_pro := coalesce(v_ent.is_pro, false);
    v_is_founder := coalesce(v_ent.is_founder, false);
    v_features := coalesce(v_ent.features, '{}'::jsonb);

    IF (v_ent.status NOT IN ('active', 'trialing', 'free'))
       OR (v_ent.expires_at IS NOT NULL AND v_ent.expires_at <= pg_catalog.now()) THEN
      v_plan := 'free';
      v_is_pro := false;
      v_is_founder := false;
      v_features := '{}'::jsonb;
    ELSIF v_is_founder THEN
      v_plan := 'founder';
    ELSIF NOT v_is_pro THEN
      v_plan := 'free';
    ELSIF v_plan NOT IN ('monthly', 'yearly', 'lifetime', 'pro') THEN
      v_plan := 'pro';
    END IF;
  END IF;

  v_max_screenshots := coalesce(
    CASE WHEN (v_features->>'maxIndexedScreenshots') ~ '^[0-9]+$'
      THEN (v_features->>'maxIndexedScreenshots')::integer END,
    CASE WHEN v_plan = 'free' THEN 250
         WHEN v_plan = 'monthly' THEN 2500
         WHEN v_plan = 'yearly' THEN 30000
         WHEN v_plan = 'founder' THEN 150000
         ELSE 100000 END
  );
  v_max_ai := coalesce(
    CASE WHEN (v_features->>'maxAIScansPerMonth') ~ '^[0-9]+$'
      THEN (v_features->>'maxAIScansPerMonth')::integer END,
    CASE WHEN v_plan = 'free' THEN 250
         WHEN v_plan = 'monthly' THEN 2500
         WHEN v_plan = 'yearly' THEN 30000
         WHEN v_plan = 'founder' THEN 150000
         ELSE 100000 END
  );
  v_max_storage_mb := coalesce(
    CASE WHEN (v_features->>'maxStorageMB') ~ '^[0-9]+$'
      THEN (v_features->>'maxStorageMB')::integer END,
    CASE WHEN v_plan = 'free' THEN 1000
         WHEN v_plan = 'monthly' THEN 5000
         WHEN v_plan = 'yearly' THEN 15000
         WHEN v_plan = 'founder' THEN 100000
         ELSE 50000 END
  );
  v_cloud_sync := coalesce(
    CASE WHEN v_features ? 'cloudSync' THEN (v_features->>'cloudSync')::boolean END,
    v_plan IN ('monthly', 'yearly', 'lifetime', 'pro', 'founder')
  );

  v_period_start := CASE
    WHEN v_plan = 'yearly' THEN pg_catalog.date_trunc('year', pg_catalog.now())::date
    ELSE pg_catalog.date_trunc('month', pg_catalog.now())::date
  END;
  v_next_reset := CASE
    WHEN v_plan = 'yearly' THEN (v_period_start + interval '1 year')::date
    ELSE (v_period_start + interval '1 month')::date
  END;

  INSERT INTO public.user_usage (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row
  FROM public.user_usage
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_row.period_start IS DISTINCT FROM v_period_start THEN
    UPDATE public.user_usage
    SET ai_analyses_used = 0,
        screenshots_indexed = CASE WHEN v_plan IN ('monthly', 'yearly') THEN 0 ELSE screenshots_indexed END,
        period_start = v_period_start,
        monthly_reset_date = v_next_reset,
        updated_at = pg_catalog.now()
    WHERE user_id = p_user_id
    RETURNING * INTO v_row;
  END IF;

  IF p_action IN ('ai_scan', 'analyze_screenshot')
     AND v_row.ai_analyses_used + v_count > v_max_ai THEN
    RAISE EXCEPTION 'AI_QUOTA_EXCEEDED';
  END IF;
  IF p_action IN ('index_screenshot', 'analyze_screenshot')
     AND v_row.screenshots_indexed + v_count > v_max_screenshots THEN
    RAISE EXCEPTION 'SCREENSHOT_QUOTA_EXCEEDED';
  END IF;
  IF p_action IN ('index_screenshot', 'analyze_screenshot')
     AND v_row.storage_bytes_used + v_bytes > (v_max_storage_mb::bigint * 1024 * 1024) THEN
    RAISE EXCEPTION 'STORAGE_QUOTA_EXCEEDED';
  END IF;
  IF p_action = 'cloud_sync' AND NOT v_cloud_sync THEN
    RAISE EXCEPTION 'FEATURE_NOT_INCLUDED';
  END IF;

  UPDATE public.user_usage
  SET ai_analyses_used = CASE
        WHEN p_action IN ('ai_scan', 'analyze_screenshot') THEN ai_analyses_used + v_count
        ELSE ai_analyses_used END,
      screenshots_indexed = CASE
        WHEN p_action IN ('index_screenshot', 'analyze_screenshot') THEN screenshots_indexed + v_count
        WHEN p_action = 'delete_screenshot' THEN greatest(0, screenshots_indexed - v_count)
        ELSE screenshots_indexed END,
      storage_bytes_used = CASE
        WHEN p_action IN ('index_screenshot', 'analyze_screenshot') THEN storage_bytes_used + v_bytes
        WHEN p_action = 'delete_screenshot' THEN greatest(0, storage_bytes_used - v_bytes)
        ELSE storage_bytes_used END,
      cloud_sync_count = CASE WHEN p_action = 'cloud_sync' THEN cloud_sync_count + v_count ELSE cloud_sync_count END,
      period_start = v_period_start,
      monthly_reset_date = v_next_reset,
      updated_at = pg_catalog.now()
  WHERE user_id = p_user_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_snapfind_usage(uuid, text, integer, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_snapfind_usage(uuid, text, integer, bigint) TO authenticated, service_role;
