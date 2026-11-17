-- Avisos del alumno al entrenador desde el link de la rutina (/rutina/:token) — feedback del entrenador, nov3.
--
-- 1) student_urgent_messages suma tres tipos más, que el alumno manda con un botón obligatorio:
--      'last_week'    «Es mi última semana de rutina» (primer día de la última semana)
--      'week_done'    «Terminé mi semana X» (último día de cada semana; el entrenador da la devolución el lunes)
--      'routine_done' «Terminé hoy mi rutina» (último día de la última semana)
--    Cada uno va atado a la semana (routine_block_id) y se manda una sola vez por semana.
-- 2) send_shared_routine_notice: lo que llama el botón del alumno.
-- 3) get_shared_routine_extras devuelve además qué avisos ya mandó (para no volver a pedirlos).
--
-- No borra nada. Se puede correr más de una vez.
-- Requiere 20261120120000_daily_checkin_v2.sql.
BEGIN;

-- ───────────── 1) Tipos nuevos ─────────────
ALTER TABLE public.student_urgent_messages DROP CONSTRAINT IF EXISTS student_urgent_messages_kind_check;
ALTER TABLE public.student_urgent_messages
  ADD CONSTRAINT student_urgent_messages_kind_check
  CHECK (kind IN ('urgent', 'pain', 'last_week', 'week_done', 'routine_done'));
ALTER TABLE public.student_urgent_messages
  ADD COLUMN IF NOT EXISTS routine_block_id uuid REFERENCES public.routine_blocks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS week_number smallint;
CREATE UNIQUE INDEX IF NOT EXISTS student_urgent_messages_block_notice_uq
  ON public.student_urgent_messages (routine_block_id, kind)
  WHERE kind IN ('last_week', 'week_done', 'routine_done');
CREATE INDEX IF NOT EXISTS student_urgent_messages_student_kind_idx
  ON public.student_urgent_messages (owner_id, student_id, kind, created_at DESC);

-- ───────────── 2) Botón del alumno ─────────────
CREATE OR REPLACE FUNCTION public.send_shared_routine_notice(p_token text, p_block_id uuid, p_kind text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_share public.routine_shares%ROWTYPE;
  v_routine_id uuid;
  v_week integer;
  v_total integer;
  v_message text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  SELECT * INTO v_share FROM public.routine_shares WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF p_kind NOT IN ('last_week', 'week_done', 'routine_done') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_kind');
  END IF;

  SELECT b.routine_id INTO v_routine_id
    FROM public.routine_blocks b
    JOIN public.routines r ON r.id = b.routine_id
   WHERE b.id = p_block_id AND r.owner_id = v_share.owner_id AND r.student_id = v_share.student_id;
  IF v_routine_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Número de semana: posición del bloque en la rutina (mismo orden que ve el alumno).
  SELECT w.n, w.total INTO v_week, v_total
    FROM (
      SELECT b.id, row_number() OVER (ORDER BY b.sort_order, b.id) AS n, count(*) OVER () AS total
        FROM public.routine_blocks b
       WHERE b.routine_id = v_routine_id
    ) w
   WHERE w.id = p_block_id;

  v_message := CASE p_kind
    WHEN 'last_week' THEN format('Empezó su última semana de rutina (semana %s de %s): armá la que sigue.', v_week, v_total)
    WHEN 'week_done' THEN format('Terminó su semana %s de %s: le toca tu devolución.', v_week, v_total)
    ELSE 'Terminó hoy su rutina.'
  END;

  INSERT INTO public.student_urgent_messages (owner_id, student_id, message, kind, routine_id, routine_block_id, week_number)
  VALUES (v_share.owner_id, v_share.student_id, v_message, p_kind, v_routine_id, p_block_id, v_week)
  ON CONFLICT (routine_block_id, kind) WHERE kind IN ('last_week', 'week_done', 'routine_done') DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.send_shared_routine_notice(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_shared_routine_notice(text, uuid, text) TO anon, authenticated;

-- ───────────── 3) Lo que el alumno ya dejó (+ avisos mandados) ─────────────
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
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_shared_routine_extras(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_routine_extras(text) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
