-- El envío público no debe fallar por la notificación al entrenador
-- (RLS / "No autorizado para notificar a otro usuario" si hay JWT de otro usuario).

CREATE OR REPLACE FUNCTION public.apply_check_in_response_side_effects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
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
  v_raw jsonb;
  v_txt text;
  v_choice jsonb;
  v_option text;
  v_extra text;
  v_finished boolean := false;
  v_cycle_date date;
  v_routine_id uuid;
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

  BEGIN
    IF v_cycle_date IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.menstrual_cycles mc
        WHERE mc.student_id = v_student_id
          AND mc.cycle_start_date = v_cycle_date
      ) THEN
        INSERT INTO public.menstrual_cycles (owner_id, student_id, cycle_start_date, cycle_length, notes)
        VALUES (v_owner_id, v_student_id, v_cycle_date, 28, 'Desde check-in semanal');
      END IF;
    END IF;

    IF v_finished THEN
      SELECT r.id INTO v_routine_id
      FROM public.routines r
      WHERE r.student_id = v_student_id
        AND r.owner_id = v_owner_id
        AND r.status IN ('activa', 'por_vencer')
      ORDER BY r.updated_at DESC
      LIMIT 1;

      IF v_routine_id IS NOT NULL THEN
        UPDATE public.routines
        SET status = 'completada', updated_at = now()
        WHERE id = v_routine_id;
      END IF;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, linked_table, linked_id)
    VALUES (
      v_owner_id,
      'form_recibido',
      left('Check-in · ' || coalesce(v_student_name, 'Alumno'), 200),
      left(
        CASE
          WHEN v_finished THEN 'Terminó el mes de rutina. La rutina quedó como completada. Enviá el feedback mensual y pedí la foto del registro de progreso.'
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
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'submit_check_in_response',
        'submit_check_in_shared_response',
        'get_check_in_form_by_token',
        'get_check_in_form_by_public_token',
        'lookup_check_in_student_preview',
        'lookup_check_in_invite_preview'
      )
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', r.sig);
  END LOOP;
END $$;
