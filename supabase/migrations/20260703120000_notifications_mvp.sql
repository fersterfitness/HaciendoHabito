-- MVP notificaciones: alta web + pago registrado.

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'pago_registrado';

CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_linked_table text DEFAULT NULL,
  p_linked_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id requerido';
  END IF;

  -- Service role (edge functions) o el propio usuario pueden crear la notificación.
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'No autorizado para notificar a otro usuario';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, linked_table, linked_id)
  VALUES (
    p_user_id,
    p_type,
    left(trim(p_title), 200),
    left(trim(p_body), 500),
    nullif(trim(coalesce(p_linked_table, '')), ''),
    p_linked_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_user(uuid, public.notification_type, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_user(uuid, public.notification_type, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_user(uuid, public.notification_type, text, text, text, uuid) TO service_role;

COMMENT ON FUNCTION public.notify_user IS
  'Inserta notificación in-app. Edge (service_role) o usuario autenticado (solo para sí mismo).';
