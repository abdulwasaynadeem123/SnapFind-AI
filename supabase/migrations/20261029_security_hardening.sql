-- ==============================================================================
-- SnapFind AI — Migration: Security Audit & Database Hardening
-- Date: 2026-10-29
-- ==============================================================================

-- 1. HARDEN SCREENSHOTS TABLE
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own screenshots" ON public.screenshots;
CREATE POLICY "Users can select own screenshots" 
    ON public.screenshots FOR SELECT 
    USING (auth.uid() = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert own screenshots" ON public.screenshots;
CREATE POLICY "Users can insert own screenshots" 
    ON public.screenshots FOR INSERT 
    WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own screenshots" ON public.screenshots;
CREATE POLICY "Users can update own screenshots" 
    ON public.screenshots FOR UPDATE 
    USING (auth.uid() = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete own screenshots" ON public.screenshots;
CREATE POLICY "Users can delete own screenshots" 
    ON public.screenshots FOR DELETE 
    USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- 2. HARDEN SEARCH HISTORY TABLE
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own search history" ON public.search_history;
CREATE POLICY "Users can select own search history" 
    ON public.search_history FOR SELECT 
    USING (auth.uid() = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert own search history" ON public.search_history;
CREATE POLICY "Users can insert own search history" 
    ON public.search_history FOR INSERT 
    WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete own search history" ON public.search_history;
CREATE POLICY "Users can delete own search history" 
    ON public.search_history FOR DELETE 
    USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- 3. HARDEN SETTINGS TABLE
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own settings" ON public.settings;
CREATE POLICY "Users can select own settings" 
    ON public.settings FOR SELECT 
    USING (auth.uid() = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own settings" ON public.settings;
CREATE POLICY "Users can update own settings" 
    ON public.settings FOR UPDATE 
    USING (auth.uid() = user_id AND user_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert own settings" ON public.settings;
CREATE POLICY "Users can insert own settings" 
    ON public.settings FOR INSERT 
    WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

-- 4. HARDEN NOTIFICATIONS TABLE (Ensure caller can only read/update/delete their own)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view and update own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own notifications"
    ON public.notifications FOR DELETE
    USING (auth.uid()::text = user_id);

-- 5. HARDEN PAYMENT REQUESTS (Prevent user self-approval)
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own pending payment requests" ON public.payment_requests;
CREATE POLICY "Users can insert own pending payment requests"
    ON public.payment_requests FOR INSERT
    WITH CHECK (
        auth.uid()::text = user_id
        AND status = 'pending'
    );

DROP POLICY IF EXISTS "Only admins can update payment requests" ON public.payment_requests;
CREATE POLICY "Only admins can update payment requests"
    ON public.payment_requests FOR UPDATE
    USING (
        (auth.jwt() ->> 'email') = 'ash.mary.2006@gmail.com'
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

-- 6. AUDIT COMPLIANCE & LEAST PRIVILEGE REVOCATIONS
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
-- Public profiles can be read by authenticated users
GRANT SELECT ON public.profiles TO authenticated;
