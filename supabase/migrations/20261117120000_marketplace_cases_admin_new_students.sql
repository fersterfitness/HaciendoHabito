-- Feedback del entrenador nov-2026, tanda 5:
--
-- 1) marketplace_cases: «casos de éxito» que cada profesional muestra en su perfil público
--    (una foto, un link a un video, o un mensaje/testimonio).
-- 2) admin_recent_students: para el administrador, los alumnos que ingresaron hace poco con OTROS
--    profesionales (nombre del alumno, fecha y con quién). No abre la tabla de alumnos: devuelve
--    solo esos tres datos y únicamente a un administrador.
--
-- No cambia ni borra nada de lo que ya existe. Se puede correr más de una vez.
-- Requiere 20261112120000_marketplace_managed_profiles.sql.
BEGIN;

-- ───────────── 1) Casos de éxito ─────────────
CREATE TABLE IF NOT EXISTS public.marketplace_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.marketplace_professionals(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'mensaje',
  titulo text NOT NULL DEFAULT '',
  texto text NOT NULL DEFAULT '',
  -- Foto (subida al mismo lugar que las fotos de perfil) o dirección del video.
  media_url text,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT mkt_case_tipo CHECK (tipo IN ('foto', 'video', 'mensaje')),
  CONSTRAINT mkt_case_titulo_len CHECK (char_length(titulo) <= 80),
  CONSTRAINT mkt_case_texto_len CHECK (char_length(texto) <= 800),
  CONSTRAINT mkt_case_media_len CHECK (media_url IS NULL OR char_length(media_url) <= 500),
  CONSTRAINT mkt_case_media_https CHECK (media_url IS NULL OR media_url ~ '^https://'),
  -- Una foto o un video necesitan su archivo o link; un mensaje, su texto.
  CONSTRAINT mkt_case_content CHECK (
    (tipo IN ('foto', 'video') AND media_url IS NOT NULL) OR (tipo = 'mensaje' AND char_length(btrim(texto)) >= 3)
  )
);
CREATE INDEX IF NOT EXISTS idx_mkt_case_prof ON public.marketplace_cases (professional_id, orden, created_at);
COMMENT ON TABLE public.marketplace_cases IS
  'Casos de éxito del perfil público de un profesional: foto, video (link) o mensaje.';

ALTER TABLE public.marketplace_cases ENABLE ROW LEVEL SECURITY;

-- Los ve cualquiera, pero solo los de profesionales aprobados (lo mismo que los planes).
DROP POLICY IF EXISTS mkt_case_public_read ON public.marketplace_cases;
CREATE POLICY mkt_case_public_read ON public.marketplace_cases
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_professionals p
      WHERE p.id = marketplace_cases.professional_id AND p.estado = 'aprobado'
    )
  );

-- Los carga quien maneja ese perfil (el profesional, quien lo dio de alta, o un administrador).
DROP POLICY IF EXISTS mkt_case_own_all ON public.marketplace_cases;
CREATE POLICY mkt_case_own_all ON public.marketplace_cases
  FOR ALL TO authenticated
  USING (public.manages_marketplace_professional(professional_id))
  WITH CHECK (public.manages_marketplace_professional(professional_id));

-- Hasta 24 casos por profesional.
CREATE OR REPLACE FUNCTION public.guard_marketplace_cases_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (SELECT count(*) FROM public.marketplace_cases c WHERE c.professional_id = NEW.professional_id) >= 24 THEN
    RAISE EXCEPTION 'mkt_case_limit' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_marketplace_cases_count ON public.marketplace_cases;
CREATE TRIGGER guard_marketplace_cases_count
  BEFORE INSERT ON public.marketplace_cases
  FOR EACH ROW EXECUTE FUNCTION public.guard_marketplace_cases_count();

-- ───────────── 2) Alumnos nuevos de otros profesionales (solo administrador) ─────────────
CREATE OR REPLACE FUNCTION public.admin_recent_students(p_days integer DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_days integer := least(greatest(coalesce(p_days, 14), 1), 60);
BEGIN
  IF NOT public.is_app_admin() THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', x.id, 'full_name', x.full_name, 'created_at', x.created_at,
             'owner_id', x.owner_id, 'owner_name', x.owner_name) ORDER BY x.created_at DESC)
      FROM (
        SELECT s.id, s.full_name, s.created_at, s.owner_id, coalesce(nullif(btrim(pr.full_name), ''), 'Otro profesional') AS owner_name
          FROM public.students s
          LEFT JOIN public.profiles pr ON pr.id = s.owner_id
         WHERE s.owner_id <> auth.uid()
           AND s.created_at >= now() - make_interval(days => v_days)
         ORDER BY s.created_at DESC
         LIMIT 50
      ) x
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_recent_students(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_recent_students(integer) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
