-- Correcciones oct6: fases del macrociclo editables, limpieza del calendario y feedback semanal por semana del formulario.

-- ─── 1. Fases propias (Adaptación, Acumulación, Intensificación, Peak… y las que agregue) ───
CREATE TABLE IF NOT EXISTS public.macrocycle_phase_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key ~ '^[a-z0-9_-]{1,40}$'),
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 40),
  color text NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT macrocycle_phase_types_unique UNIQUE (owner_id, key)
);

COMMENT ON TABLE public.macrocycle_phase_types IS
  'Fases del macrociclo de cada entrenador (lista editable). Sin filas, la app usa las de fábrica.';

ALTER TABLE public.macrocycle_phase_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS macrocycle_phase_types_owner ON public.macrocycle_phase_types;
CREATE POLICY macrocycle_phase_types_owner ON public.macrocycle_phase_types
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Las columnas de fase dejan de estar atadas a la lista fija de 6.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conrelid::regclass AS tbl, conname
      FROM pg_constraint
     WHERE contype = 'c'
       AND conrelid IN ('public.routines'::regclass, 'public.macrocycle_plan_blocks'::regclass, 'public.routine_blocks'::regclass)
       AND (pg_get_constraintdef(oid) ILIKE '%block_type%' OR pg_get_constraintdef(oid) ILIKE '%phase_type%')
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

-- ─── 2. Quitar del calendario el historial de rutinas borradas ───
ALTER TABLE public.routine_deletion_log
  ADD COLUMN IF NOT EXISTS calendar_hidden_at timestamptz;

DROP POLICY IF EXISTS routine_deletion_log_hide ON public.routine_deletion_log;
CREATE POLICY routine_deletion_log_hide ON public.routine_deletion_log
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Del historial solo se puede tocar esa marca (el snapshot y la restauración quedan intactos).
REVOKE UPDATE ON public.routine_deletion_log FROM authenticated;
GRANT UPDATE (calendar_hidden_at) ON public.routine_deletion_log TO authenticated;

-- ─── 3. Feedback semanal: cada respuesta pertenece a la semana del formulario ───
-- Antes contaba la fecha de envío (lun–dom): quien completaba tarde el del viernes «gastaba» la
-- semana nueva y el formulario siguiente decía «ya lo completaste». Ahora la semana es la del
-- día de envío (viernes, o el día programado del formulario), y el link puede pedir una semana
-- anterior que quedó debiendo (`?semana=AAAA-MM-DD`).

ALTER TABLE public.check_in_responses
  ADD COLUMN IF NOT EXISTS period_start date;

COMMENT ON COLUMN public.check_in_responses.period_start IS
  'Día de envío (viernes u otro programado) de la semana a la que corresponde la respuesta.';

-- Día de la semana en que se manda el formulario (0=dom … 6=sáb). Sin programación: viernes.
CREATE OR REPLACE FUNCTION public.hh_check_in_send_dow(p_form_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    (SELECT s.day_of_week FROM public.check_in_send_schedules s
      WHERE s.form_id = p_form_id AND s.is_enabled
      ORDER BY s.created_at LIMIT 1),
    5
  );
$$;

-- Último día de envío en o antes de la fecha.
CREATE OR REPLACE FUNCTION public.hh_check_in_send_day_on_or_before(p_day date, p_dow int)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_day - ((extract(dow FROM p_day)::int - p_dow + 7) % 7);
$$;

-- Semana de una respuesta nueva: la que pide el link (si es de las últimas 10 semanas) o la actual.
CREATE OR REPLACE FUNCTION public.hh_check_in_period(p_form_id uuid, p_answers jsonb)
RETURNS date
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
  v_dow int := public.hh_check_in_send_dow(p_form_id);
  v_current date := public.hh_check_in_send_day_on_or_before(v_today, v_dow);
  v_req date;
BEGIN
  BEGIN
    v_req := nullif(p_answers->>'__period', '')::date;
  EXCEPTION WHEN others THEN
    v_req := NULL;
  END;
  IF v_req IS NOT NULL AND v_req <= v_current AND v_req >= v_current - 70 THEN
    RETURN public.hh_check_in_send_day_on_or_before(v_req, v_dow);
  END IF;
  RETURN v_current;
END;
$$;

REVOKE ALL ON FUNCTION public.hh_check_in_period(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hh_check_in_send_dow(uuid) FROM PUBLIC;

-- Respuestas viejas: la semana del último día de envío antes de que respondieran.
UPDATE public.check_in_responses r
   SET period_start = public.hh_check_in_send_day_on_or_before(
         (r.submitted_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
         public.hh_check_in_send_dow(i.form_id))
  FROM public.check_in_invites i
 WHERE i.id = r.invite_id
   AND r.period_start IS NULL;

-- Al insertar: la semana que fijó la función de envío; si no (alta manual), la del día.
CREATE OR REPLACE FUNCTION public.hh_check_in_response_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_set text := current_setting('hh.check_in_period', true);
BEGIN
  IF NEW.period_start IS NULL THEN
    IF v_set IS NOT NULL AND v_set <> '' THEN
      NEW.period_start := v_set::date;
    ELSE
      NEW.period_start := public.hh_check_in_send_day_on_or_before(
        (coalesce(NEW.submitted_at, now()) AT TIME ZONE 'America/Argentina/Buenos_Aires')::date,
        public.hh_check_in_send_dow((SELECT i.form_id FROM public.check_in_invites i WHERE i.id = NEW.invite_id)));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_in_response_period ON public.check_in_responses;
CREATE TRIGGER trg_check_in_response_period
  BEFORE INSERT ON public.check_in_responses
  FOR EACH ROW EXECUTE FUNCTION public.hh_check_in_response_period();

-- La unicidad pasa a ser por semana del formulario (la de fecha de envío se va).
DROP INDEX IF EXISTS public.check_in_responses_one_per_invite_per_week;
CREATE INDEX IF NOT EXISTS idx_check_in_responses_invite_period
  ON public.check_in_responses (invite_id, period_start);

-- Las dos funciones de envío (link personal y link general): se cambia solo el control de
-- «ya respondió esta semana», sobre la versión que está en la base (no se pisa nada más).
DO $$
DECLARE
  v_sig text;
  v_def text;
  v_new text;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'public.submit_check_in_response(uuid, jsonb, boolean, text)',
    'public.submit_check_in_shared_response(uuid, jsonb, boolean, text)'
  ] LOOP
    v_def := pg_get_functiondef(v_sig::regprocedure);
    IF position('hh_check_in_period' IN v_def) > 0 THEN
      CONTINUE; -- ya adaptada
    END IF;
    v_new := regexp_replace(
      v_def,
      $re$v_week_local\s*:=\s*date_trunc\('week',\s*now\(\)\s*AT TIME ZONE 'America/Argentina/Buenos_Aires'\);$re$,
      $rep$v_week_local := public.hh_check_in_period(v_form_id, p_answers);
  PERFORM set_config('hh.check_in_period', v_week_local::date::text, true);$rep$
    );
    v_new := regexp_replace(
      v_new,
      $re$date_trunc\('week',\s*r\.submitted_at\s*AT TIME ZONE 'America/Argentina/Buenos_Aires'\)\s*=\s*v_week_local$re$,
      'r.period_start = v_week_local::date'
    );
    IF position('hh_check_in_period' IN v_new) = 0 OR position('r.period_start = v_week_local::date' IN v_new) = 0 THEN
      RAISE EXCEPTION 'No se pudo adaptar %: el control semanal no tiene la forma esperada', v_sig;
    END IF;
    EXECUTE v_new;
  END LOOP;
END $$;
