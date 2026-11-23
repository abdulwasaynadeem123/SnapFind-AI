-- Server-only lookup for Storage objects owned by a user before Auth deletion.
-- The application must remove files through the Storage API, never SQL DELETE.
CREATE OR REPLACE FUNCTION public.list_user_storage_objects(p_user_id uuid)
RETURNS TABLE(bucket_id text, object_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT o.bucket_id, o.name
  FROM storage.objects AS o
  WHERE o.owner_id = p_user_id::text
     OR o.owner = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.list_user_storage_objects(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_user_storage_objects(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.list_user_storage_objects(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.list_user_storage_objects(uuid) TO service_role;
