-- Protect per-user usage rows from direct cross-account reads and quota tampering.
-- Server-side quota writes must go through public.record_snapfind_usage(), which
-- verifies auth.uid() = p_user_id and enforces plan limits.

ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own usage" ON public.user_usage;
CREATE POLICY "Users can view own usage"
  ON public.user_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.user_usage FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_usage FROM authenticated;
GRANT SELECT ON TABLE public.user_usage TO authenticated;
GRANT ALL ON TABLE public.user_usage TO service_role;
