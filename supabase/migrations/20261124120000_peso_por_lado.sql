-- Feedback nov19, tanda 3: el alumno indica si el peso que anotó es el total o lo que puso de cada lado.
--
-- 1) routine_exercise_logs.weight_mode: 'total' o 'lado' por serie (vacío en lo anotado antes = total).
-- 2) save_shared_exercise_set con p_weight_mode. Las versiones anteriores quedan, así nada se rompe
--    mientras se publica la app.
-- 3) get_shared_routine_extras devuelve además `set_modes` (solo las series anotadas por lado).
--
-- Lo que ve el alumno del plan («Total», «Por lado» o ambos, y el peso de la barra) no necesita SQL:
-- va con los datos del ejercicio.
-- No borra ni cambia datos. Se puede correr más de una vez.
-- Requiere 20261111180000_routine_set_reps.sql y 20261122120000_student_exercise_self_notes.sql.
BEGIN;

-- ───────────── 1) Columna ─────────────
ALTER TABLE public.routine_exercise_logs ADD COLUMN IF NOT EXISTS weight_mode text;
ALTER TABLE public.routine_exercise_logs DROP CONSTRAINT IF EXISTS routine_exercise_logs_weight_mode_check;
ALTER TABLE public.routine_exercise_logs
  ADD CONSTRAINT routine_exercise_logs_weight_mode_check CHECK (weight_mode IS NULL OR weight_mode IN ('total', 'lado'));
COMMENT ON COLUMN public.routine_exercise_logs.weight_mode IS
  'Cómo anotó el alumno los kilos: total o por lado. Vacío = total.';

-- ───────────── 2) Guardar la serie con el modo ─────────────
CREATE OR REPLACE FUNCTION public.save_shared_exercise_set(
  p_token text,
  p_exercise_id uuid,
  p_set_number integer,
  p_weight_kg numeric,
  p_completed boolean,
  p_reps integer,
  p_weight_mode text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_share public.routine_shares%ROWTYPE;
  v_routine_id uuid;
  v_mode text := CASE WHEN p_weight_kg IS NULL THEN NULL ELSE nullif(p_weight_mode, '') END;
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
  IF p_completed IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_completion');
  END IF;
  IF v_mode IS NOT NULL AND v_mode NOT IN ('total', 'lado') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_weight_mode');
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

  INSERT INTO public.routine_exercise_logs (routine_exercise_id, routine_id, student_id, set_number, weight_kg, reps, completed, weight_mode)
  VALUES (p_exercise_id, v_routine_id, v_share.student_id, p_set_number, round(p_weight_kg, 2), p_reps, p_completed, v_mode)
  ON CONFLICT (routine_exercise_id, set_number)
  DO UPDATE SET weight_kg = excluded.weight_kg, reps = excluded.reps, completed = excluded.completed,
                weight_mode = excluded.weight_mode, updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.save_shared_exercise_set(text, uuid, integer, numeric, boolean, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_shared_exercise_set(text, uuid, integer, numeric, boolean, integer, text) TO anon, authenticated;

-- ───────────── 3) Extras del link con el modo de cada serie ─────────────
CREATE OR REPLACE FUNCTION public.get_shared_routine_extras(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_share public.routine_shares%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_share FROM public.routine_shares WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'exercises', coalesce((
      SELECT jsonb_agg(jsonb_build_object('exercise_id', f.routine_exercise_id, 'note', f.note, 'effort', f.effort))
        FROM public.routine_exercise_feedback f
        JOIN public.routines r ON r.id = f.routine_id
       WHERE r.owner_id = v_share.owner_id AND r.student_id = v_share.student_id
    ), '[]'::jsonb),
    'days', coalesce((
      SELECT jsonb_agg(
               (to_jsonb(l) - 'routine_day_id' - 'routine_id' - 'student_id' - 'created_at' - 'updated_at')
               || jsonb_build_object('day_id', l.routine_day_id))
        FROM public.routine_day_logs l
        JOIN public.routines r ON r.id = l.routine_id
       WHERE r.owner_id = v_share.owner_id AND r.student_id = v_share.student_id
    ), '[]'::jsonb),
    'notices', coalesce((
      SELECT jsonb_agg(jsonb_build_object('block_id', m.routine_block_id, 'kind', m.kind, 'created_at', m.created_at))
        FROM public.student_urgent_messages m
       WHERE m.owner_id = v_share.owner_id AND m.student_id = v_share.student_id
         AND m.kind IN ('last_week', 'week_done', 'routine_done') AND m.routine_block_id IS NOT NULL
    ), '[]'::jsonb),
    'self_notes', coalesce((
      SELECT jsonb_object_agg(n.exercise_key, n.note)
        FROM public.student_exercise_notes n
       WHERE n.owner_id = v_share.owner_id AND n.student_id = v_share.student_id
    ), '{}'::jsonb),
    'set_modes', coalesce((
      SELECT jsonb_agg(jsonb_build_object('exercise_id', l.routine_exercise_id, 'set', l.set_number, 'mode', l.weight_mode))
        FROM public.routine_exercise_logs l
        JOIN public.routines r ON r.id = l.routine_id
       WHERE r.owner_id = v_share.owner_id AND r.student_id = v_share.student_id
         AND l.weight_mode IS NOT NULL
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_shared_routine_extras(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_routine_extras(text) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
