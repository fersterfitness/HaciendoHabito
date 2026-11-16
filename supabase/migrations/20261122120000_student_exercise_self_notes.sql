-- Feedback nov3, punto 4: nota personal del alumno en cada ejercicio («Tomi me dijo que saque pecho»).
-- Es del alumno para sí mismo (distinta de la nota «para tu entrenador») y la ve cada vez que entra.
--
-- 1) Tabla student_exercise_notes: una nota por alumno y por ejercicio (por nombre normalizado, así
--    sigue apareciendo en las semanas y rutinas siguientes que repiten el ejercicio).
-- 2) save_shared_exercise_self_note: la guarda (o la borra si llega vacía) desde el link.
-- 3) get_shared_routine_extras devuelve además `self_notes`.
--
-- No borra nada. Se puede correr más de una vez.
-- Requiere 20261121120000_student_routine_notices.sql.
BEGIN;

-- ───────────── 1) Tabla ─────────────
CREATE TABLE IF NOT EXISTS public.student_exercise_notes (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  -- Nombre del ejercicio en minúsculas y con espacios simples (lo normaliza el link).
  exercise_key text NOT NULL CHECK (char_length(exercise_key) BETWEEN 1 AND 160),
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 400),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, student_id, exercise_key)
);

ALTER TABLE public.student_exercise_notes ENABLE ROW LEVEL SECURITY;
-- El alumno escribe solo por la RPC (con su token). El entrenador puede leerlas.
DROP POLICY IF EXISTS student_exercise_notes_owner_select ON public.student_exercise_notes;
CREATE POLICY student_exercise_notes_owner_select ON public.student_exercise_notes
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

-- ───────────── 2) Guardar desde el link ─────────────
CREATE OR REPLACE FUNCTION public.save_shared_exercise_self_note(p_token text, p_exercise_key text, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_share public.routine_shares%ROWTYPE;
  v_key text := btrim(coalesce(p_exercise_key, ''));
  v_note text := btrim(coalesce(p_note, ''));
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  SELECT * INTO v_share FROM public.routine_shares WHERE token = p_token;
  IF NOT FOUND OR v_share.student_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF char_length(v_key) NOT BETWEEN 1 AND 160 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_exercise');
  END IF;
  IF char_length(v_note) > 400 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'note_too_long');
  END IF;

  IF v_note = '' THEN
    DELETE FROM public.student_exercise_notes
     WHERE owner_id = v_share.owner_id AND student_id = v_share.student_id AND exercise_key = v_key;
    RETURN jsonb_build_object('ok', true);
  END IF;

  INSERT INTO public.student_exercise_notes (owner_id, student_id, exercise_key, note, updated_at)
  VALUES (v_share.owner_id, v_share.student_id, v_key, v_note, now())
  ON CONFLICT (owner_id, student_id, exercise_key) DO UPDATE SET note = EXCLUDED.note, updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.save_shared_exercise_self_note(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_shared_exercise_self_note(text, text, text) TO anon, authenticated;

-- ───────────── 3) Lo que el alumno ya dejó (+ avisos + notas propias) ─────────────
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
    ), '{}'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_shared_routine_extras(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_routine_extras(text) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
