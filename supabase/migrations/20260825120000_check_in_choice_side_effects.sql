-- Check-in semanal: opciones (choice), ciclo menstrual, notificaciones al enviar.
-- Las respuestas choice se guardan como JSON string para seguir siendo compatibles
-- con submit_check_in_response (valida text/scale).

CREATE OR REPLACE FUNCTION public.lookup_check_in_student_preview(
  p_public_token uuid,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_email text;
  v_match_count int;
  v_gender text;
  v_name text;
BEGIN
  IF NOT public.check_in_rate_limit_allow(p_public_token, 'preview'::text, 30, 3600) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  SELECT f.owner_id INTO v_owner_id
  FROM public.check_in_forms f
  WHERE f.public_token = p_public_token AND f.is_active = true;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_inactive');
  END IF;

  v_email := lower(trim(both from coalesce(p_email, '')));
  IF length(v_email) < 3 OR position('@' in v_email) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_invalid');
  END IF;

  SELECT count(*)::int INTO v_match_count
  FROM public.students s
  WHERE s.owner_id = v_owner_id
    AND s.email IS NOT NULL
    AND lower(trim(both from s.email)) = v_email;

  IF v_match_count <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT s.gender::text, s.full_name
  INTO v_gender, v_name
  FROM public.students s
  WHERE s.owner_id = v_owner_id
    AND s.email IS NOT NULL
    AND lower(trim(both from s.email)) = v_email
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'gender', v_gender,
    'first_name', split_part(coalesce(v_name, ''), ' ', 1)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.lookup_check_in_invite_preview(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gender text;
  v_name text;
BEGIN
  IF NOT public.check_in_rate_limit_allow(p_token, 'preview_invite'::text, 20, 3600) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  SELECT s.gender::text, s.full_name
  INTO v_gender, v_name
  FROM public.check_in_invites i
  JOIN public.check_in_forms f ON f.id = i.form_id
  JOIN public.students s ON s.id = i.student_id
  WHERE i.token = p_token AND f.is_active = true;

  IF v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_inactive');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'gender', v_gender,
    'first_name', split_part(v_name, ' ', 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_check_in_student_preview(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_check_in_student_preview(uuid, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.lookup_check_in_invite_preview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_check_in_invite_preview(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_check_in_response_side_effects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_owner_id uuid;
  v_student_name text;
  v_gender text;
  v_questions jsonb;
  v_q jsonb;
  v_qid text;
  v_qkey text;
  v_visible text;
  v_raw jsonb;
  v_txt text;
  v_choice jsonb;
  v_option text;
  v_extra text;
  v_finished boolean := false;
  v_cycle_date date;
BEGIN
  SELECT i.student_id, f.owner_id, s.full_name, s.gender::text, f.questions
  INTO v_student_id, v_owner_id, v_student_name, v_gender, v_questions
  FROM public.check_in_invites i
  JOIN public.check_in_forms f ON f.id = i.form_id
  JOIN public.students s ON s.id = i.student_id
  WHERE i.id = NEW.invite_id;

  IF v_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_questions IS NOT NULL AND jsonb_typeof(v_questions) = 'array' THEN
    FOR v_q IN SELECT * FROM jsonb_array_elements(v_questions)
    LOOP
      v_qid := v_q->>'id';
      v_qkey := v_q->>'key';
      v_visible := v_q->>'visibleIfGender';
      IF v_qid IS NULL THEN
        CONTINUE;
      END IF;

      v_raw := NEW.responses -> v_qid;
      v_choice := NULL;
      v_option := NULL;
      v_extra := NULL;

      IF v_raw IS NULL OR v_raw = 'null'::jsonb THEN
        CONTINUE;
      END IF;

      IF jsonb_typeof(v_raw) = 'object' THEN
        v_choice := v_raw;
      ELSIF jsonb_typeof(v_raw) = 'string' THEN
        v_txt := v_raw #>> '{}';
        IF v_txt LIKE '{%' THEN
          BEGIN
            v_choice := v_txt::jsonb;
          EXCEPTION WHEN OTHERS THEN
            v_choice := NULL;
          END;
        END IF;
      END IF;

      IF v_choice IS NOT NULL THEN
        v_option := v_choice->>'option';
        v_extra := nullif(trim(both from coalesce(v_choice->>'extra', '')), '');
      END IF;

      IF v_qkey = 'week_status' AND v_option = 'finished' THEN
        v_finished := true;
      END IF;

      IF v_qkey = 'cycle'
         AND coalesce(v_gender, '') = 'F'
         AND v_option IS NOT NULL
         AND v_option <> '__skip'
         AND v_extra IS NOT NULL
         AND v_extra ~ '^\d{4}-\d{2}-\d{2}$'
      THEN
        BEGIN
          v_cycle_date := v_extra::date;
        EXCEPTION WHEN OTHERS THEN
          v_cycle_date := NULL;
        END;
      END IF;
    END LOOP;
  END IF;

  IF v_cycle_date IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.menstrual_cycles mc
      WHERE mc.student_id = v_student_id
        AND mc.cycle_start_date = v_cycle_date
    ) THEN
      INSERT INTO public.menstrual_cycles (owner_id, student_id, cycle_start_date, cycle_length, notes)
      VALUES (
        v_owner_id,
        v_student_id,
        v_cycle_date,
        28,
        'Desde check-in semanal'
      );
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, linked_table, linked_id)
  VALUES (
    v_owner_id,
    'form_recibido',
    left('Check-in · ' || coalesce(v_student_name, 'Alumno'), 200),
    left(
      CASE
        WHEN v_finished THEN 'Terminó el mes de rutina. Enviá el feedback mensual y pedí la foto del registro de progreso.'
        ELSE 'Nueva respuesta del formulario semanal.'
      END,
      500
    ),
    'students',
    v_student_id
  );

  IF v_finished THEN
    INSERT INTO public.notifications (user_id, type, title, body, linked_table, linked_id)
    VALUES (
      v_owner_id,
      'form_recibido',
      left('Feedback mensual · ' || coalesce(v_student_name, 'Alumno'), 200),
      'El alumno marcó «Terminé mi mes de rutina». Pedile el feedback mensual y la foto del registro de progreso.',
      'students',
      v_student_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_in_response_side_effects ON public.check_in_responses;
CREATE TRIGGER trg_check_in_response_side_effects
  AFTER INSERT ON public.check_in_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_check_in_response_side_effects();

COMMENT ON FUNCTION public.lookup_check_in_student_preview(uuid, text) IS
  'Preview público (link compartido): género y nombre para ocultar preguntas de ciclo.';
COMMENT ON FUNCTION public.lookup_check_in_invite_preview(uuid) IS
  'Preview público (link personal): género y nombre para ocultar preguntas de ciclo.';
COMMENT ON FUNCTION public.apply_check_in_response_side_effects() IS
  'Al enviar check-in: notifica al entrenador, registra ciclo menstrual y marca mes de rutina terminado.';
