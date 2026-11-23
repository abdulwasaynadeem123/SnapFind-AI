-- SnapFind AI: ensure every Auth user has durable profile, entitlement and usage rows.
-- Safe to run repeatedly. Existing paid/founder entitlements are never overwritten.

CREATE OR REPLACE FUNCTION public.sync_snapfind_user_records()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_name text;
  v_avatar text;
BEGIN
  v_email := COALESCE(NEW.email, '');
  v_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'username', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'User'
  );
  v_avatar := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'picture', '')
  );

  INSERT INTO public.profiles (id, username, name, email, avatar_url, updated_at)
  VALUES (NEW.id, v_name, v_name, v_email, v_avatar, pg_catalog.now())
  ON CONFLICT (id) DO UPDATE
    SET username = COALESCE(NULLIF(EXCLUDED.username, ''), public.profiles.username),
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

DROP TRIGGER IF EXISTS on_auth_user_created_snapfind_records ON auth.users;
CREATE TRIGGER on_auth_user_created_snapfind_records
AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_snapfind_user_records();

-- Backfill any existing Auth users without overwriting their existing paid plans,
-- usage counters, or non-empty profile fields.
INSERT INTO public.profiles (id, username, name, email, avatar_url, updated_at)
SELECT
  u.id,
  COALESCE(NULLIF(u.raw_user_meta_data ->> 'username', ''),
           NULLIF(u.raw_user_meta_data ->> 'full_name', ''),
           NULLIF(u.raw_user_meta_data ->> 'name', ''),
           NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''),
           'User'),
  COALESCE(NULLIF(u.raw_user_meta_data ->> 'full_name', ''),
           NULLIF(u.raw_user_meta_data ->> 'name', ''),
           NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''),
           'User'),
  COALESCE(u.email, ''),
  COALESCE(NULLIF(u.raw_user_meta_data ->> 'avatar_url', ''),
           NULLIF(u.raw_user_meta_data ->> 'picture', '')),
  pg_catalog.now()
FROM auth.users u
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    username = COALESCE(NULLIF(public.profiles.username, ''), EXCLUDED.username),
    name = COALESCE(NULLIF(public.profiles.name, ''), EXCLUDED.name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = pg_catalog.now();

INSERT INTO public.user_entitlements (user_id, plan, tier, is_pro, is_founder, features, status, updated_at)
SELECT u.id, 'free', 'Free', false, false, '{}'::jsonb, 'active', pg_catalog.now()
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_usage (user_id)
SELECT u.id FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;
