-- Preserve lifetime totals while enforcing monthly/yearly plan-specific periods.
ALTER TABLE public.user_usage
  ADD COLUMN IF NOT EXISTS lifetime_screenshots_indexed bigint NOT NULL DEFAULT 0;
ALTER TABLE public.user_usage
  ADD COLUMN IF NOT EXISTS usage_plan text NOT NULL DEFAULT 'free';

UPDATE public.user_usage
SET lifetime_screenshots_indexed = greatest(lifetime_screenshots_indexed, screenshots_indexed),
    usage_plan = coalesce(nullif(usage_plan, ''), 'free');

-- Keep display name and username independent; preserve manually selected usernames.
CREATE OR REPLACE FUNCTION public.sync_snapfind_user_records()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_name text;
  v_username text;
  v_avatar text;
BEGIN
  v_email := COALESCE(NEW.email, '');
  v_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'username', ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'User'
  );
  v_username := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'username', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'preferred_username', ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    v_name
  );
  v_username := lower(btrim(regexp_replace(v_username, '[^a-zA-Z0-9_]+', '_', 'g'), '_'));
  v_username := left(v_username, 24);
  IF length(v_username) < 3 THEN
    v_username := 'user_' || left(NEW.id::text, 8);
  END IF;
  v_avatar := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'picture', '')
  );

  INSERT INTO public.profiles (id, username, name, email, avatar_url, updated_at)
  VALUES (NEW.id, v_username, v_name, v_email, v_avatar, pg_catalog.now())
  ON CONFLICT (id) DO UPDATE
    SET username = CASE
          WHEN NEW.raw_user_meta_data ? 'username' OR NEW.raw_user_meta_data ? 'preferred_username'
            THEN EXCLUDED.username
          ELSE public.profiles.username
        END,
        name = COALESCE(NULLIF(EXCLUDED.name, ''), public.profiles.name),
        email = EXCLUDED.email,
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        updated_at = pg_catalog.now();

  INSERT INTO public.user_entitlements
    (user_id, plan, tier, is_pro, is_founder, features, status, updated_at)
  VALUES
    (NEW.id, 'free', 'Free', false, false, '{}'::jsonb, 'active', pg_catalog.now())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_usage (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Copy existing profile usernames into Auth metadata once, so the UI and DB stay in sync.
UPDATE auth.users u
SET raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) ||
  jsonb_build_object('username', p.username)
FROM public.profiles p
WHERE p.id = u.id
  AND p.username IS NOT NULL
  AND NOT (coalesce(u.raw_user_meta_data, '{}'::jsonb) ? 'username');

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
  v_plan_changed boolean;
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

  SELECT * INTO v_ent FROM public.user_entitlements WHERE user_id = p_user_id;
  IF FOUND THEN
    v_plan := lower(coalesce(v_ent.plan, 'free'));
    v_is_pro := coalesce(v_ent.is_pro, false);
    v_is_founder := coalesce(v_ent.is_founder, false);
    v_features := coalesce(v_ent.features, '{}'::jsonb);
    IF (v_ent.status NOT IN ('active', 'trialing', 'free'))
       OR (v_ent.expires_at IS NOT NULL AND v_ent.expires_at <= pg_catalog.now()) THEN
      v_plan := 'free'; v_is_pro := false; v_is_founder := false; v_features := '{}'::jsonb;
    ELSIF v_is_founder THEN
      v_plan := 'founder';
    ELSIF NOT v_is_pro THEN
      v_plan := 'free';
    ELSIF v_plan NOT IN ('monthly', 'yearly', 'lifetime', 'pro') THEN
      v_plan := 'pro';
    END IF;
  END IF;

  v_max_screenshots := coalesce(
    CASE WHEN (v_features->>'maxIndexedScreenshots') ~ '^[0-9]+$' THEN (v_features->>'maxIndexedScreenshots')::integer END,
    CASE WHEN v_plan = 'free' THEN 250 WHEN v_plan = 'monthly' THEN 2500
         WHEN v_plan = 'yearly' THEN 30000 WHEN v_plan = 'founder' THEN 150000 ELSE 100000 END
  );
  v_max_ai := coalesce(
    CASE WHEN (v_features->>'maxAIScansPerMonth') ~ '^[0-9]+$' THEN (v_features->>'maxAIScansPerMonth')::integer END,
    CASE WHEN v_plan = 'free' THEN 250 WHEN v_plan = 'monthly' THEN 2500
         WHEN v_plan = 'yearly' THEN 30000 WHEN v_plan = 'founder' THEN 150000 ELSE 100000 END
  );
  v_max_storage_mb := coalesce(
    CASE WHEN (v_features->>'maxStorageMB') ~ '^[0-9]+$' THEN (v_features->>'maxStorageMB')::integer END,
    CASE WHEN v_plan = 'free' THEN 1000 WHEN v_plan = 'monthly' THEN 5000
         WHEN v_plan = 'yearly' THEN 15000 WHEN v_plan = 'founder' THEN 100000 ELSE 50000 END
  );
  v_cloud_sync := coalesce(
    CASE WHEN v_features ? 'cloudSync' THEN (v_features->>'cloudSync')::boolean END,
    v_plan IN ('monthly', 'yearly', 'lifetime', 'pro', 'founder')
  );

  v_period_start := CASE WHEN v_plan = 'yearly'
    THEN pg_catalog.date_trunc('year', pg_catalog.now())::date
    ELSE pg_catalog.date_trunc('month', pg_catalog.now())::date END;
  v_next_reset := CASE WHEN v_plan = 'yearly'
    THEN (v_period_start + interval '1 year')::date
    ELSE (v_period_start + interval '1 month')::date END;

  INSERT INTO public.user_usage (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row FROM public.user_usage
  WHERE user_id = p_user_id FOR UPDATE;

  v_plan_changed := lower(coalesce(v_row.usage_plan, 'free')) <> v_plan;
  IF v_plan_changed OR v_row.period_start IS DISTINCT FROM v_period_start THEN
    UPDATE public.user_usage
    SET ai_analyses_used = 0,
        screenshots_indexed = CASE
          WHEN v_plan IN ('monthly', 'yearly') THEN 0
          ELSE lifetime_screenshots_indexed
        END,
        usage_plan = v_plan,
        period_start = v_period_start,
        monthly_reset_date = v_next_reset,
        updated_at = pg_catalog.now()
    WHERE user_id = p_user_id RETURNING * INTO v_row;
  ELSIF v_plan NOT IN ('monthly', 'yearly') THEN
    UPDATE public.user_usage
    SET screenshots_indexed = lifetime_screenshots_indexed,
        usage_plan = v_plan,
        monthly_reset_date = v_next_reset
    WHERE user_id = p_user_id RETURNING * INTO v_row;
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
      lifetime_screenshots_indexed = CASE
        WHEN p_action IN ('index_screenshot', 'analyze_screenshot') THEN lifetime_screenshots_indexed + v_count
        WHEN p_action = 'delete_screenshot' THEN greatest(0, lifetime_screenshots_indexed - v_count)
        ELSE lifetime_screenshots_indexed END,
      cloud_sync_count = CASE WHEN p_action = 'cloud_sync' THEN cloud_sync_count + v_count ELSE cloud_sync_count END,
      period_start = v_period_start,
      usage_plan = v_plan,
      monthly_reset_date = v_next_reset,
      updated_at = pg_catalog.now()
  WHERE user_id = p_user_id RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_snapfind_usage(uuid, text, integer, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_snapfind_usage(uuid, text, integer, bigint) TO authenticated, service_role;
