-- Fotos de perfil de profesionales (profiles.avatar_url guarda la ruta: {auth.uid()}/avatar.ext)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.profile_avatar_storage_allowed(p_bucket_id text, p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  seg text;
BEGIN
  IF auth.uid() IS NULL OR p_object_name IS NULL OR length(trim(p_object_name)) = 0 THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets b
    WHERE (b.name = 'profile-avatars' OR b.id::text = 'profile-avatars')
      AND trim(b.id::text) = trim(COALESCE(p_bucket_id, ''))
  ) THEN
    RETURN false;
  END IF;

  seg := split_part(trim(p_object_name), '/', 1);

  RETURN seg = auth.uid()::text;
END;
$$;

REVOKE ALL ON FUNCTION public.profile_avatar_storage_allowed(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_avatar_storage_allowed(text, text) TO authenticated;

DROP POLICY IF EXISTS profile_avatars_public_read ON storage.objects;
CREATE POLICY profile_avatars_public_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id::text = 'profile-avatars');

DROP POLICY IF EXISTS profile_avatars_owner_insert ON storage.objects;
CREATE POLICY profile_avatars_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (public.profile_avatar_storage_allowed(bucket_id::text, name::text));

DROP POLICY IF EXISTS profile_avatars_owner_update ON storage.objects;
CREATE POLICY profile_avatars_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (public.profile_avatar_storage_allowed(bucket_id::text, name::text))
  WITH CHECK (public.profile_avatar_storage_allowed(bucket_id::text, name::text));

DROP POLICY IF EXISTS profile_avatars_owner_delete ON storage.objects;
CREATE POLICY profile_avatars_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (public.profile_avatar_storage_allowed(bucket_id::text, name::text));
