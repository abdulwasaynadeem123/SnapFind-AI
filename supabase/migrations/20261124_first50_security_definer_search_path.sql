-- Harden SECURITY DEFINER functions used by the First-50 Lifetime Free flow.
-- All application tables and auth objects in these functions are schema-qualified;
-- an empty search_path prevents objects in writable schemas from shadowing names.

ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.get_vip_seat_stats() SET search_path = '';
ALTER FUNCTION public.get_my_vip_eligibility() SET search_path = '';
ALTER FUNCTION public.defer_vip_offer_for_user() SET search_path = '';
ALTER FUNCTION public.claim_founder_seat_atomic(TEXT, TEXT) SET search_path = '';
ALTER FUNCTION public.claim_vip_seat_for_user(TEXT) SET search_path = '';

-- Trigger-only: execute via auth.users trigger, not as a client-callable RPC.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;
