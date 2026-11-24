-- Feedback nov24 (tanda 4): rutinas.
--  11) Rutina siguiente guardada sin activar: estado «borrador». El alumno sigue con la actual; al activarla
--      arranca hoy y la anterior pasa a terminada.
--   9) La rutina arranca con fecha de hoy y, cuando el alumno cierra su primer día entrenado, las fechas de la
--      rutina y de cada semana se corren a ese día (una sola vez por rutina: anchor_first_day).
--  10) El link del alumno trae el historial de sus rutinas anteriores y deja ver cada una (solo para ver).
-- Se puede correr más de una vez.

ALTER TYPE public.routine_status ADD VALUE IF NOT EXISTS 'borrador';

-- Existentes: no se tocan (false). Las nuevas nacen con true.
ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS anchor_first_day boolean NOT NULL DEFAULT false;
ALTER TABLE public.routines ALTER COLUMN anchor_first_day SET DEFAULT true;
COMMENT ON COLUMN public.routines.anchor_first_day IS
  'Si es true, al cerrar el alumno su primer día entrenado se corren las fechas de la rutina a ese día (y queda en false).';

-- Rutinas activas de las últimas dos semanas que el alumno todavía no empezó: también se acomodan.
UPDATE public.routines r
   SET anchor_first_day = true
 WHERE r.student_id IS NOT NULL
   AND r.status::text IN ('activa', 'por_vencer')
   AND r.created_at > now() - interval '14 days'
   AND NOT r.anchor_first_day
   AND NOT EXISTS (SELECT 1 FROM public.routine_day_logs l WHERE l.routine_id = r.id AND l.status = 'done');

-- Corre las fechas de la rutina y de sus semanas.
CREATE OR REPLACE FUNCTION public.shift_routine_dates(p_routine_id uuid, p_days integer)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(p_days, 0) = 0 THEN
    RETURN;
  END IF;
  UPDATE public.routines SET start_date = start_date + p_days, end_date = end_date + p_days WHERE id = p_routine_id;
  UPDATE public.routine_blocks SET start_date = start_date + p_days, end_date = end_date + p_days WHERE routine_id = p_routine_id;
END;
$$;
REVOKE ALL ON FUNCTION public.shift_routine_dates(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shift_routine_dates(uuid, integer) TO authenticated;

-- (9) Primer día cerrado como entrenado: la rutina arranca ese día.
CREATE OR REPLACE FUNCTION public.anchor_routine_on_first_day()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_start date;
  v_anchor boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM 'done' OR NEW.status_date IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT start_date, anchor_first_day INTO v_start, v_anchor FROM public.routines WHERE id = NEW.routine_id FOR UPDATE;
  IF coalesce(v_anchor, false) THEN
    UPDATE public.routines SET anchor_first_day = false WHERE id = NEW.routine_id;
    IF v_start IS NOT NULL AND NEW.status_date <> v_start THEN
      PERFORM public.shift_routine_dates(NEW.routine_id, NEW.status_date - v_start);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS anchor_routine_on_first_day ON public.routine_day_logs;
CREATE TRIGGER anchor_routine_on_first_day
  AFTER INSERT OR UPDATE OF status, status_date ON public.routine_day_logs
  FOR EACH ROW EXECUTE FUNCTION public.anchor_routine_on_first_day();

-- (11) Activar la rutina guardada: arranca hoy (y se vuelve a acomodar al primer día entrenado); las otras
-- activas del alumno pasan a terminadas. Devuelve cuántas se terminaron.
CREATE OR REPLACE FUNCTION public.activate_routine_draft(p_routine_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_r public.routines%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
  v_closed integer := 0;
BEGIN
  SELECT * INTO v_r FROM public.routines WHERE id = p_routine_id AND owner_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la rutina.' USING ERRCODE = '22023';
  END IF;
  IF v_r.status::text <> 'borrador' THEN
    RAISE EXCEPTION 'La rutina ya está activa.' USING ERRCODE = '22023';
  END IF;

  IF v_r.student_id IS NOT NULL THEN
    UPDATE public.routines
       SET status = 'completada', completed_at = now(), last_status_change = now()
     WHERE owner_id = auth.uid() AND student_id = v_r.student_id AND id <> p_routine_id
       AND status::text IN ('activa', 'por_vencer');
    GET DIAGNOSTICS v_closed = ROW_COUNT;
  END IF;

  IF v_r.start_date IS NOT NULL THEN
    PERFORM public.shift_routine_dates(p_routine_id, v_today - v_r.start_date);
  END IF;
  UPDATE public.routines
     SET status = 'activa', anchor_first_day = true, last_status_change = now(), completed_at = NULL
   WHERE id = p_routine_id;
  RETURN v_closed;
END;
$$;
REVOKE ALL ON FUNCTION public.activate_routine_draft(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_routine_draft(uuid) TO authenticated;

-- (10) Lo que devuelve el link: igual que en 20261119120000 más el id de la rutina, el historial y la
-- posibilidad de pedir una rutina anterior. Las rutinas en borrador no se ven.
CREATE OR REPLACE FUNCTION public.shared_routine_payload(p_token text, p_routine_id uuid)
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
  v_current uuid;
  v_history jsonb;
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
  -- Las guardadas sin activar (borrador) no las ve el alumno.
  SELECT r.id INTO v_current
    FROM public.routines r
   WHERE r.owner_id = v_share.owner_id AND r.student_id = v_share.student_id
     AND r.status::text <> 'borrador'
   ORDER BY (r.status::text IN ('activa', 'por_vencer')) DESC, (r.status::text <> 'completada') DESC,
            r.start_date DESC NULLS LAST, r.created_at DESC
   LIMIT 1;

  -- Con p_routine_id: una rutina anterior del historial (solo para ver).
  SELECT * INTO v_routine
    FROM public.routines r
   WHERE r.id = coalesce(p_routine_id, v_current)
     AND r.owner_id = v_share.owner_id AND r.student_id = v_share.student_id
     AND r.status::text <> 'borrador';
  IF p_routine_id IS NOT NULL AND NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Historial: las otras rutinas del alumno con este entrenador, la más nueva primero.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', h.id, 'name', h.name, 'objective', h.objective, 'status', h.status,
           'start_date', h.start_date, 'end_date', h.end_date,
           'days_done', (SELECT count(*) FROM public.routine_day_logs l WHERE l.routine_id = h.id AND l.status = 'done'))
         ORDER BY h.start_date DESC NULLS LAST, h.created_at DESC), '[]'::jsonb)
    INTO v_history
    FROM (SELECT * FROM public.routines r
           WHERE r.owner_id = v_share.owner_id AND r.student_id = v_share.student_id
             AND r.status::text <> 'borrador' AND r.id IS DISTINCT FROM v_current
           ORDER BY r.start_date DESC NULLS LAST, r.created_at DESC
           LIMIT 24) h;

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
      'id', v_routine.id,
      'name', v_routine.name,
      'status', v_routine.status,
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
      'done', v_done) END,
    'history', coalesce(v_history, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.shared_routine_payload(text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_shared_routine(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.shared_routine_payload(p_token, NULL)
$$;
REVOKE ALL ON FUNCTION public.get_shared_routine(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_routine(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_shared_past_routine(p_token text, p_routine_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN p_routine_id IS NULL THEN NULL ELSE public.shared_routine_payload(p_token, p_routine_id) END
$$;
REVOKE ALL ON FUNCTION public.get_shared_past_routine(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_past_routine(text, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
