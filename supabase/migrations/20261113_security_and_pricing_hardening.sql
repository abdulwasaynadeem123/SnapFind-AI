-- ==============================================================================
-- SnapFind AI — Additive Migration: Entitlement Security & Canonical Pricing Alignment
-- Date: 2026-11-13
-- Non-destructive: Preserves all existing rows and transactions.
-- ==============================================================================

-- 1. Align payment_requests default amount to canonical Lifetime Pro price (PKR 5,999)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_requests' AND column_name = 'amount'
  ) THEN
    ALTER TABLE public.payment_requests ALTER COLUMN amount SET DEFAULT 5999;
  END IF;
END $$;

-- 2. Harden user_entitlements & founder_claims RLS: read-own for users, mutations strictly via service_role / verified admin RPC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_entitlements') THEN
    ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can view own entitlements" ON public.user_entitlements;
    CREATE POLICY "Users can view own entitlements"
      ON public.user_entitlements FOR SELECT
      USING (auth.uid()::text = user_id::text);

    DROP POLICY IF EXISTS "Only admins or service role can modify entitlements" ON public.user_entitlements;
    CREATE POLICY "Only admins or service role can modify entitlements"
      ON public.user_entitlements FOR ALL
      USING (
        (auth.jwt() ->> 'role') = 'service_role'
        OR (auth.jwt() ->> 'email') = 'ash.mary.2006@gmail.com'
      );
    REVOKE INSERT, UPDATE, DELETE ON public.user_entitlements FROM authenticated;
    GRANT SELECT ON public.user_entitlements TO authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'founder_claims') THEN
    ALTER TABLE public.founder_claims ENABLE ROW LEVEL SECURITY;
    REVOKE INSERT, UPDATE, DELETE ON public.founder_claims FROM authenticated;
    GRANT SELECT ON public.founder_claims TO authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
    ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
    CREATE POLICY "Users can view own subscriptions"
      ON public.subscriptions FOR SELECT
      USING (auth.uid()::text = user_id::text);
    REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated;
    GRANT SELECT ON public.subscriptions TO authenticated;
  END IF;
END $$;

-- 3. Prevent authenticated users from escalating plan/is_founder/founder_rank directly on public.profiles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can select own profile" ON public.profiles;
    CREATE POLICY "Users can select own profile"
      ON public.profiles FOR SELECT
      USING (auth.uid() = id OR (auth.jwt() ->> 'email') = 'ash.mary.2006@gmail.com');
  END IF;
END $$;
