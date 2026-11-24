-- Feedback nov24 (tanda 2): notas del entrenador para el alumno.
--  4) Varias notas por ejercicio, y el alumno marca «Lo vi» en cada una.
--  6) Cada nota es de una semana: va atada al ejercicio de esa semana (cada semana tiene sus propios ejercicios).
--  7) También notas generales de un circuito (día + grupo del circuito).
-- Las notas viejas por nombre de ejercicio (coach_exercise_notes) se siguen mostrando hasta que se borren.
-- Se puede correr más de una vez.

CREATE TABLE IF NOT EXISTS public.coach_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  -- Nota de un ejercicio (de una semana) ...
  routine_exercise_id uuid REFERENCES public.routine_exercises(id) ON DELETE CASCADE,
  -- ... o general de un circuito: el día y el número de grupo del circuito.
  day_id uuid REFERENCES public.routine_days(id) ON DELETE CASCADE,
  circuit_group integer,
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 600),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Cuándo el alumno marcó «Lo vi»; vuelve a vacío si el entrenador cambia el texto.
  seen_at timestamptz,
  CONSTRAINT coach_note_items_target CHECK (
    (routine_exercise_id IS NOT NULL AND day_id IS NULL AND circuit_group IS NULL)
    OR (routine_exercise_id IS NULL AND day_id IS NOT NULL AND circuit_group IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_coach_note_items_student ON public.coach_note_items(owner_id, student_id);

COMMENT ON TABLE public.coach_note_items IS
  'Notas del entrenador para el alumno, por ejercicio de una semana o por circuito; el alumno marca «Lo vi».';

ALTER TABLE public.coach_note_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_note_items_owner_all ON public.coach_note_items;
CREATE POLICY coach_note_items_owner_all ON public.coach_note_items
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = coach_note_items.student_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_note_items TO authenticated;

CREATE OR REPLACE FUNCTION public.coach_note_items_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.note IS DISTINCT FROM OLD.note THEN
    NEW.updated_at := now();
    NEW.seen_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coach_note_items_touch ON public.coach_note_items;
CREATE TRIGGER coach_note_items_touch
  BEFORE UPDATE ON public.coach_note_items
  FOR EACH ROW EXECUTE FUNCTION public.coach_note_items_touch();

-- El alumno marca (o desmarca) «Lo vi» desde su link.
CREATE OR REPLACE FUNCTION public.mark_shared_coach_note_seen(p_token text, p_note_id uuid, p_seen boolean DEFAULT true)
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

  UPDATE public.coach_note_items
     SET seen_at = CASE WHEN coalesce(p_seen, true) THEN now() ELSE NULL END
   WHERE id = p_note_id AND owner_id = v_share.owner_id AND student_id = v_share.student_id;

  RETURN jsonb_build_object('ok', FOUND);
END;
$$;
REVOKE ALL ON FUNCTION public.mark_shared_coach_note_seen(text, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_shared_coach_note_seen(text, uuid, boolean) TO anon, authenticated;

-- Extras del link: igual que en 20261125120000 más las notas nuevas.
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
    ), '{}'::jsonb),
    -- Feedback nov24: notas sueltas por ejercicio de una semana o por circuito, con «Lo vi».
    'coach_note_items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', n.id, 'exercise_id', n.routine_exercise_id, 'day_id', n.day_id, 'circuit_group', n.circuit_group,
               'note', n.note, 'created_at', n.created_at, 'seen_at', n.seen_at) ORDER BY n.created_at)
        FROM public.coach_note_items n
       WHERE n.owner_id = v_share.owner_id AND n.student_id = v_share.student_id
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_shared_routine_extras(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_routine_extras(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
