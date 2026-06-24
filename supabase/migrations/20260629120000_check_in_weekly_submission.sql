-- Check-in: una respuesta por invitación por semana calendaria (lun–dom, Argentina),
-- no una sola respuesta de por vida. Permite historial semanal con el mismo link compartido.

-- Quitar UNIQUE(invite_id) que impedía más de una fila por alumno/formulario.
ALTER TABLE public.check_in_responses
  DROP CONSTRAINT IF EXISTS check_in_responses_invite_id_key;

-- Evitar doble envío accidental en la misma semana (misma invitación).
CREATE UNIQUE INDEX IF NOT EXISTS check_in_responses_one_per_invite_per_week
  ON public.check_in_responses (
    invite_id,
    date_trunc('week', submitted_at AT TIME ZONE 'America/Argentina/Buenos_Aires')
  );

CREATE INDEX IF NOT EXISTS idx_check_in_responses_invite_submitted
  ON public.check_in_responses (invite_id, submitted_at DESC);

-- ─── submit_check_in_response (link personal por token) ─────────────────────
CREATE OR REPLACE FUNCTION public.submit_check_in_response(
  p_token uuid,
  p_answers jsonb,
  p_testimonial_consent boolean,
  p_responder_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite_id uuid;
  v_form_id uuid;
  v_questions jsonb;
  v_q jsonb;
  v_qid text;
  v_qtype text;
  v_val jsonb;
  v_clean jsonb := '{}'::jsonb;
  v_text text;
  v_num numeric;
  v_scale int;
  v_student_email text;
  v_email_norm text;
  v_week_local timestamp;
BEGIN
  IF NOT public.check_in_rate_limit_allow(p_token, 'submit'::text, 8, 3600) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  SELECT i.id, i.form_id, f.questions, s.email
  INTO v_invite_id, v_form_id, v_questions, v_student_email
  FROM public.check_in_invites i
  JOIN public.check_in_forms f ON f.id = i.form_id
  JOIN public.students s ON s.id = i.student_id
  WHERE i.token = p_token AND f.is_active = true;

  IF v_invite_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_inactive');
  END IF;

  v_week_local := date_trunc('week', now() AT TIME ZONE 'America/Argentina/Buenos_Aires');

  IF EXISTS (
    SELECT 1
    FROM public.check_in_responses r
    WHERE r.invite_id = v_invite_id
      AND date_trunc('week', r.submitted_at AT TIME ZONE 'America/Argentina/Buenos_Aires') = v_week_local
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_submitted');
  END IF;

  v_email_norm := lower(trim(both from coalesce(p_responder_email, '')));
  IF length(v_email_norm) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_required');
  END IF;
  IF length(v_email_norm) > 320 OR position('@' in v_email_norm) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_invalid');
  END IF;

  IF v_student_email IS NOT NULL AND length(trim(both from v_student_email)) > 0 THEN
    IF v_email_norm <> lower(trim(both from v_student_email)) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'email_mismatch');
    END IF;
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_answers');
  END IF;

  IF v_questions IS NULL OR jsonb_typeof(v_questions) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_form');
  END IF;

  FOR v_q IN SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_qid := v_q->>'id';
    v_qtype := coalesce(v_q->>'type', 'text');
    IF v_qid IS NULL OR length(v_qid) = 0 THEN
      CONTINUE;
    END IF;

    v_val := p_answers -> v_qid;

    IF v_qtype = 'scale' THEN
      IF v_val IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_answers');
      END IF;
      IF jsonb_typeof(v_val) = 'number' THEN
        v_num := (v_val)::text::numeric;
      ELSIF jsonb_typeof(v_val) = 'string' THEN
        BEGIN
          v_num := (v_val #>> '{}')::numeric;
        EXCEPTION WHEN OTHERS THEN
          RETURN jsonb_build_object('ok', false, 'error', 'invalid_answers');
        END;
      ELSE
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_answers');
      END IF;
      v_scale := round(v_num)::int;
      IF v_scale < 1 OR v_scale > 5 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_answers');
      END IF;
      v_clean := v_clean || jsonb_build_object(v_qid, v_scale);
    ELSE
      IF v_val IS NULL OR jsonb_typeof(v_val) <> 'string' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_answers');
      END IF;
      v_text := v_val #>> '{}';
      IF length(v_text) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_answers');
      END IF;
      IF length(v_text) > 4000 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'answer_too_long');
      END IF;
      v_clean := v_clean || jsonb_build_object(v_qid, v_text);
    END IF;
  END LOOP;

  INSERT INTO public.check_in_responses (
    invite_id,
    responses,
    testimonial_consent,
    responder_email,
    email_verified
  )
  VALUES (
    v_invite_id,
    v_clean,
    coalesce(p_testimonial_consent, false),
    v_email_norm,
    (
      v_student_email IS NOT NULL
      AND length(trim(both from v_student_email)) > 0
      AND v_email_norm = lower(trim(both from v_student_email))
    )
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─── submit_check_in_shared_response (link compartido por public_token) ───────
CREATE OR REPLACE FUNCTION public.submit_check_in_shared_response(
  p_public_token uuid,
  p_answers jsonb,
  p_testimonial_consent boolean,
  p_responder_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form_id uuid;
  v_owner_id uuid;
  v_student_id uuid;
  v_student_email text;
  v_invite_id uuid;
  v_questions jsonb;
  v_q jsonb;
  v_qid text;
  v_qtype text;
  v_val jsonb;
  v_clean jsonb := '{}'::jsonb;
  v_text text;
  v_num numeric;
  v_scale int;
  v_email_norm text;
  v_match_count int;
  v_week_local timestamp;
BEGIN
  IF NOT public.check_in_rate_limit_allow(p_public_token, 'submit_shared'::text, 30, 3600) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  SELECT f.id, f.owner_id, f.questions
  INTO v_form_id, v_owner_id, v_questions
  FROM public.check_in_forms f
  WHERE f.public_token = p_public_token AND f.is_active = true;

  IF v_form_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_inactive');
  END IF;

  v_email_norm := lower(trim(both from coalesce(p_responder_email, '')));
  IF length(v_email_norm) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_required');
  END IF;
  IF length(v_email_norm) > 320 OR position('@' in v_email_norm) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_invalid');
  END IF;

  SELECT count(*)::int INTO v_match_count
  FROM public.students s
  WHERE s.owner_id = v_owner_id
    AND s.email IS NOT NULL
    AND lower(trim(both from s.email)) = v_email_norm;

  IF v_match_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'student_not_found');
  END IF;

  IF v_match_count > 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_ambiguous');
  END IF;

  SELECT s.id, s.email
  INTO v_student_id, v_student_email
  FROM public.students s
  WHERE s.owner_id = v_owner_id
    AND s.email IS NOT NULL
    AND lower(trim(both from s.email)) = v_email_norm
  LIMIT 1;

  INSERT INTO public.check_in_invites (form_id, student_id)
  VALUES (v_form_id, v_student_id)
  ON CONFLICT (form_id, student_id) DO NOTHING;

  SELECT i.id INTO v_invite_id
  FROM public.check_in_invites i
  WHERE i.form_id = v_form_id AND i.student_id = v_student_id;

  IF v_invite_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_inactive');
  END IF;

  v_week_local := date_trunc('week', now() AT TIME ZONE 'America/Argentina/Buenos_Aires');

  IF EXISTS (
    SELECT 1
    FROM public.check_in_responses r
    WHERE r.invite_id = v_invite_id
      AND date_trunc('week', r.submitted_at AT TIME ZONE 'America/Argentina/Buenos_Aires') = v_week_local
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_submitted');
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_answers');
  END IF;

  IF v_questions IS NULL OR jsonb_typeof(v_questions) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_form');
  END IF;

  FOR v_q IN SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_qid := v_q->>'id';
    v_qtype := coalesce(v_q->>'type', 'text');
    IF v_qid IS NULL OR length(v_qid) = 0 THEN
      CONTINUE;
    END IF;

    v_val := p_answers -> v_qid;

    IF v_qtype = 'scale' THEN
      IF v_val IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_answers');
      END IF;
      IF jsonb_typeof(v_val) = 'number' THEN
        v_num := (v_val)::text::numeric;
      ELSIF jsonb_typeof(v_val) = 'string' THEN
        BEGIN
          v_num := (v_val #>> '{}')::numeric;
        EXCEPTION WHEN OTHERS THEN
          RETURN jsonb_build_object('ok', false, 'error', 'invalid_answers');
        END;
      ELSE
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_answers');
      END IF;
      v_scale := round(v_num)::int;
      IF v_scale < 1 OR v_scale > 5 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_answers');
      END IF;
      v_clean := v_clean || jsonb_build_object(v_qid, v_scale);
    ELSE
      IF v_val IS NULL OR jsonb_typeof(v_val) <> 'string' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_answers');
      END IF;
      v_text := v_val #>> '{}';
      IF length(v_text) = 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'invalid_answers');
      END IF;
      IF length(v_text) > 4000 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'answer_too_long');
      END IF;
      v_clean := v_clean || jsonb_build_object(v_qid, v_text);
    END IF;
  END LOOP;

  INSERT INTO public.check_in_responses (
    invite_id,
    responses,
    testimonial_consent,
    responder_email,
    email_verified
  )
  VALUES (
    v_invite_id,
    v_clean,
    coalesce(p_testimonial_consent, false),
    v_email_norm,
    (
      v_student_email IS NOT NULL
      AND length(trim(both from v_student_email)) > 0
      AND v_email_norm = lower(trim(both from v_student_email))
    )
  );

  RETURN jsonb_build_object('ok', true, 'student_name', (
    SELECT s.full_name FROM public.students s WHERE s.id = v_student_id
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.submit_check_in_response(uuid, jsonb, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_check_in_response(uuid, jsonb, boolean, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_check_in_shared_response(uuid, jsonb, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_check_in_shared_response(uuid, jsonb, boolean, text) TO anon, authenticated;

COMMENT ON FUNCTION public.submit_check_in_response(uuid, jsonb, boolean, text) IS
  'Envío de check-in por link personal. Una respuesta por semana calendaria (lun–dom, America/Argentina/Buenos_Aires).';

COMMENT ON FUNCTION public.submit_check_in_shared_response(uuid, jsonb, boolean, text) IS
  'Envío de check-in por link compartido. Una respuesta por semana calendaria (lun–dom, America/Argentina/Buenos_Aires).';
