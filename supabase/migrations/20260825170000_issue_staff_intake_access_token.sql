-- Permite a staff autenticado emitir un token de /form ya aprobado
-- (para probar el envío en desarrollo sin esperar a Tomás).

CREATE OR REPLACE FUNCTION public.issue_staff_intake_access_token(
  p_plan_slug text,
  p_plan_title text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_token uuid;
  v_slug text;
  v_recent int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT p.role::text INTO v_role
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF v_role IS NULL OR v_role = 'student' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_staff');
  END IF;

  v_slug := left(trim(both from coalesce(p_plan_slug, '')), 200);
  IF length(v_slug) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'plan_required');
  END IF;

  SELECT count(*)::int INTO v_recent
  FROM public.web_intake_access_requests r
  WHERE r.owner_id = v_uid
    AND r.applicant_name = 'Desarrollo'
    AND r.created_at > now() - interval '1 hour';

  IF v_recent >= 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  INSERT INTO public.web_intake_access_requests (
    selected_web_plan_slug,
    selected_plan_title,
    applicant_name,
    status,
    owner_id,
    reviewed_by,
    reviewed_at
  ) VALUES (
    v_slug,
    nullif(left(trim(both from coalesce(p_plan_title, '')), 200), ''),
    'Desarrollo',
    'approved',
    v_uid,
    v_uid,
    now()
  )
  RETURNING request_token INTO v_token;

  RETURN jsonb_build_object('ok', true, 'request_token', v_token);
END;
$$;

REVOKE ALL ON FUNCTION public.issue_staff_intake_access_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_staff_intake_access_token(text, text) TO authenticated;

COMMENT ON FUNCTION public.issue_staff_intake_access_token(text, text) IS
  'Staff autenticado: crea una solicitud de acceso a /form ya aprobada (pruebas).';
