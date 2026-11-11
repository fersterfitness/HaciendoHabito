-- Explicit completion independent of optional weight, plus student gender for artwork.
-- Apply after 20261111150000_routine_exercise_logs.sql.
-- Existing logged rows remain completed. Unchecking keeps the recorded weight.
BEGIN;
ALTER TABLE public.routine_exercise_logs ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.routine_exercise_logs.completed IS 'Serie realizada, con o sin carga externa.';

CREATE OR REPLACE FUNCTION public.save_shared_exercise_set(
  p_token text,
  p_exercise_id uuid,
  p_set_number integer,
  p_weight_kg numeric,
  p_completed boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_share public.routine_shares%ROWTYPE;
  v_routine_id uuid;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  SELECT * INTO v_share FROM public.routine_shares WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  IF p_set_number IS NULL OR p_set_number < 1 OR p_set_number > 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_set');
  END IF;
  IF p_weight_kg IS NOT NULL AND (p_weight_kg < 0 OR p_weight_kg > 1000) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_weight');
  END IF;
  IF p_completed IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_completion');
  END IF;

  SELECT b.routine_id INTO v_routine_id
    FROM public.routine_exercises e
    JOIN public.routine_days d ON d.id = e.day_id
    JOIN public.routine_blocks b ON b.id = d.block_id
    JOIN public.routines r ON r.id = b.routine_id
   WHERE e.id = p_exercise_id
     AND r.owner_id = v_share.owner_id
     AND r.student_id = v_share.student_id;
  IF v_routine_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  INSERT INTO public.routine_exercise_logs (routine_exercise_id, routine_id, student_id, set_number, weight_kg, completed)
  VALUES (p_exercise_id, v_routine_id, v_share.student_id, p_set_number, round(p_weight_kg, 2), p_completed)
  ON CONFLICT (routine_exercise_id, set_number)
  DO UPDATE SET weight_kg = excluded.weight_kg, completed = excluded.completed, updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.save_shared_exercise_set(text, uuid, integer, numeric, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_shared_exercise_set(text, uuid, integer, numeric, boolean) TO anon, authenticated;


-- Expose the existing student gender independently of weekly feedback availability.
CREATE OR REPLACE FUNCTION public.get_shared_routine(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_share public.routine_shares%ROWTYPE;
  v_first_name text;
  v_email text;
  v_gender text;
  v_pro_name text;
  v_pro_phone text;
  v_routine public.routines%ROWTYPE;
  v_blocks jsonb;
  v_form_id uuid;
  v_form_token uuid;
  v_period date;
  v_done boolean := false;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_share FROM public.routine_shares WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT split_part(trim(s.full_name), ' ', 1), s.email, s.gender INTO v_first_name, v_email, v_gender
    FROM public.students s WHERE s.id = v_share.student_id;

  SELECT p.full_name, p.phone INTO v_pro_name, v_pro_phone
    FROM public.profiles p WHERE p.id = v_share.owner_id;

  -- Rutina vigente: la activa o por vencer más reciente; si no hay, la última que no esté completada.
  SELECT * INTO v_routine
    FROM public.routines r
   WHERE r.owner_id = v_share.owner_id AND r.student_id = v_share.student_id
   ORDER BY (r.status IN ('activa', 'por_vencer')) DESC, (r.status <> 'completada') DESC,
            r.start_date DESC NULLS LAST, r.created_at DESC
   LIMIT 1;

  IF FOUND THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'id', b.id,
             'name', b.name,
             'start_date', b.start_date,
             'end_date', b.end_date,
             'days', (
               SELECT coalesce(jsonb_agg(jsonb_build_object(
                        'id', d.id,
                        'day_name', d.day_name,
                        'muscle_focus', d.muscle_focus,
                        'warmup_notes', d.warmup_notes,
                        'exercises', (
                          SELECT coalesce(jsonb_agg(jsonb_build_object(
                                   'id', e.id,
                                   'name', x.name,
                                   'sets', e.sets,
                                   'reps_min', e.reps_min,
                                   'reps_max', e.reps_max,
                                   'reps_scheme', e.reps_scheme,
                                   'weight_kg', e.weight_kg,
                                   'rir', e.rir,
                                   'rpe', e.rpe,
                                   'rest_seconds', e.rest_seconds,
                                   'tempo', e.tempo,
                                   'percent_rm', e.percent_rm,
                                   'technical_notes', e.technical_notes,
                                   'is_superset', e.is_superset,
                                   'superset_group', e.superset_group,
                                   'video_url', coalesce(nullif(e.video_url, ''), x.video_url),
                                   'image_url', x.image_url,
                                   'logs', (
                                     SELECT coalesce(jsonb_agg(jsonb_build_object(
                                              'set', l.set_number, 'completed', l.completed, 'weight_kg', l.weight_kg, 'reps', l.reps
                                            ) ORDER BY l.set_number), '[]'::jsonb)
                                       FROM public.routine_exercise_logs l
                                      WHERE l.routine_exercise_id = e.id)
                                 ) ORDER BY e.sort_order), '[]'::jsonb)
                            FROM public.routine_exercises e
                            LEFT JOIN public.exercise_library x ON x.id = e.exercise_id
                           WHERE e.day_id = d.id)
                      ) ORDER BY d.sort_order), '[]'::jsonb)
                 FROM public.routine_days d
                WHERE d.block_id = b.id)
           ) ORDER BY b.sort_order), '[]'::jsonb)
      INTO v_blocks
      FROM public.routine_blocks b
     WHERE b.routine_id = v_routine.id;
  END IF;

  -- Feedback semanal: el formulario activo con la plantilla semanal del entrenador.
  SELECT f.id, f.public_token INTO v_form_id, v_form_token
    FROM public.check_in_forms f
   WHERE f.owner_id = v_share.owner_id
     AND f.is_active
     AND f.public_token IS NOT NULL
     AND EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(f.questions, '[]'::jsonb)) q WHERE q->>'key' = 'week_status')
   ORDER BY f.created_at DESC
   LIMIT 1;

  IF v_form_id IS NOT NULL THEN
    v_period := public.hh_check_in_period(v_form_id, '{}'::jsonb);
    SELECT EXISTS (
      SELECT 1
        FROM public.check_in_responses r
        JOIN public.check_in_invites i ON i.id = r.invite_id
       WHERE i.form_id = v_form_id AND i.student_id = v_share.student_id AND r.period_start = v_period
    ) INTO v_done;
  END IF;

  RETURN jsonb_build_object(
    'student_first_name', coalesce(v_first_name, ''),
    'student_gender', v_gender,
    'professional_name', v_pro_name,
    'professional_phone', v_pro_phone,
    'routine', CASE WHEN v_routine.id IS NULL THEN NULL ELSE jsonb_build_object(
      'name', v_routine.name,
      'objective', v_routine.objective,
      'start_date', v_routine.start_date,
      'end_date', v_routine.end_date,
      'updated_at', v_routine.updated_at,
      'blocks', coalesce(v_blocks, '[]'::jsonb)) END,
    'feedback', CASE WHEN v_form_token IS NULL THEN NULL ELSE jsonb_build_object(
      'public_token', v_form_token,
      'email', v_email,
      'gender', v_gender,
      'period', v_period,
      'done', v_done) END);
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_routine(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_routine(text) TO anon, authenticated;

COMMIT;
