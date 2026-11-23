-- Restore the cloud-sync tables expected by the current SnapFind client.
-- Private by default: screenshot rows are visible only to their owning authenticated user.
CREATE TABLE IF NOT EXISTS public.screenshots (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Screenshot',
  category text NOT NULL DEFAULT 'Other',
  image_url text NOT NULL DEFAULT '',
  image_uri text,
  ocr_snippet text,
  ocr_text text,
  full_ocr_text text,
  ai_description text,
  description text,
  summary text,
  key_entities jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  objects jsonb NOT NULL DEFAULT '[]'::jsonb,
  key_metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  file_name text,
  file_size_mb numeric(12,3) NOT NULL DEFAULT 0,
  file_size_kb numeric(16,2) NOT NULL DEFAULT 0,
  is_favorite boolean NOT NULL DEFAULT false,
  date_created timestamptz,
  date_modified timestamptz,
  indexed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  content_hash text,
  sha256_hash text,
  file_hash text,
  website_name text,
  website_domain text,
  detected_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  has_qr_code boolean NOT NULL DEFAULT false,
  qr_code_type text,
  qr_code_data text,
  qr_url text
);

ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "screenshots_select_own" ON public.screenshots;
CREATE POLICY "screenshots_select_own" ON public.screenshots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "screenshots_insert_own" ON public.screenshots;
CREATE POLICY "screenshots_insert_own" ON public.screenshots
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "screenshots_update_own" ON public.screenshots;
CREATE POLICY "screenshots_update_own" ON public.screenshots
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "screenshots_delete_own" ON public.screenshots;
CREATE POLICY "screenshots_delete_own" ON public.screenshots
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS screenshots_user_created_idx ON public.screenshots(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS screenshots_user_modified_idx ON public.screenshots(user_id, date_modified DESC);

CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'dark',
  cloud_sync boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_select_own" ON public.settings;
CREATE POLICY "settings_select_own" ON public.settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "settings_insert_own" ON public.settings;
CREATE POLICY "settings_insert_own" ON public.settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "settings_update_own" ON public.settings;
CREATE POLICY "settings_update_own" ON public.settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.search_history (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  result_count integer NOT NULL DEFAULT 0,
  category_filter text NOT NULL DEFAULT 'All'
);
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "search_history_select_own" ON public.search_history;
CREATE POLICY "search_history_select_own" ON public.search_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "search_history_insert_own" ON public.search_history;
CREATE POLICY "search_history_insert_own" ON public.search_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "search_history_update_own" ON public.search_history;
CREATE POLICY "search_history_update_own" ON public.search_history FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "search_history_delete_own" ON public.search_history;
CREATE POLICY "search_history_delete_own" ON public.search_history FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS search_history_user_timestamp_idx ON public.search_history(user_id, timestamp DESC);
