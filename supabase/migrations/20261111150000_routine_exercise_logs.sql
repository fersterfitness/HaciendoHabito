-- Registro de lo que hace el alumno desde el link de la rutina (/rutina/:token).
--
-- 1) Tabla routine_exercise_logs: kilos (y más adelante repeticiones) por serie de cada ejercicio. Cada
--    ejercicio de la rutina pertenece a una semana, así que lo anotado queda por semana.
-- 2) log_shared_exercise_set: la llama la página del alumno sin cuenta. Solo deja anotar ejercicios de las
--    rutinas de ese alumno con ese entrenador (lo valida contra el token del link).
-- 3) get_shared_routine devuelve también lo anotado (para que el alumno lo vea al volver) y el género del
--    alumno (el feedback semanal tiene preguntas solo para mujeres).
-- El entrenador lo lee directo de la tabla: lo ve quien puede ver la rutina.
-- Requiere 20261110130000_routine_shares.sql y 20261111140000_fix_shared_routine_exercises.sql.

CREATE TABLE IF NOT EXISTS public.routine_exercise_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_exercise_id uuid NOT NULL REFERENCES public.routine_exercises(id) ON DELETE CASCADE,
  routine_id uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  set_number smallint NOT NULL CHECK (set_number BETWEEN 1 AND 20),
  weight_kg numeric(6,2) CHECK (weight_kg >= 0 AND weight_kg <= 1000),
  reps smallint CHECK (reps >= 0 AND reps <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (routine_exercise_id, set_number)
);

CREATE INDEX IF NOT EXISTS routine_exercise_logs_routine_idx ON public.routine_exercise_logs (routine_id);

COMMENT ON TABLE public.routine_exercise_logs IS
  'Lo que anota el alumno desde el link de la rutina: kilos (y repeticiones) por serie.';

ALTER TABLE public.routine_exercise_logs ENABLE ROW LEVEL SECURITY;

-- Lectura: quien puede ver la rutina (la subconsulta respeta el RLS de routines).
DROP POLICY IF EXISTS routine_exercise_logs_read ON public.routine_exercise_logs;
CREATE POLICY routine_exercise_logs_read ON public.routine_exercise_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.routines r WHERE r.id = routine_exercise_logs.routine_id));

-- Escritura: solo por la función del link (no hay políticas de INSERT/UPDATE/DELETE).

CREATE OR REPLACE FUNCTION public.log_shared_exercise_set(
  p_token text,
  p_exercise_id uuid,
  p_set_number integer,
  p_weight_kg numeric,
  p_reps integer DEFAULT NULL
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
  IF p_reps IS NOT NULL AND (p_reps < 0 OR p_reps > 500) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_reps');
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

  IF p_weight_kg IS NULL AND p_reps IS NULL THEN
    DELETE FROM public.routine_exercise_logs
     WHERE routine_exercise_id = p_exercise_id AND set_number = p_set_number;
  ELSE
    INSERT INTO public.routine_exercise_logs (routine_exercise_id, routine_id, student_id, set_number, weight_kg, reps)
    VALUES (p_exercise_id, v_routine_id, v_share.student_id, p_set_number, round(p_weight_kg, 2), p_reps)
    ON CONFLICT (routine_exercise_id, set_number)
    DO UPDATE SET weight_kg = excluded.weight_kg, reps = excluded.reps, updated_at = now();
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.log_shared_exercise_set(text, uuid, integer, numeric, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_shared_exercise_set(text, uuid, integer, numeric, integer) TO anon, authenticated;

-- get_shared_routine con lo anotado por ejercicio y el género del alumno.
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
                                              'set', l.set_number, 'weight_kg', l.weight_kg, 'reps', l.reps
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
