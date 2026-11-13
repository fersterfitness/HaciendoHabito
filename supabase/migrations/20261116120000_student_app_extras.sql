-- App del alumno (/rutina/:token), tanda 4 del feedback del entrenador (nov-2026):
--
-- 1) routine_month_reviews: la devolución que el alumno deja al terminar su mes de rutina, con su
--    permiso (o no) para que el entrenador la comparta.
-- 2) student_cycle_settings: si la alumna toma pastillas anticonceptivas. Los inicios de ciclo se
--    guardan en la tabla que ya existe (menstrual_cycles), la misma que usa la ficha del entrenador.
-- 3) get_shared_student_extras: lo que la página del alumno necesita además de la rutina: sus ciclos,
--    si ya dejó la devolución del mes, y su ventana de pago con si hay un cobro registrado este mes.
--
-- No cambia ni borra nada de lo que ya existe. Se puede correr más de una vez.
-- Requiere 20261115120000_student_training_log.sql (usa shared_day_routine).
BEGIN;

-- ───────────── 1) Devolución de fin de mes ─────────────
CREATE TABLE IF NOT EXISTS public.routine_month_reviews (
  routine_id uuid PRIMARY KEY REFERENCES public.routines(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  review text NOT NULL CHECK (char_length(btrim(review)) BETWEEN 3 AND 2000),
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  -- El alumno acepta que el entrenador la comparta (por ejemplo en redes).
  share_ok boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS routine_month_reviews_owner_idx ON public.routine_month_reviews (owner_id, created_at DESC);
COMMENT ON TABLE public.routine_month_reviews IS
  'Devolución del alumno al cerrar su mes de rutina. share_ok = aceptó que se comparta.';

ALTER TABLE public.routine_month_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS routine_month_reviews_read ON public.routine_month_reviews;
CREATE POLICY routine_month_reviews_read ON public.routine_month_reviews
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.routines r WHERE r.id = routine_month_reviews.routine_id));

-- p_day_id: cualquier día de la rutina (la página del alumno no conoce el id de la rutina).
CREATE OR REPLACE FUNCTION public.save_shared_month_review(
  p_token text,
  p_day_id uuid,
  p_review text,
  p_rating integer,
  p_share_ok boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_share public.routine_shares%ROWTYPE;
  v_routine_id uuid;
  v_review text := btrim(coalesce(p_review, ''));
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  SELECT * INTO v_share FROM public.routine_shares WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF char_length(v_review) NOT BETWEEN 3 AND 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_review');
  END IF;
  IF p_rating IS NOT NULL AND (p_rating < 1 OR p_rating > 5) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_rating');
  END IF;

  v_routine_id := public.shared_day_routine(v_share.owner_id, v_share.student_id, p_day_id);
  IF v_routine_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  INSERT INTO public.routine_month_reviews (routine_id, owner_id, student_id, review, rating, share_ok)
  VALUES (v_routine_id, v_share.owner_id, v_share.student_id, v_review, p_rating, coalesce(p_share_ok, false))
  ON CONFLICT (routine_id)
  DO UPDATE SET review = excluded.review, rating = excluded.rating, share_ok = excluded.share_ok, updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.save_shared_month_review(text, uuid, text, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_shared_month_review(text, uuid, text, integer, boolean) TO anon, authenticated;

-- ───────────── 2) Ciclo menstrual desde la app de la alumna ─────────────
CREATE TABLE IF NOT EXISTS public.student_cycle_settings (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  on_pill boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.student_cycle_settings IS
  'Lo que la alumna indica desde su app sobre el ciclo: hoy, si toma pastillas anticonceptivas.';

ALTER TABLE public.student_cycle_settings ENABLE ROW LEVEL SECURITY;
-- Lectura: quien puede ver a la alumna (la subconsulta respeta el RLS de students).
DROP POLICY IF EXISTS student_cycle_settings_read ON public.student_cycle_settings;
CREATE POLICY student_cycle_settings_read ON public.student_cycle_settings
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_cycle_settings.student_id));

-- Inicio de un ciclo (primer día de menstruación). No duplica la misma fecha.
CREATE OR REPLACE FUNCTION public.save_shared_cycle_start(p_token text, p_date date)
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
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF p_date IS NULL OR p_date > (now() + interval '1 day')::date OR p_date < (now() - interval '120 days')::date THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_date');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.menstrual_cycles c WHERE c.student_id = v_share.student_id AND c.cycle_start_date = p_date) THEN
    INSERT INTO public.menstrual_cycles (owner_id, student_id, cycle_start_date, cycle_length, notes)
    VALUES (v_share.owner_id, v_share.student_id, p_date, 28, 'Desde la app de la alumna');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.save_shared_cycle_start(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_shared_cycle_start(text, date) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_shared_cycle_pill(p_token text, p_on_pill boolean)
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
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  INSERT INTO public.student_cycle_settings (student_id, on_pill)
  VALUES (v_share.student_id, coalesce(p_on_pill, false))
  ON CONFLICT (student_id) DO UPDATE SET on_pill = excluded.on_pill, updated_at = now();
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.save_shared_cycle_pill(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_shared_cycle_pill(text, boolean) TO anon, authenticated;

-- ───────────── 3) Lo que la app del alumno lee además de la rutina ─────────────
-- Del pago solo sale la ventana de días y si este mes ya hay un cobro registrado: nunca montos.
CREATE OR REPLACE FUNCTION public.get_shared_student_extras(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_share public.routine_shares%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
  v_from integer;
  v_to integer;
  v_paid boolean;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_share FROM public.routine_shares WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT s.payment_day_from, s.payment_day_to INTO v_from, v_to FROM public.students s WHERE s.id = v_share.student_id;
  SELECT EXISTS (
    SELECT 1 FROM public.income i
     WHERE i.student_id = v_share.student_id
       AND i.status = 'cobrado'
       AND i.income_date >= date_trunc('month', v_today)::date
       AND i.income_date < (date_trunc('month', v_today) + interval '1 month')::date
  ) INTO v_paid;

  RETURN jsonb_build_object(
    'today', v_today,
    'cycles', coalesce((
      SELECT jsonb_agg(x.cycle_start_date ORDER BY x.cycle_start_date DESC)
        FROM (SELECT c.cycle_start_date FROM public.menstrual_cycles c
               WHERE c.student_id = v_share.student_id ORDER BY c.cycle_start_date DESC LIMIT 12) x
    ), '[]'::jsonb),
    'on_pill', coalesce((SELECT cs.on_pill FROM public.student_cycle_settings cs WHERE cs.student_id = v_share.student_id), false),
    -- Días de las rutinas que ya tienen devolución (la página conoce los días, no el id de la rutina).
    'reviewed_days', coalesce((
      SELECT jsonb_agg(d.id)
        FROM public.routine_month_reviews mr
        JOIN public.routine_blocks b ON b.routine_id = mr.routine_id
        JOIN public.routine_days d ON d.block_id = b.id
       WHERE mr.student_id = v_share.student_id AND mr.owner_id = v_share.owner_id
    ), '[]'::jsonb),
    'payment', jsonb_build_object('day_from', v_from, 'day_to', v_to, 'paid_this_month', v_paid)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_shared_student_extras(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_student_extras(text) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
