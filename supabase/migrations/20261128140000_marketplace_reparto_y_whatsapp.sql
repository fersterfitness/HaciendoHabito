-- Feedback nov24 (tanda 7, respuestas del 21/11):
--  R1) Ingresos por profesional: del precio del plan, por defecto 20 % para Tomás y 80 % para el profesional.
--      El porcentaje lo pone el administrador para cada profesional (puede variar). Al confirmar el pago se
--      guarda el porcentaje de ese momento en la solicitud, así cambiarlo después no toca lo ya cobrado.
--  R2) Al confirmar el pago, además de la notificación en la app, el administrador le manda WhatsApp a los
--      otros profesionales del equipo: esta función le da sus números.
-- Se puede correr más de una vez.

ALTER TABLE public.marketplace_professionals
  ADD COLUMN IF NOT EXISTS comision_pct numeric(5,2) NOT NULL DEFAULT 20;
DO $$
BEGIN
  ALTER TABLE public.marketplace_professionals
    ADD CONSTRAINT marketplace_professionals_comision_pct_range CHECK (comision_pct BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;
COMMENT ON COLUMN public.marketplace_professionals.comision_pct IS
  'Porcentaje del precio del plan que le queda al administrador (Tomás). El resto es del profesional.';

ALTER TABLE public.marketplace_requests
  ADD COLUMN IF NOT EXISTS comision_pct numeric(5,2);
COMMENT ON COLUMN public.marketplace_requests.comision_pct IS
  'Porcentaje del administrador al confirmar el pago (copia de marketplace_professionals.comision_pct).';

-- Solo el administrador pone el porcentaje de cada profesional.
CREATE OR REPLACE FUNCTION public.guard_marketplace_professional_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(public.is_app_admin(), false) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.comision_pct := 20;
  ELSIF NEW.comision_pct IS DISTINCT FROM OLD.comision_pct THEN
    NEW.comision_pct := OLD.comision_pct;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_marketplace_professional_commission ON public.marketplace_professionals;
CREATE TRIGGER guard_marketplace_professional_commission
  BEFORE INSERT OR UPDATE ON public.marketplace_professionals
  FOR EACH ROW EXECUTE FUNCTION public.guard_marketplace_professional_commission();

-- El pago y su porcentaje solo los cambia el administrador (igual que en 20261127120000, más comision_pct).
CREATE OR REPLACE FUNCTION public.guard_marketplace_request_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT coalesce(public.is_app_admin(), false) THEN
    IF NEW.pago_confirmado_at IS DISTINCT FROM OLD.pago_confirmado_at THEN
      NEW.pago_confirmado_at := OLD.pago_confirmado_at;
    END IF;
    IF NEW.comision_pct IS DISTINCT FROM OLD.comision_pct THEN
      NEW.comision_pct := OLD.comision_pct;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Igual que en 20261127120000; además guarda el porcentaje del momento (y lo borra al deshacer).
CREATE OR REPLACE FUNCTION public.confirm_marketplace_payment(p_request_id uuid, p_confirmado boolean DEFAULT true)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_group uuid;
  v_admin text;
  v_avisados integer := 0;
  r record;
BEGIN
  -- coalesce: sin sesión is_app_admin() da NULL y el IF no frenaría.
  IF auth.uid() IS NULL OR NOT coalesce(public.is_app_admin(), false) THEN
    RAISE EXCEPTION 'Solo el administrador puede confirmar pagos.' USING ERRCODE = '42501';
  END IF;

  SELECT group_id INTO v_group FROM public.marketplace_requests WHERE id = p_request_id;
  IF v_group IS NULL THEN
    RAISE EXCEPTION 'No existe la solicitud.' USING ERRCODE = '22023';
  END IF;

  IF NOT coalesce(p_confirmado, true) THEN
    UPDATE public.marketplace_requests SET pago_confirmado_at = NULL, comision_pct = NULL WHERE group_id = v_group;
    RETURN 0;
  END IF;

  SELECT coalesce(nullif(split_part(btrim(full_name), ' ', 1), ''), 'El administrador')
    INTO v_admin FROM public.profiles WHERE id = auth.uid();
  v_admin := coalesce(v_admin, 'El administrador');

  FOR r IN
    UPDATE public.marketplace_requests q
       SET pago_confirmado_at = now(),
           comision_pct = (SELECT p.comision_pct FROM public.marketplace_professionals p WHERE p.id = q.professional_id),
           estado = CASE WHEN q.estado IN ('nueva', 'contactada') THEN 'aceptada' ELSE q.estado END
     WHERE q.group_id = v_group
       AND q.pago_confirmado_at IS NULL
       AND q.estado <> 'descartada'
    RETURNING q.id, q.professional_id, q.cliente_nombre, q.plan_titulo
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, linked_table, linked_id)
    SELECT p.user_id,
           'sistema',
           'Nuevo alumno confirmado',
           left(v_admin || ' confirmó el pago de ' || r.cliente_nombre || ' (' || r.plan_titulo
                || '). Ya podés escribirle y empezar.', 500),
           'marketplace_requests',
           r.id
      FROM public.marketplace_professionals p
     WHERE p.id = r.professional_id
       AND p.user_id IS NOT NULL
       AND p.user_id IS DISTINCT FROM auth.uid();
    IF FOUND THEN
      v_avisados := v_avisados + 1;
    END IF;
  END LOOP;

  RETURN v_avisados;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_marketplace_payment(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_marketplace_payment(uuid, boolean) TO authenticated;

-- R2: a quién avisarle por WhatsApp del envío (los otros profesionales del equipo, sin el administrador).
CREATE OR REPLACE FUNCTION public.marketplace_payment_contacts(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_group uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.is_app_admin(), false) THEN
    RAISE EXCEPTION 'Solo el administrador.' USING ERRCODE = '42501';
  END IF;
  SELECT group_id INTO v_group FROM public.marketplace_requests WHERE id = p_request_id;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'professional_id', p.id, 'nombre', p.nombre, 'rol', p.rol, 'whatsapp', p.whatsapp,
             'cliente_nombre', q.cliente_nombre, 'plan_titulo', q.plan_titulo) ORDER BY p.nombre)
      FROM public.marketplace_requests q
      JOIN public.marketplace_professionals p ON p.id = q.professional_id
     WHERE q.group_id = v_group
       AND q.estado <> 'descartada'
       AND p.user_id IS DISTINCT FROM auth.uid()
       AND coalesce(btrim(p.whatsapp), '') <> ''
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_payment_contacts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_payment_contacts(uuid) TO authenticated;

-- R1: ingresos del mes por profesional (pagos confirmados ese mes, hora de Buenos Aires).
CREATE OR REPLACE FUNCTION public.marketplace_income_summary(p_month date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from date := date_trunc('month', coalesce(p_month, current_date))::date;
  v_to date := (date_trunc('month', coalesce(p_month, current_date)) + interval '1 month')::date;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.is_app_admin(), false) THEN
    RAISE EXCEPTION 'Solo el administrador.' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(to_jsonb(t) ORDER BY t.cobrado DESC, t.nombre)
      FROM (
        SELECT p.id AS professional_id, p.nombre, p.rol, p.comision_pct,
               count(q.id)::integer AS cantidad,
               coalesce(sum(q.plan_precio), 0) AS cobrado,
               coalesce(sum(q.plan_precio * coalesce(q.comision_pct, p.comision_pct) / 100), 0) AS para_admin
          FROM public.marketplace_professionals p
          LEFT JOIN public.marketplace_requests q
            ON q.professional_id = p.id
           AND q.pago_confirmado_at IS NOT NULL
           AND q.estado <> 'descartada'
           AND (q.pago_confirmado_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date >= v_from
           AND (q.pago_confirmado_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date < v_to
         GROUP BY p.id
      ) t
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.marketplace_income_summary(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_income_summary(date) TO authenticated;

-- R1: el administrador cambia el porcentaje de un profesional (vale para los pagos que confirme desde ahora).
CREATE OR REPLACE FUNCTION public.set_marketplace_commission(p_professional_id uuid, p_pct numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.is_app_admin(), false) THEN
    RAISE EXCEPTION 'Solo el administrador.' USING ERRCODE = '42501';
  END IF;
  IF p_pct IS NULL OR p_pct < 0 OR p_pct > 100 THEN
    RAISE EXCEPTION 'El porcentaje va de 0 a 100.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.marketplace_professionals SET comision_pct = round(p_pct, 2) WHERE id = p_professional_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_marketplace_commission(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_marketplace_commission(uuid, numeric) TO authenticated;

NOTIFY pgrst, 'reload schema';
