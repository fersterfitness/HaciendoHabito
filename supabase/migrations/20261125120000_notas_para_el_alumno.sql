-- Feedback nov19, tanda 4: «Nota para el alumno» por ejercicio.
-- La deja el entrenador al revisar lo que anotó el alumno (desde la rutina o desde «Ver como profe») y al
-- alumno le aparece en ese ejercicio cada vez que lo hace, hasta que la oculta. Si el entrenador la cambia,
-- vuelve a aparecer.
--
-- 1) Tabla coach_exercise_notes: una nota por alumno y por ejercicio (por nombre normalizado, igual que las
--    notas propias del alumno, así sigue en las semanas siguientes que repiten el ejercicio).
-- 2) dismiss_shared_coach_note: el alumno la oculta desde el link.
-- 3) get_shared_routine_extras devuelve además `coach_notes` (solo las que no ocultó).
--
-- No borra nada. Se puede correr más de una vez.
-- Requiere 20261124120000_peso_por_lado.sql.
BEGIN;

-- ───────────── 1) Tabla ─────────────
CREATE TABLE IF NOT EXISTS public.coach_exercise_notes (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  -- Nombre del ejercicio en minúsculas y con espacios simples (lo normaliza la app).
  exercise_key text NOT NULL CHECK (char_length(exercise_key) BETWEEN 1 AND 160),
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 600),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Cuándo la ocultó el alumno; vuelve a vacío cuando el entrenador la cambia.
  dismissed_at timestamptz,
  PRIMARY KEY (owner_id, student_id, exercise_key)
);

COMMENT ON TABLE public.coach_exercise_notes IS
  'Nota del entrenador para el alumno en un ejercicio; el alumno la ve en el link hasta que la oculta.';

ALTER TABLE public.coach_exercise_notes ENABLE ROW LEVEL SECURITY;

-- El entrenador maneja las suyas, solo de alumnos que puede ver.
DROP POLICY IF EXISTS coach_exercise_notes_owner_all ON public.coach_exercise_notes;
CREATE POLICY coach_exercise_notes_owner_all ON public.coach_exercise_notes
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = coach_exercise_notes.student_id));

-- Al cambiar el texto, la nota vuelve a mostrarse.
CREATE OR REPLACE FUNCTION public.coach_exercise_notes_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.note IS DISTINCT FROM OLD.note THEN
    NEW.updated_at := now();
    NEW.dismissed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coach_exercise_notes_touch ON public.coach_exercise_notes;
CREATE TRIGGER coach_exercise_notes_touch
  BEFORE INSERT OR UPDATE ON public.coach_exercise_notes
  FOR EACH ROW EXECUTE FUNCTION public.coach_exercise_notes_touch();

-- ───────────── 2) El alumno la oculta ─────────────
CREATE OR REPLACE FUNCTION public.dismiss_shared_coach_note(p_token text, p_exercise_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_share public.routine_shares%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  SELECT * INTO v_share FROM public.routine_shares WHERE token = p_token;
  IF NOT FOUND OR v_share.student_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  UPDATE public.coach_exercise_notes
     SET dismissed_at = now()
   WHERE owner_id = v_share.owner_id AND student_id = v_share.student_id
     AND exercise_key = btrim(coalesce(p_exercise_key, ''));

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.dismiss_shared_coach_note(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dismiss_shared_coach_note(text, text) TO anon, authenticated;

-- ───────────── 3) Extras del link con las notas del entrenador ─────────────
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
    ), '[]'::jsonb),
    'coach_notes', coalesce((
      SELECT jsonb_object_agg(c.exercise_key, jsonb_build_object('note', c.note, 'updated_at', c.updated_at))
        FROM public.coach_exercise_notes c
       WHERE c.owner_id = v_share.owner_id AND c.student_id = v_share.student_id
         AND c.dismissed_at IS NULL
    ), '{}'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_shared_routine_extras(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_routine_extras(text) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
