-- ==============================================================================
-- SnapFind AI — VIP Seat Uniqueness Hardening & Strict Screenshot RLS
-- Date: 2026-11-19
-- Safe & Additive: Preserves all existing VIP claims, seat numbers, and screenshots.
-- ==============================================================================

-- 1. Defense-in-depth unique index on claimed VIP seat ranks (1..50)
--    Guards against any two accounts ever holding the same active VIP seat rank.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'founder_claims'
  ) THEN
    -- Only create the unique index if no duplicate claimed ranks exist in legacy data
    IF NOT EXISTS (
      SELECT founder_rank
      FROM public.founder_claims
      WHERE status = 'claimed' AND founder_rank BETWEEN 1 AND 50
      GROUP BY founder_rank
      HAVING COUNT(*) > 1
    ) THEN
      CREATE UNIQUE INDEX IF NOT EXISTS idx_founder_claims_unique_claimed_rank
        ON public.founder_claims (founder_rank)
        WHERE status = 'claimed' AND founder_rank BETWEEN 1 AND 50;
    END IF;
  END IF;
END $$;

-- 2. Defense-in-depth unique index on active VIP seat numbers in user_entitlements
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_entitlements'
  ) THEN
    IF NOT EXISTS (
      SELECT founder_number
      FROM public.user_entitlements
      WHERE is_founder = TRUE AND founder_number BETWEEN 1 AND 50
      GROUP BY founder_number
      HAVING COUNT(*) > 1
    ) THEN
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_entitlements_unique_vip_number
        ON public.user_entitlements (founder_number)
        WHERE is_founder = TRUE AND founder_number BETWEEN 1 AND 50;
    END IF;
  END IF;
END $$;

-- 3. Strict per-user RLS ownership enforcement on public.screenshots
--    Ensures screenshots and extracted metadata remain strictly private to auth.uid().
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'screenshots'
  ) THEN
    ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can select own screenshots" ON public.screenshots;
    CREATE POLICY "Users can select own screenshots"
      ON public.screenshots FOR SELECT
      USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can insert own screenshots" ON public.screenshots;
    CREATE POLICY "Users can insert own screenshots"
      ON public.screenshots FOR INSERT
      WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can update own screenshots" ON public.screenshots;
    CREATE POLICY "Users can update own screenshots"
      ON public.screenshots FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can delete own screenshots" ON public.screenshots;
    CREATE POLICY "Users can delete own screenshots"
      ON public.screenshots FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;
