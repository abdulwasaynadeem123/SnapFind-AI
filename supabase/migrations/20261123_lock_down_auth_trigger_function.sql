-- This function is trigger-only; clients must not be able to invoke it as an RPC.
REVOKE ALL ON FUNCTION public.sync_snapfind_user_records() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_snapfind_user_records() FROM anon;
REVOKE ALL ON FUNCTION public.sync_snapfind_user_records() FROM authenticated;
