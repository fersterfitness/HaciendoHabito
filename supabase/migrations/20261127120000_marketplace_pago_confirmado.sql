-- Feedback nov19 (Web 5): Tomás (administrador) confirma el pago de una solicitud y a los otros
-- profesionales del equipo les llega «Nuevo alumno confirmado» en sus notificaciones.
-- La confirmación vale para todo el envío (group_id): el cliente le paga a Tomás el equipo entero.
-- Se puede correr más de una vez.

ALTER TABLE public.marketplace_requests
  ADD COLUMN IF NOT EXISTS pago_confirmado_at timestamptz;

-- Solo el administrador puede confirmar o deshacer: el profesional puede editar su solicitud
-- (estado), pero este campo se le ignora.
CREATE OR REPLACE FUNCTION public.guard_marketplace_request_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.pago_confirmado_at IS DISTINCT FROM OLD.pago_confirmado_at AND NOT coalesce(public.is_app_admin(), false) THEN
    NEW.pago_confirmado_at := OLD.pago_confirmado_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_marketplace_request_payment ON public.marketplace_requests;
CREATE TRIGGER guard_marketplace_request_payment
  BEFORE UPDATE ON public.marketplace_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_marketplace_request_payment();

-- Confirma (o deshace) el pago de todo el envío. Al confirmar, las solicitudes abiertas pasan a
-- «aceptada» y cada profesional con cuenta propia (que no sea quien confirma) recibe una notificación.
-- Devuelve a cuántos profesionales se avisó.
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
    UPDATE public.marketplace_requests SET pago_confirmado_at = NULL WHERE group_id = v_group;
    RETURN 0;
  END IF;

  SELECT coalesce(nullif(split_part(btrim(full_name), ' ', 1), ''), 'El administrador')
    INTO v_admin FROM public.profiles WHERE id = auth.uid();
  v_admin := coalesce(v_admin, 'El administrador');

  FOR r IN
    UPDATE public.marketplace_requests q
       SET pago_confirmado_at = now(),
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

NOTIFY pgrst, 'reload schema';
