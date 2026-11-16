-- Chequeo diario nuevo y obligatorio del link del alumno (/rutina/:token) — feedback del entrenador, nov3.
--
-- 1) routine_day_logs suma las preguntas nuevas del chequeo de todos los días (horas de sueño, tipo de
--    dolor con el mapa muscular, hidratación, ganas de entrenar, recuperación, alimentación y qué la
--    complicó) y las de cierre de semana (pasos diarios promedio y ciclo menstrual).
-- 2) student_urgent_messages pasa a tener tipo: 'urgent' (consulta urgente, como hasta ahora) o 'pain'
--    (dolor no habitual marcado en el chequeo), con la rutina y el día a los que corresponde. Así el aviso
--    «X tiene un dolor puntual» le llega al entrenador por el mismo camino que las consultas urgentes.
-- 3) save_shared_daily_checkin: guarda el chequeo completo (reemplaza a save_shared_day_checkin, que queda
--    para links viejos abiertos) y, con dolor no habitual, deja el aviso para el entrenador (uno por día).
-- 4) get_shared_routine_extras devuelve todas las columnas del día (incluye las nuevas).
--
-- No borra nada. Se puede correr más de una vez.
-- Requiere 20261115120000_student_training_log.sql.
BEGIN;

-- ───────────── 1) Preguntas nuevas del chequeo ─────────────
ALTER TABLE public.routine_day_logs
  ADD COLUMN IF NOT EXISTS sleep_hours text CHECK (sleep_hours IN ('none', 'lt5', '6to7', 'gt8')),
  ADD COLUMN IF NOT EXISTS pain_kind text CHECK (pain_kind IN ('none', 'normal', 'unusual')),
  ADD COLUMN IF NOT EXISTS pain_areas text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pain_note text NOT NULL DEFAULT '' CHECK (char_length(pain_note) <= 600),
  ADD COLUMN IF NOT EXISTS hydration smallint CHECK (hydration BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS motivation smallint CHECK (motivation BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS recovery smallint CHECK (recovery BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS nutrition smallint CHECK (nutrition BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS nutrition_issue text CHECK (nutrition_issue IN ('time', 'anxiety', 'ate_out', 'not_ready', 'other')),
  ADD COLUMN IF NOT EXISTS nutrition_issue_note text NOT NULL DEFAULT '' CHECK (char_length(nutrition_issue_note) <= 300),
  ADD COLUMN IF NOT EXISTS steps_avg text CHECK (steps_avg IN ('lt5000', '5000to7500', '7500to10000', '10000to12000', 'gt12000')),
  ADD COLUMN IF NOT EXISTS cycle_answer text CHECK (cycle_answer IN ('logged', 'not_logged', 'pill', 'menopause'));

COMMENT ON COLUMN public.routine_day_logs.pain_areas IS
  'Músculos que marcó el alumno con dolor no habitual (ids de VOLUME_MUSCLES: gluteo, femoral, …).';
COMMENT ON COLUMN public.routine_day_logs.steps_avg IS 'Solo en el chequeo del último día de la semana.';
COMMENT ON COLUMN public.routine_day_logs.cycle_answer IS 'Solo mujeres, en el chequeo del último día de la semana.';

-- ───────────── 2) Tipo de aviso ─────────────
ALTER TABLE public.student_urgent_messages
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'urgent' CHECK (kind IN ('urgent', 'pain')),
  ADD COLUMN IF NOT EXISTS routine_id uuid REFERENCES public.routines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS routine_day_id uuid REFERENCES public.routine_days(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS student_urgent_messages_pain_day_uq
  ON public.student_urgent_messages (routine_day_id) WHERE kind = 'pain';

-- ───────────── 3) Guardar el chequeo ─────────────
-- p_data: { sleep, energy, stress, soreness, hydration, motivation, recovery, nutrition (1-5),
--           sleep_hours, pain_kind, pain_areas[], pain_note, nutrition_issue, nutrition_issue_note,
--           steps_avg, cycle_answer, note, pain_message }
-- pain_message es el texto del aviso al entrenador (músculos en palabras + aclaración); lo arma la página.
CREATE OR REPLACE FUNCTION public.save_shared_daily_checkin(p_token text, p_day_id uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_share public.routine_shares%ROWTYPE;
  v_routine_id uuid;
  d jsonb := coalesce(p_data, '{}'::jsonb);
  v_note text := btrim(coalesce(d->>'note', ''));
  v_pain_note text := btrim(coalesce(d->>'pain_note', ''));
  v_issue_note text := btrim(coalesce(d->>'nutrition_issue_note', ''));
  v_pain_msg text := btrim(coalesce(d->>'pain_message', ''));
  v_areas text[];
  v_key text;
  v_n integer;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  SELECT * INTO v_share FROM public.routine_shares WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  -- Escalas: todas obligatorias, de 1 a 5.
  FOREACH v_key IN ARRAY ARRAY['sleep', 'energy', 'stress', 'soreness', 'hydration', 'motivation', 'recovery', 'nutrition'] LOOP
    IF jsonb_typeof(d->v_key) IS DISTINCT FROM 'number' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'missing_' || v_key);
    END IF;
    v_n := (d->>v_key)::numeric::integer;
    IF v_n NOT BETWEEN 1 AND 5 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_scale');
    END IF;
  END LOOP;

  IF coalesce(d->>'sleep_hours', '') NOT IN ('none', 'lt5', '6to7', 'gt8') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_sleep_hours');
  END IF;
  IF coalesce(d->>'pain_kind', '') NOT IN ('none', 'normal', 'unusual') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_pain_kind');
  END IF;
  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO v_areas
    FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(d->'pain_areas') = 'array' THEN d->'pain_areas' ELSE '[]'::jsonb END) AS x
   WHERE x ~ '^[a-z_]{2,30}$';
  IF d->>'pain_kind' = 'unusual' AND cardinality(v_areas) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_pain_areas');
  END IF;
  IF (d->>'nutrition')::numeric <= 2 AND coalesce(d->>'nutrition_issue', '') NOT IN ('time', 'anxiety', 'ate_out', 'not_ready', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_nutrition_issue');
  END IF;
  IF d->>'nutrition_issue' = 'other' AND (d->>'nutrition')::numeric <= 2 AND v_issue_note = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_nutrition_issue_note');
  END IF;
  IF d->>'steps_avg' IS NOT NULL AND d->>'steps_avg' NOT IN ('lt5000', '5000to7500', '7500to10000', '10000to12000', 'gt12000') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_steps');
  END IF;
  IF d->>'cycle_answer' IS NOT NULL AND d->>'cycle_answer' NOT IN ('logged', 'not_logged', 'pill', 'menopause') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_cycle');
  END IF;
  IF char_length(v_note) > 600 OR char_length(v_pain_note) > 600 OR char_length(v_issue_note) > 300 OR char_length(v_pain_msg) > 1000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'note_too_long');
  END IF;

  v_routine_id := public.shared_day_routine(v_share.owner_id, v_share.student_id, p_day_id);
  IF v_routine_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  INSERT INTO public.routine_day_logs (
    routine_day_id, routine_id, student_id,
    sleep, energy, stress, soreness, hydration, motivation, recovery, nutrition,
    sleep_hours, pain_kind, pain_areas, pain_note, nutrition_issue, nutrition_issue_note, steps_avg, cycle_answer,
    checkin_note, checkin_at
  )
  VALUES (
    p_day_id, v_routine_id, v_share.student_id,
    (d->>'sleep')::numeric, (d->>'energy')::numeric, (d->>'stress')::numeric, (d->>'soreness')::numeric,
    (d->>'hydration')::numeric, (d->>'motivation')::numeric, (d->>'recovery')::numeric, (d->>'nutrition')::numeric,
    d->>'sleep_hours', d->>'pain_kind',
    CASE WHEN d->>'pain_kind' = 'unusual' THEN v_areas ELSE '{}' END,
    CASE WHEN d->>'pain_kind' = 'unusual' THEN v_pain_note ELSE '' END,
    CASE WHEN (d->>'nutrition')::numeric <= 2 THEN d->>'nutrition_issue' END,
    CASE WHEN (d->>'nutrition')::numeric <= 2 AND d->>'nutrition_issue' = 'other' THEN v_issue_note ELSE '' END,
    d->>'steps_avg', d->>'cycle_answer',
    v_note, now()
  )
  ON CONFLICT (routine_day_id) DO UPDATE SET
    sleep = excluded.sleep, energy = excluded.energy, stress = excluded.stress, soreness = excluded.soreness,
    hydration = excluded.hydration, motivation = excluded.motivation, recovery = excluded.recovery, nutrition = excluded.nutrition,
    sleep_hours = excluded.sleep_hours, pain_kind = excluded.pain_kind, pain_areas = excluded.pain_areas, pain_note = excluded.pain_note,
    nutrition_issue = excluded.nutrition_issue, nutrition_issue_note = excluded.nutrition_issue_note,
    steps_avg = excluded.steps_avg, cycle_answer = excluded.cycle_answer,
    checkin_note = excluded.checkin_note, checkin_at = now(), updated_at = now();

  -- Dolor no habitual: aviso al entrenador, uno por día de la rutina.
  IF d->>'pain_kind' = 'unusual' THEN
    INSERT INTO public.student_urgent_messages (owner_id, student_id, message, kind, routine_id, routine_day_id)
    VALUES (
      v_share.owner_id, v_share.student_id,
      left(CASE WHEN char_length(v_pain_msg) >= 3 THEN v_pain_msg ELSE 'Dolor no habitual: ' || array_to_string(v_areas, ', ') END, 1000),
      'pain', v_routine_id, p_day_id
    )
    ON CONFLICT (routine_day_id) WHERE kind = 'pain' DO NOTHING;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.save_shared_daily_checkin(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_shared_daily_checkin(text, uuid, jsonb) TO anon, authenticated;

-- ───────────── 4) Lo que el alumno ya dejó ─────────────
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
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_shared_routine_extras(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_routine_extras(text) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
