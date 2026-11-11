-- Repeticiones por serie desde el link de la rutina (/rutina/:token).
-- Correr después de 20261111170000_routine_set_completion.sql.
-- Agrega una versión de save_shared_exercise_set con p_reps. La versión anterior (sin reps) queda
-- para que nada se rompa mientras se publica la app. No borra ni cambia datos.
-- La columna routine_exercise_logs.reps ya existe (0 a 500) y get_shared_routine ya la devuelve.
BEGIN;

CREATE OR REPLACE FUNCTION public.save_shared_exercise_set(
  p_token text,
  p_exercise_id uuid,
  p_set_number integer,
  p_weight_kg numeric,
  p_completed boolean,
  p_reps integer
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

  INSERT INTO public.routine_exercise_logs (routine_exercise_id, routine_id, student_id, set_number, weight_kg, reps, completed)
  VALUES (p_exercise_id, v_routine_id, v_share.student_id, p_set_number, round(p_weight_kg, 2), p_reps, p_completed)
  ON CONFLICT (routine_exercise_id, set_number)
  DO UPDATE SET weight_kg = excluded.weight_kg, reps = excluded.reps, completed = excluded.completed, updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.save_shared_exercise_set(text, uuid, integer, numeric, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_shared_exercise_set(text, uuid, integer, numeric, boolean, integer) TO anon, authenticated;

COMMIT;

-- Que la API vea la función nueva sin esperar.
NOTIFY pgrst, 'reload schema';
