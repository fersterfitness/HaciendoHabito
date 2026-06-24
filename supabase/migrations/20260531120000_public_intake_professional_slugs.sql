-- Formulario /form: slug público por profesional + listado seguro para anon.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_intake_slug text,
  ADD COLUMN IF NOT EXISTS intake_credential_line text;

COMMENT ON COLUMN public.profiles.public_intake_slug IS
  'Slug estable para /form (ej. tomas-ferster). Visible en list_public_intake_professionals.';
COMMENT ON COLUMN public.profiles.intake_credential_line IS
  'Línea corta de credenciales en /form (sin repetir el nombre; el nombre va en full_name).';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_public_intake_slug_key
  ON public.profiles (public_intake_slug)
  WHERE public_intake_slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.list_public_intake_professionals()
RETURNS TABLE (
  id uuid,
  public_intake_slug text,
  full_name text,
  role text,
  intake_credential_line text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.public_intake_slug,
    p.full_name,
    p.role::text,
    p.intake_credential_line,
    p.avatar_url
  FROM public.profiles p
  WHERE p.public_intake_slug IS NOT NULL
    AND p.role IN ('trainer', 'nutritionist', 'admin')
  ORDER BY p.full_name;
$$;

REVOKE ALL ON FUNCTION public.list_public_intake_professionals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_intake_professionals() TO anon, authenticated;

-- Slugs por defecto (ajustá si los UUID no coinciden en tu proyecto).
UPDATE public.profiles
SET
  public_intake_slug = 'tomas-ferster',
  intake_credential_line = COALESCE(
    NULLIF(trim(intake_credential_line), ''),
    'Lic. alto rendimiento (est.) · Prof. Educación física · Esp. deportiva'
  )
WHERE role IN ('trainer', 'admin')
  AND public_intake_slug IS NULL
  AND (
    lower(full_name) LIKE '%tomás%ferster%'
    OR lower(full_name) LIKE '%tomas%ferster%'
    OR lower(full_name) LIKE '%ferster%'
  );

UPDATE public.profiles
SET
  public_intake_slug = 'cris-crossetto',
  intake_credential_line = COALESCE(
    NULLIF(trim(intake_credential_line), ''),
    'Lic. en Nutrición · Especialización deportiva'
  )
WHERE role = 'nutritionist'
  AND public_intake_slug IS NULL
  AND (
    lower(full_name) LIKE '%cristian%crossetto%'
    OR lower(full_name) LIKE '%cris%crossetto%'
    OR lower(full_name) LIKE '%crossetto%'
  );
