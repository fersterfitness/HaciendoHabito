-- Registro del alumno desde el link de la rutina (/rutina/:token) — feedback del entrenador, nov-2026.
--
-- 1) routine_exercise_feedback: por ejercicio, la nota del alumno (duda, molestia, aclaración) y qué tan
--    exigente le resultó (escala de Borg, 1 a 10).
-- 2) routine_day_logs: por día de la rutina, el chequeo de antes de entrenar (sueño, energía, estrés,
--    molestias, de 1 a 5, y una nota), y cómo cerró el día: terminado (con la fecha y el esfuerzo de la
--    sesión) o no entrenado (con el motivo).
-- 3) student_urgent_messages: consulta urgente que el alumno le deja al entrenador.
-- 4) Funciones que usa la página del alumno sin cuenta. Todas validan el token del link y solo dejan
--    escribir sobre las rutinas de ese alumno con ese entrenador.
--
-- No cambia ni borra nada de lo que ya existe (get_shared_routine queda igual: lo nuevo se lee con
-- get_shared_routine_extras). Se puede correr más de una vez.
-- Requiere 20261110130000_routine_shares.sql y 20261111150000_routine_exercise_logs.sql.
BEGIN;

-- ───────────── 1) Nota y esfuerzo por ejercicio ─────────────
CREATE TABLE IF NOT EXISTS public.routine_exercise_feedback (
  routine_exercise_id uuid PRIMARY KEY REFERENCES public.routine_exercises(id) ON DELETE CASCADE,
  routine_id uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 600),
  effort smallint CHECK (effort BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS routine_exercise_feedback_routine_idx ON public.routine_exercise_feedback (routine_id);
COMMENT ON TABLE public.routine_exercise_feedback IS
  'Lo que el alumno deja en cada ejercicio desde el link: nota libre y esfuerzo percibido (Borg 1-10).';

ALTER TABLE public.routine_exercise_feedback ENABLE ROW LEVEL SECURITY;
-- Lectura: quien puede ver la rutina (la subconsulta respeta el RLS de routines). Escritura: solo por función.
DROP POLICY IF EXISTS routine_exercise_feedback_read ON public.routine_exercise_feedback;
CREATE POLICY routine_exercise_feedback_read ON public.routine_exercise_feedback
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.routines r WHERE r.id = routine_exercise_feedback.routine_id));

-- ───────────── 2) Chequeo previo y cierre de cada día ─────────────
CREATE TABLE IF NOT EXISTS public.routine_day_logs (
  routine_day_id uuid PRIMARY KEY REFERENCES public.routine_days(id) ON DELETE CASCADE,
  routine_id uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  -- Chequeo de antes de entrenar (1 = muy mal / nada, 5 = muy bien / mucho; ver la app para cada escala).
  sleep smallint CHECK (sleep BETWEEN 1 AND 5),
  energy smallint CHECK (energy BETWEEN 1 AND 5),
  stress smallint CHECK (stress BETWEEN 1 AND 5),
  soreness smallint CHECK (soreness BETWEEN 1 AND 5),
  checkin_note text NOT NULL DEFAULT '' CHECK (char_length(checkin_note) <= 600),
  checkin_at timestamptz,
  -- Cierre del día.
  status text CHECK (status IN ('done', 'missed')),
  status_date date,
  missed_reason text NOT NULL DEFAULT '' CHECK (char_length(missed_reason) <= 400),
  effort smallint CHECK (effort BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS routine_day_logs_routine_idx ON public.routine_day_logs (routine_id);
COMMENT ON TABLE public.routine_day_logs IS
  'Por día de la rutina: chequeo previo del alumno y cierre (terminado con fecha y esfuerzo, o no entrenado con motivo).';

ALTER TABLE public.routine_day_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS routine_day_logs_read ON public.routine_day_logs;
CREATE POLICY routine_day_logs_read ON public.routine_day_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.routines r WHERE r.id = routine_day_logs.routine_id));

-- ───────────── 3) Consulta urgente ─────────────
CREATE TABLE IF NOT EXISTS public.student_urgent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 3 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS student_urgent_messages_owner_idx ON public.student_urgent_messages (owner_id, read_at, created_at DESC);
COMMENT ON TABLE public.student_urgent_messages IS
  'Consultas urgentes que el alumno manda desde su link. El entrenador las ve en el Inicio y las marca como vistas.';

ALTER TABLE public.student_urgent_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS student_urgent_messages_read ON public.student_urgent_messages;
CREATE POLICY student_urgent_messages_read ON public.student_urgent_messages
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());
-- El entrenador solo puede marcarlas como vistas (el texto lo escribe el alumno, por la función).
DROP POLICY IF EXISTS student_urgent_messages_mark_read ON public.student_urgent_messages;
CREATE POLICY student_urgent_messages_mark_read ON public.student_urgent_messages
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
REVOKE UPDATE ON public.student_urgent_messages FROM authenticated;
GRANT UPDATE (read_at) ON public.student_urgent_messages TO authenticated;

-- ───────────── 4) Funciones del link ─────────────

-- Rutina a la que pertenece un día, si es de ese alumno con ese entrenador (NULL si no).
CREATE OR REPLACE FUNCTION public.shared_day_routine(p_owner uuid, p_student uuid, p_day_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT b.routine_id
    FROM public.routine_days d
    JOIN public.routine_blocks b ON b.id = d.block_id
    JOIN public.routines r ON r.id = b.routine_id
   WHERE d.id = p_day_id AND r.owner_id = p_owner AND r.student_id = p_student
$$;
REVOKE ALL ON FUNCTION public.shared_day_routine(uuid, uuid, uuid) FROM PUBLIC;

-- Nota y esfuerzo de un ejercicio. Con nota vacía y esfuerzo NULL se borra lo anotado.
CREATE OR REPLACE FUNCTION public.save_shared_exercise_feedback(
  p_token text,
  p_exercise_id uuid,
  p_note text,
  p_effort integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_share public.routine_shares%ROWTYPE;
  v_routine_id uuid;
  v_note text := btrim(coalesce(p_note, ''));
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  SELECT * INTO v_share FROM public.routine_shares WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF char_length(v_note) > 600 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'note_too_long');
  END IF;
  IF p_effort IS NOT NULL AND (p_effort < 1 OR p_effort > 10) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_effort');
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

  IF v_note = '' AND p_effort IS NULL THEN
    DELETE FROM public.routine_exercise_feedback WHERE routine_exercise_id = p_exercise_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  INSERT INTO public.routine_exercise_feedback (routine_exercise_id, routine_id, student_id, note, effort)
  VALUES (p_exercise_id, v_routine_id, v_share.student_id, v_note, p_effort)
  ON CONFLICT (routine_exercise_id)
  DO UPDATE SET note = excluded.note, effort = excluded.effort, updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.save_shared_exercise_feedback(text, uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_shared_exercise_feedback(text, uuid, text, integer) TO anon, authenticated;

-- Chequeo de antes de entrenar.
CREATE OR REPLACE FUNCTION public.save_shared_day_checkin(
  p_token text,
  p_day_id uuid,
  p_sleep integer,
  p_energy integer,
  p_stress integer,
  p_soreness integer,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_share public.routine_shares%ROWTYPE;
  v_routine_id uuid;
  v_note text := btrim(coalesce(p_note, ''));
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  SELECT * INTO v_share FROM public.routine_shares WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF char_length(v_note) > 600 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'note_too_long');
  END IF;
  IF (p_sleep IS NOT NULL AND p_sleep NOT BETWEEN 1 AND 5)
     OR (p_energy IS NOT NULL AND p_energy NOT BETWEEN 1 AND 5)
     OR (p_stress IS NOT NULL AND p_stress NOT BETWEEN 1 AND 5)
     OR (p_soreness IS NOT NULL AND p_soreness NOT BETWEEN 1 AND 5) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_scale');
  END IF;

  v_routine_id := public.shared_day_routine(v_share.owner_id, v_share.student_id, p_day_id);
  IF v_routine_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  INSERT INTO public.routine_day_logs (routine_day_id, routine_id, student_id, sleep, energy, stress, soreness, checkin_note, checkin_at)
  VALUES (p_day_id, v_routine_id, v_share.student_id, p_sleep, p_energy, p_stress, p_soreness, v_note, now())
  ON CONFLICT (routine_day_id)
  DO UPDATE SET sleep = excluded.sleep, energy = excluded.energy, stress = excluded.stress, soreness = excluded.soreness,
                checkin_note = excluded.checkin_note, checkin_at = now(), updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.save_shared_day_checkin(text, uuid, integer, integer, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_shared_day_checkin(text, uuid, integer, integer, integer, integer, text) TO anon, authenticated;

-- Cierre del día: 'done' (terminado, con esfuerzo de la sesión), 'missed' (no entrenó, con motivo) o NULL (deshacer).
-- p_date es la fecha del alumno (su celular); si no viene, la del servidor.
CREATE OR REPLACE FUNCTION public.save_shared_day_status(
  p_token text,
  p_day_id uuid,
  p_status text,
  p_reason text,
  p_effort integer,
  p_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_share public.routine_shares%ROWTYPE;
  v_routine_id uuid;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_date date := coalesce(p_date, (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date);
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  SELECT * INTO v_share FROM public.routine_shares WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('done', 'missed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;
  IF char_length(v_reason) > 400 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reason_too_long');
  END IF;
  IF p_effort IS NOT NULL AND (p_effort < 1 OR p_effort > 10) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_effort');
  END IF;
  -- La fecha la manda el celular del alumno: se acepta solo cerca de hoy.
  IF v_date > (now() + interval '2 days')::date OR v_date < (now() - interval '60 days')::date THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_date');
  END IF;

  v_routine_id := public.shared_day_routine(v_share.owner_id, v_share.student_id, p_day_id);
  IF v_routine_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  INSERT INTO public.routine_day_logs (routine_day_id, routine_id, student_id, status, status_date, missed_reason, effort)
  VALUES (
    p_day_id, v_routine_id, v_share.student_id, p_status,
    CASE WHEN p_status IS NULL THEN NULL ELSE v_date END,
    CASE WHEN p_status = 'missed' THEN v_reason ELSE '' END,
    CASE WHEN p_status = 'done' THEN p_effort ELSE NULL END
  )
  ON CONFLICT (routine_day_id)
  DO UPDATE SET status = excluded.status, status_date = excluded.status_date, missed_reason = excluded.missed_reason,
                effort = excluded.effort, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'status_date', CASE WHEN p_status IS NULL THEN NULL ELSE v_date END);
END;
$$;
REVOKE ALL ON FUNCTION public.save_shared_day_status(text, uuid, text, text, integer, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_shared_day_status(text, uuid, text, text, integer, date) TO anon, authenticated;

-- Consulta urgente: hasta 5 por día por alumno (el link no pide cuenta).
CREATE OR REPLACE FUNCTION public.send_shared_urgent_message(p_token text, p_message text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_share public.routine_shares%ROWTYPE;
  v_message text := btrim(coalesce(p_message, ''));
  v_recent integer;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  SELECT * INTO v_share FROM public.routine_shares WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF char_length(v_message) NOT BETWEEN 3 AND 1000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_message');
  END IF;
  SELECT count(*) INTO v_recent
    FROM public.student_urgent_messages
   WHERE student_id = v_share.student_id AND owner_id = v_share.owner_id AND created_at > now() - interval '24 hours';
  IF v_recent >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_many');
  END IF;

  INSERT INTO public.student_urgent_messages (owner_id, student_id, message)
  VALUES (v_share.owner_id, v_share.student_id, v_message);
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.send_shared_urgent_message(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_shared_urgent_message(text, text) TO anon, authenticated;

-- Lo que el alumno ya dejó (para mostrárselo al volver a abrir el link).
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
      SELECT jsonb_agg(jsonb_build_object(
               'day_id', l.routine_day_id, 'sleep', l.sleep, 'energy', l.energy, 'stress', l.stress, 'soreness', l.soreness,
               'checkin_note', l.checkin_note, 'checkin_at', l.checkin_at,
               'status', l.status, 'status_date', l.status_date, 'missed_reason', l.missed_reason, 'effort', l.effort))
        FROM public.routine_day_logs l
        JOIN public.routines r ON r.id = l.routine_id
       WHERE r.owner_id = v_share.owner_id AND r.student_id = v_share.student_id
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_shared_routine_extras(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_routine_extras(text) TO anon, authenticated;

COMMIT;

-- Que la API vea las funciones nuevas sin esperar.
NOTIFY pgrst, 'reload schema';
