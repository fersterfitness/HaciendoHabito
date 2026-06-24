-- Imágenes del selector público (/form «solo vs conjunto») subidas desde el panel.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'web-intake-catalog',
  'web-intake-catalog',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.web_intake_catalog_storage_allowed(p_bucket_id text, p_object_name text)
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
    WHERE (b.name = 'web-intake-catalog' OR b.id::text = 'web-intake-catalog')
      AND trim(b.id::text) = trim(COALESCE(p_bucket_id, ''))
  ) THEN
    RETURN false;
  END IF;

  seg := split_part(trim(p_object_name), '/', 1);
  RETURN seg = auth.uid()::text;
END;
$$;

REVOKE ALL ON FUNCTION public.web_intake_catalog_storage_allowed(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.web_intake_catalog_storage_allowed(text, text) TO authenticated;

DROP POLICY IF EXISTS web_intake_catalog_public_read ON storage.objects;
CREATE POLICY web_intake_catalog_public_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id::text = 'web-intake-catalog');

DROP POLICY IF EXISTS web_intake_catalog_owner_insert ON storage.objects;
CREATE POLICY web_intake_catalog_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (public.web_intake_catalog_storage_allowed(bucket_id::text, name::text));

DROP POLICY IF EXISTS web_intake_catalog_owner_update ON storage.objects;
CREATE POLICY web_intake_catalog_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (public.web_intake_catalog_storage_allowed(bucket_id::text, name::text))
  WITH CHECK (public.web_intake_catalog_storage_allowed(bucket_id::text, name::text));

DROP POLICY IF EXISTS web_intake_catalog_owner_delete ON storage.objects;
CREATE POLICY web_intake_catalog_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (public.web_intake_catalog_storage_allowed(bucket_id::text, name::text));

COMMENT ON COLUMN public.web_intake_catalog_settings.with_cris_segment_image_url IS
  'URL HTTPS a imagen línea conjunta nutrición · Cristian Vázquez.';
