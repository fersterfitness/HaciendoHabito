-- Feedback nov19, tanda 6 (web / marketplace).
--  1) Precio «Por sesión» en los planes.
--  2) Formulario propio de cada profesional: sus preguntas (marketplace_forms) y, en cada solicitud, un link
--     único (form_token) para que el cliente lo complete. La fecha de pago es fija y obligatoria.
-- Se puede correr más de una vez.

-- 1) «Por sesión»
ALTER TABLE public.marketplace_plans DROP CONSTRAINT IF EXISTS mkt_plan_duracion;
ALTER TABLE public.marketplace_plans
  ADD CONSTRAINT mkt_plan_duracion CHECK (duracion IN ('mensual', 'x3', 'x6', 'anual', 'sesion'));

-- 2) Preguntas de cada profesional. Sin fila, la app usa unas preguntas de base.
CREATE TABLE IF NOT EXISTS public.marketplace_forms (
  professional_id uuid PRIMARY KEY REFERENCES public.marketplace_professionals(id) ON DELETE CASCADE,
  -- [{ id, texto, tipo: 'corta'|'larga'|'opciones'|'si_no', opciones: [], obligatoria }]
  preguntas jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mkt_form_preguntas_array CHECK (jsonb_typeof(preguntas) = 'array'),
  CONSTRAINT mkt_form_preguntas_size CHECK (jsonb_array_length(preguntas) <= 40 AND pg_column_size(preguntas) <= 60000)
);

DROP TRIGGER IF EXISTS set_updated_at ON public.marketplace_forms;
SELECT public.set_updated_at('marketplace_forms');

ALTER TABLE public.marketplace_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mkt_form_manage ON public.marketplace_forms;
CREATE POLICY mkt_form_manage ON public.marketplace_forms
  FOR ALL TO authenticated
  USING (public.manages_marketplace_professional(professional_id))
  WITH CHECK (public.manages_marketplace_professional(professional_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_forms TO authenticated;

-- Link del formulario en cada solicitud y lo que contestó el cliente.
ALTER TABLE public.marketplace_requests
  ADD COLUMN IF NOT EXISTS form_token text,
  ADD COLUMN IF NOT EXISTS form_respuestas jsonb,
  ADD COLUMN IF NOT EXISTS form_dia_pago text,
  ADD COLUMN IF NOT EXISTS form_enviado_at timestamptz;

UPDATE public.marketplace_requests
SET form_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE form_token IS NULL;

ALTER TABLE public.marketplace_requests
  ALTER COLUMN form_token SET DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  ALTER COLUMN form_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mkt_req_form_token ON public.marketplace_requests(form_token);

ALTER TABLE public.marketplace_requests DROP CONSTRAINT IF EXISTS mkt_req_form_dia_pago;
ALTER TABLE public.marketplace_requests
  ADD CONSTRAINT mkt_req_form_dia_pago CHECK (form_dia_pago IS NULL OR form_dia_pago = 'ultimo' OR form_dia_pago ~ '^([1-9]|1[0-9]|2[0-8])$');

-- Lo que ve el cliente al abrir el link: de quién es el formulario y qué preguntas tiene.
CREATE OR REPLACE FUNCTION public.get_marketplace_request_form(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'profesional_nombre', p.nombre,
    'profesional_rol', p.rol,
    'profesional_foto', p.foto_url,
    'plan_titulo', r.plan_titulo,
    'cliente_nombre', r.cliente_nombre,
    'preguntas', f.preguntas,
    'enviado_at', r.form_enviado_at
  )
  FROM public.marketplace_requests r
  JOIN public.marketplace_professionals p ON p.id = r.professional_id
  LEFT JOIN public.marketplace_forms f ON f.professional_id = r.professional_id
  WHERE r.form_token = p_token AND char_length(coalesce(p_token, '')) >= 32
$$;

-- Envío del formulario. Se puede volver a mandar (corrige lo anterior).
CREATE OR REPLACE FUNCTION public.submit_marketplace_request_form(p_token text, p_respuestas jsonb, p_dia_pago text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dia text := btrim(coalesce(p_dia_pago, ''));
BEGIN
  IF char_length(coalesce(p_token, '')) < 32 THEN
    RAISE EXCEPTION 'Link inválido.' USING ERRCODE = '22023';
  END IF;
  IF v_dia <> 'ultimo' AND v_dia !~ '^([1-9]|1[0-9]|2[0-8])$' THEN
    RAISE EXCEPTION 'Elegí qué día del mes vas a pagar.' USING ERRCODE = '22023';
  END IF;
  IF p_respuestas IS NULL OR jsonb_typeof(p_respuestas) <> 'array' OR jsonb_array_length(p_respuestas) > 40
     OR pg_column_size(p_respuestas) > 40000 THEN
    RAISE EXCEPTION 'Respuestas inválidas.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.marketplace_requests
  SET form_respuestas = p_respuestas, form_dia_pago = v_dia, form_enviado_at = now()
  WHERE form_token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link inválido.' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_marketplace_request_form(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_marketplace_request_form(text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_marketplace_request_form(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_marketplace_request_form(text, jsonb, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
