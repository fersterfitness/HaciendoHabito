-- Gustavo: teléfono de WhatsApp.
-- Abono al otro profesional (planes duales / integral).
-- Retomar inscripción web por mail si el alumno salió de la página.

UPDATE public.students
SET
  phone = '+54 11 49283043',
  updated_at = now()
WHERE full_name ILIKE '%gustavo%cabral%';

ALTER TABLE public.routines
  ADD COLUMN IF NOT EXISTS paid_other_professional boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.routines.paid_other_professional IS
  'Recordatorio: Tomás ya le pagó la mitad al otro profesional (nutrición / psicología).';

CREATE INDEX IF NOT EXISTS idx_web_intake_access_email_plan
  ON public.web_intake_access_requests (lower(trim(applicant_email)), selected_web_plan_slug)
  WHERE applicant_email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.resume_web_intake_access(p_email text, p_plan_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_slug text := trim(coalesce(p_plan_slug, ''));
  v_row public.web_intake_access_requests%ROWTYPE;
BEGIN
  IF v_email = '' OR v_email NOT LIKE '%@%' OR v_slug = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  SELECT *
  INTO v_row
  FROM public.web_intake_access_requests
  WHERE lower(trim(applicant_email)) = v_email
    AND selected_web_plan_slug = v_slug
    AND status IN ('approved', 'pending')
  ORDER BY CASE status WHEN 'approved' THEN 0 ELSE 1 END, created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'request_token', v_row.request_token,
    'status', v_row.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resume_web_intake_access(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resume_web_intake_access(text, text) TO anon, authenticated;

COMMENT ON FUNCTION public.resume_web_intake_access(text, text) IS
  'Retoma un permiso de /form por mail + plan (anon).';
