-- Base table required by the persistent usage/quota RPCs.
-- Keep this migration before 20261123_usage_plan_period_integrity.sql.

CREATE TABLE IF NOT EXISTS public.user_usage (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_analyses_used INTEGER NOT NULL DEFAULT 0 CHECK (ai_analyses_used >= 0),
  screenshots_indexed INTEGER NOT NULL DEFAULT 0 CHECK (screenshots_indexed >= 0),
  lifetime_screenshots_indexed BIGINT NOT NULL DEFAULT 0 CHECK (lifetime_screenshots_indexed >= 0),
  storage_bytes_used BIGINT NOT NULL DEFAULT 0 CHECK (storage_bytes_used >= 0),
  cloud_sync_count BIGINT NOT NULL DEFAULT 0 CHECK (cloud_sync_count >= 0),
  usage_plan TEXT NOT NULL DEFAULT 'free',
  period_start DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  monthly_reset_date DATE NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month')::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Upgrade older manually-created usage tables safely.
ALTER TABLE public.user_usage
  ADD COLUMN IF NOT EXISTS ai_analyses_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS screenshots_indexed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_screenshots_indexed BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_bytes_used BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cloud_sync_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS period_start DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  ADD COLUMN IF NOT EXISTS monthly_reset_date DATE NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month')::date,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS user_usage_user_id_uidx
  ON public.user_usage(user_id);

COMMENT ON TABLE public.user_usage IS
  'Per-user persistent usage counters. Access is restricted by user_usage RLS policies.';
