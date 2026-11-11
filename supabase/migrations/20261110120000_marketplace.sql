-- Marketplace de profesionales (web pública multicuenta).
--
-- Cada profesional (entrenador, nutricionista, psicólogo, kinesiólogo) carga su perfil público y
-- sus planes desde su cuenta. El admin aprueba. La web pública (/profesionales, /p/:slug) solo
-- muestra lo aprobado y activo. El cliente arma un equipo con planes de distintos profesionales y
-- envía una solicitud: se crea una fila por profesional, que cada uno ve en su panel.
--
-- Nombres con prefijo `marketplace_` porque `public.plans` ya existe (planes internos).

-- ───────────────────────── Profesionales ─────────────────────────

CREATE TABLE IF NOT EXISTS public.marketplace_professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  nombre text NOT NULL,
  rol text NOT NULL,
  deportes text[] NOT NULL DEFAULT '{}'::text[],
  especialidades text[] NOT NULL DEFAULT '{}'::text[],
  foto_url text,
  bio text NOT NULL DEFAULT '',
  ubicacion text NOT NULL DEFAULT '',
  modalidad text[] NOT NULL DEFAULT '{}'::text[],
  whatsapp text NOT NULL DEFAULT '',
  verificado boolean NOT NULL DEFAULT false,
  destacado boolean NOT NULL DEFAULT false,
  -- borrador: lo está armando · pendiente: pidió publicarse · aprobado: visible · oculto: lo bajó el admin
  estado text NOT NULL DEFAULT 'borrador',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT mkt_prof_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 3 AND 60),
  CONSTRAINT mkt_prof_nombre_len CHECK (char_length(btrim(nombre)) BETWEEN 2 AND 80),
  CONSTRAINT mkt_prof_rol CHECK (rol IN ('entrenador', 'nutricionista', 'psicologo', 'kinesiologo')),
  CONSTRAINT mkt_prof_estado CHECK (estado IN ('borrador', 'pendiente', 'aprobado', 'oculto')),
  CONSTRAINT mkt_prof_modalidad CHECK (modalidad <@ ARRAY['online', 'presencial']::text[]),
  CONSTRAINT mkt_prof_deportes_count CHECK (cardinality(deportes) <= 12),
  CONSTRAINT mkt_prof_deportes_len CHECK (public.text_array_items_max_len(deportes, 40)),
  CONSTRAINT mkt_prof_especialidades_count CHECK (cardinality(especialidades) <= 8),
  CONSTRAINT mkt_prof_especialidades_len CHECK (public.text_array_items_max_len(especialidades, 40)),
  CONSTRAINT mkt_prof_bio_len CHECK (char_length(bio) <= 1200),
  CONSTRAINT mkt_prof_ubicacion_len CHECK (char_length(ubicacion) <= 80),
  CONSTRAINT mkt_prof_whatsapp_len CHECK (char_length(whatsapp) <= 30),
  CONSTRAINT mkt_prof_foto_len CHECK (foto_url IS NULL OR char_length(foto_url) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_mkt_prof_estado ON public.marketplace_professionals(estado);
CREATE INDEX IF NOT EXISTS idx_mkt_prof_deportes ON public.marketplace_professionals USING gin (deportes);

DROP TRIGGER IF EXISTS set_updated_at ON public.marketplace_professionals;
SELECT public.set_updated_at('marketplace_professionals');

-- Un profesional no puede aprobarse, verificarse ni destacarse solo: eso lo decide el admin.
CREATE OR REPLACE FUNCTION public.guard_marketplace_professional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Sin sesión de usuario (SQL Editor, service role) o admin: sin restricciones.
  IF auth.uid() IS NULL OR public.is_app_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.user_id := auth.uid();
    NEW.verificado := false;
    NEW.destacado := false;
    IF NEW.estado NOT IN ('borrador', 'pendiente') THEN
      NEW.estado := 'borrador';
    END IF;
    RETURN NEW;
  END IF;

  NEW.user_id := OLD.user_id;
  NEW.verificado := OLD.verificado;
  NEW.destacado := OLD.destacado;
  IF OLD.estado IN ('aprobado', 'oculto') THEN
    -- Ya lo resolvió el admin: el profesional edita sus datos pero no cambia el estado.
    NEW.estado := OLD.estado;
  ELSIF NEW.estado NOT IN ('borrador', 'pendiente') THEN
    NEW.estado := OLD.estado;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_marketplace_professional ON public.marketplace_professionals;
CREATE TRIGGER trg_guard_marketplace_professional
  BEFORE INSERT OR UPDATE ON public.marketplace_professionals
  FOR EACH ROW EXECUTE FUNCTION public.guard_marketplace_professional();

ALTER TABLE public.marketplace_professionals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mkt_prof_public_read ON public.marketplace_professionals;
CREATE POLICY mkt_prof_public_read ON public.marketplace_professionals
  FOR SELECT TO anon, authenticated
  USING (estado = 'aprobado');

DROP POLICY IF EXISTS mkt_prof_own_read ON public.marketplace_professionals;
CREATE POLICY mkt_prof_own_read ON public.marketplace_professionals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin());

DROP POLICY IF EXISTS mkt_prof_own_insert ON public.marketplace_professionals;
CREATE POLICY mkt_prof_own_insert ON public.marketplace_professionals
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.has_any_role(ARRAY['admin', 'trainer', 'nutritionist', 'psychologist']::public.app_role[])
  );

DROP POLICY IF EXISTS mkt_prof_own_update ON public.marketplace_professionals;
CREATE POLICY mkt_prof_own_update ON public.marketplace_professionals
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_app_admin());

DROP POLICY IF EXISTS mkt_prof_admin_delete ON public.marketplace_professionals;
CREATE POLICY mkt_prof_admin_delete ON public.marketplace_professionals
  FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- ───────────────────────── Planes ─────────────────────────

CREATE TABLE IF NOT EXISTS public.marketplace_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.marketplace_professionals(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descripcion text NOT NULL DEFAULT '',
  precio integer NOT NULL,
  duracion text NOT NULL DEFAULT 'mensual',
  modalidad text,
  incluye text[] NOT NULL DEFAULT '{}'::text[],
  cupos integer,
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT mkt_plan_titulo_len CHECK (char_length(btrim(titulo)) BETWEEN 3 AND 80),
  CONSTRAINT mkt_plan_descripcion_len CHECK (char_length(descripcion) <= 600),
  CONSTRAINT mkt_plan_precio CHECK (precio BETWEEN 0 AND 100000000),
  CONSTRAINT mkt_plan_duracion CHECK (duracion IN ('mensual', 'x3', 'x6', 'anual')),
  CONSTRAINT mkt_plan_modalidad CHECK (modalidad IS NULL OR modalidad IN ('online', 'presencial')),
  CONSTRAINT mkt_plan_incluye_count CHECK (cardinality(incluye) <= 16),
  CONSTRAINT mkt_plan_incluye_len CHECK (public.text_array_items_max_len(incluye, 180)),
  CONSTRAINT mkt_plan_cupos CHECK (cupos IS NULL OR cupos BETWEEN 0 AND 10000)
);

CREATE INDEX IF NOT EXISTS idx_mkt_plan_prof ON public.marketplace_plans(professional_id, activo, orden);

DROP TRIGGER IF EXISTS set_updated_at ON public.marketplace_plans;
SELECT public.set_updated_at('marketplace_plans');

ALTER TABLE public.marketplace_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mkt_plan_public_read ON public.marketplace_plans;
CREATE POLICY mkt_plan_public_read ON public.marketplace_plans
  FOR SELECT TO anon, authenticated
  USING (
    activo = true
    AND EXISTS (
      SELECT 1 FROM public.marketplace_professionals p
      WHERE p.id = marketplace_plans.professional_id AND p.estado = 'aprobado'
    )
  );

DROP POLICY IF EXISTS mkt_plan_own_all ON public.marketplace_plans;
CREATE POLICY mkt_plan_own_all ON public.marketplace_plans
  FOR ALL TO authenticated
  USING (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.marketplace_professionals p
      WHERE p.id = marketplace_plans.professional_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.marketplace_professionals p
      WHERE p.id = marketplace_plans.professional_id AND p.user_id = auth.uid()
    )
  );

-- ───────────────────────── Directorio (lo que lista la web) ─────────────────────────
-- Una fila por profesional aprobado con al menos un plan activo, con su «Desde $X».
-- security_invoker: respeta las políticas de las tablas (anon solo ve aprobados y activos).

CREATE OR REPLACE VIEW public.marketplace_directory
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.slug,
  p.nombre,
  p.rol,
  p.deportes,
  p.especialidades,
  p.foto_url,
  p.ubicacion,
  p.modalidad,
  p.verificado,
  p.destacado,
  p.created_at,
  min(pl.precio) AS precio_desde,
  count(pl.id)::integer AS planes_activos,
  -- Texto para el buscador (nombre + deportes + especialidades).
  lower(p.nombre || ' ' || array_to_string(p.deportes, ' ') || ' ' || array_to_string(p.especialidades, ' ')) AS busqueda
FROM public.marketplace_professionals p
JOIN public.marketplace_plans pl ON pl.professional_id = p.id AND pl.activo = true
WHERE p.estado = 'aprobado'
GROUP BY p.id;

GRANT SELECT ON public.marketplace_directory TO anon, authenticated;

-- ───────────────────────── Solicitudes de clientes ─────────────────────────

CREATE TABLE IF NOT EXISTS public.marketplace_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Mismo valor para todas las filas de un mismo envío (un equipo = varios profesionales).
  group_id uuid NOT NULL,
  professional_id uuid NOT NULL REFERENCES public.marketplace_professionals(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.marketplace_plans(id) ON DELETE SET NULL,
  -- Copia del plan al momento de pedirlo: si después cambia el precio, la solicitud no cambia.
  plan_titulo text NOT NULL,
  plan_precio integer NOT NULL,
  plan_duracion text NOT NULL,
  cliente_nombre text NOT NULL,
  cliente_whatsapp text NOT NULL,
  cliente_email text NOT NULL DEFAULT '',
  deporte text NOT NULL DEFAULT '',
  objetivo text NOT NULL DEFAULT '',
  -- Con quién más armó el equipo (texto para mostrar: «Nutrición con Lucía Méndez»).
  equipo_resumen text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT 'nueva',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT mkt_req_estado CHECK (estado IN ('nueva', 'contactada', 'aceptada', 'descartada'))
);

CREATE INDEX IF NOT EXISTS idx_mkt_req_prof ON public.marketplace_requests(professional_id, estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_req_group ON public.marketplace_requests(group_id);

DROP TRIGGER IF EXISTS set_updated_at ON public.marketplace_requests;
SELECT public.set_updated_at('marketplace_requests');

ALTER TABLE public.marketplace_requests ENABLE ROW LEVEL SECURITY;

-- Sin política para anon: las solicitudes entran solo por `submit_marketplace_request`.
DROP POLICY IF EXISTS mkt_req_own_read ON public.marketplace_requests;
CREATE POLICY mkt_req_own_read ON public.marketplace_requests
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.marketplace_professionals p
      WHERE p.id = marketplace_requests.professional_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS mkt_req_own_update ON public.marketplace_requests;
CREATE POLICY mkt_req_own_update ON public.marketplace_requests
  FOR UPDATE TO authenticated
  USING (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.marketplace_professionals p
      WHERE p.id = marketplace_requests.professional_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.marketplace_professionals p
      WHERE p.id = marketplace_requests.professional_id AND p.user_id = auth.uid()
    )
  );

-- Envío del equipo desde la web pública. Devuelve el group_id.
CREATE OR REPLACE FUNCTION public.submit_marketplace_request(
  p_plan_ids uuid[],
  p_nombre text,
  p_whatsapp text,
  p_email text DEFAULT '',
  p_deporte text DEFAULT '',
  p_objetivo text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_group uuid := gen_random_uuid();
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_whatsapp text := btrim(coalesce(p_whatsapp, ''));
  v_email text := btrim(coalesce(p_email, ''));
  v_count integer;
  v_profs integer;
BEGIN
  IF char_length(v_nombre) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'Nombre inválido.' USING ERRCODE = '22023';
  END IF;
  IF char_length(regexp_replace(v_whatsapp, '\D', '', 'g')) NOT BETWEEN 8 AND 15 OR char_length(v_whatsapp) > 30 THEN
    RAISE EXCEPTION 'WhatsApp inválido.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_email) > 120 OR (v_email <> '' AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN
    RAISE EXCEPTION 'Email inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_plan_ids IS NULL OR cardinality(p_plan_ids) NOT BETWEEN 1 AND 8 THEN
    RAISE EXCEPTION 'Elegí entre 1 y 8 planes.' USING ERRCODE = '22023';
  END IF;

  -- Todos los planes tienen que estar activos y ser de profesionales aprobados, uno por profesional.
  SELECT count(*), count(DISTINCT pl.professional_id)
    INTO v_count, v_profs
  FROM public.marketplace_plans pl
  JOIN public.marketplace_professionals p ON p.id = pl.professional_id
  WHERE pl.id = ANY (p_plan_ids) AND pl.activo = true AND p.estado = 'aprobado';

  IF v_count <> (SELECT count(DISTINCT x) FROM unnest(p_plan_ids) AS x) THEN
    RAISE EXCEPTION 'Alguno de los planes ya no está disponible.' USING ERRCODE = '22023';
  END IF;
  IF v_profs <> v_count THEN
    RAISE EXCEPTION 'Solo se puede elegir un plan por profesional.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.marketplace_requests (
    group_id, professional_id, plan_id, plan_titulo, plan_precio, plan_duracion,
    cliente_nombre, cliente_whatsapp, cliente_email, deporte, objetivo, equipo_resumen
  )
  SELECT
    v_group, pl.professional_id, pl.id, pl.titulo, pl.precio, pl.duracion,
    v_nombre, v_whatsapp, v_email,
    left(btrim(coalesce(p_deporte, '')), 40),
    left(btrim(coalesce(p_objetivo, '')), 800),
    coalesce((
      SELECT string_agg(pl2.titulo || ' con ' || p2.nombre, ' · ' ORDER BY p2.nombre)
      FROM public.marketplace_plans pl2
      JOIN public.marketplace_professionals p2 ON p2.id = pl2.professional_id
      WHERE pl2.id = ANY (p_plan_ids) AND pl2.id <> pl.id
    ), '')
  FROM public.marketplace_plans pl
  WHERE pl.id = ANY (p_plan_ids);

  RETURN v_group;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_marketplace_request(uuid[], text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_marketplace_request(uuid[], text, text, text, text, text) TO anon, authenticated;

-- ───────────────────────── Postulaciones («Quiero sumarme») ─────────────────────────
-- Profesionales que todavía no tienen cuenta. El admin los ve y les crea el acceso.

CREATE TABLE IF NOT EXISTS public.marketplace_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  rol text NOT NULL,
  email text NOT NULL,
  whatsapp text NOT NULL,
  deportes text NOT NULL DEFAULT '',
  mensaje text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT 'nueva',
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT mkt_app_rol CHECK (rol IN ('entrenador', 'nutricionista', 'psicologo', 'kinesiologo')),
  CONSTRAINT mkt_app_estado CHECK (estado IN ('nueva', 'resuelta'))
);

ALTER TABLE public.marketplace_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mkt_app_admin_all ON public.marketplace_applications;
CREATE POLICY mkt_app_admin_all ON public.marketplace_applications
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

CREATE OR REPLACE FUNCTION public.submit_marketplace_application(
  p_nombre text,
  p_rol text,
  p_email text,
  p_whatsapp text,
  p_deportes text DEFAULT '',
  p_mensaje text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_whatsapp text := btrim(coalesce(p_whatsapp, ''));
BEGIN
  IF char_length(v_nombre) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'Nombre inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_rol NOT IN ('entrenador', 'nutricionista', 'psicologo', 'kinesiologo') THEN
    RAISE EXCEPTION 'Rol inválido.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_email) > 120 OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Email inválido.' USING ERRCODE = '22023';
  END IF;
  IF char_length(regexp_replace(v_whatsapp, '\D', '', 'g')) NOT BETWEEN 8 AND 15 OR char_length(v_whatsapp) > 30 THEN
    RAISE EXCEPTION 'WhatsApp inválido.' USING ERRCODE = '22023';
  END IF;
  -- Una postulación abierta por email: evita duplicados si tocan dos veces.
  IF EXISTS (SELECT 1 FROM public.marketplace_applications a WHERE a.email = v_email AND a.estado = 'nueva') THEN
    RAISE EXCEPTION 'Ya recibimos tu postulación.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.marketplace_applications (nombre, rol, email, whatsapp, deportes, mensaje)
  VALUES (
    v_nombre, p_rol, v_email, v_whatsapp,
    left(btrim(coalesce(p_deportes, '')), 200),
    left(btrim(coalesce(p_mensaje, '')), 800)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_marketplace_application(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_marketplace_application(text, text, text, text, text, text) TO anon, authenticated;
