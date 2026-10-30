-- Correcciones oct5: fase del macrociclo por semana, volumen por alumno, recordatorios de pago
-- y aumentos de precio programados. Todo es solo del entrenador (el alumno no lo ve).

-- ─── 1. Fase del macrociclo en cada semana de la rutina ─────────────────────
ALTER TABLE public.routine_blocks
  ADD COLUMN IF NOT EXISTS phase_type text;

ALTER TABLE public.routine_blocks DROP CONSTRAINT IF EXISTS routine_blocks_phase_type_check;
ALTER TABLE public.routine_blocks
  ADD CONSTRAINT routine_blocks_phase_type_check
  CHECK (phase_type IS NULL OR phase_type IN ('adaptacion', 'desarrollo', 'intensificacion', 'realizacion', 'descarga', 'transicion'));

COMMENT ON COLUMN public.routine_blocks.phase_type IS
  'Fase del macrociclo de la semana (solo entrenador). Genera un bloque en el calendario.';

-- Bloque del calendario generado desde una semana de rutina (si se borra la semana, el bloque queda como historial).
ALTER TABLE public.macrocycle_plan_blocks
  ADD COLUMN IF NOT EXISTS routine_block_id uuid REFERENCES public.routine_blocks(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_macrocycle_plan_blocks_routine_block
  ON public.macrocycle_plan_blocks (routine_block_id)
  WHERE routine_block_id IS NOT NULL;

-- Si la semana cambia de fechas (o se mueve la rutina en el calendario), el bloque la acompaña.
CREATE OR REPLACE FUNCTION public.sync_plan_block_dates_from_week()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL AND NEW.end_date >= NEW.start_date
     AND (NEW.start_date IS DISTINCT FROM OLD.start_date OR NEW.end_date IS DISTINCT FROM OLD.end_date) THEN
    UPDATE public.macrocycle_plan_blocks
       SET start_date = NEW.start_date, end_date = NEW.end_date, updated_at = now()
     WHERE routine_block_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_plan_block_dates ON public.routine_blocks;
CREATE TRIGGER trg_sync_plan_block_dates
  AFTER UPDATE OF start_date, end_date ON public.routine_blocks
  FOR EACH ROW EXECUTE FUNCTION public.sync_plan_block_dates_from_week();

-- ─── 2. Implicación muscular por alumno (palancas, estructura) ──────────────
CREATE TABLE IF NOT EXISTS public.student_exercise_volume_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercise_library(id) ON DELETE CASCADE,
  factors jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_exercise_volume_factors_unique UNIQUE (owner_id, student_id, exercise_id)
);

COMMENT ON TABLE public.student_exercise_volume_factors IS
  'Volumen por músculo de un ejercicio ajustado para un alumno puntual (pisa al de la biblioteca).';

ALTER TABLE public.student_exercise_volume_factors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_exercise_volume_factors_owner ON public.student_exercise_volume_factors;
CREATE POLICY student_exercise_volume_factors_owner ON public.student_exercise_volume_factors
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ─── 3. Recordatorios de pago enviados ──────────────────────────────────────
-- due = el día de pago; overdue = pasados 7 días hábiles sin pago.
CREATE TABLE IF NOT EXISTS public.student_payment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period ~ '^\d{4}-\d{2}$'),
  kind text NOT NULL CHECK (kind IN ('due', 'overdue')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_payment_reminders_unique UNIQUE (owner_id, student_id, period, kind)
);

ALTER TABLE public.student_payment_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_payment_reminders_owner ON public.student_payment_reminders;
CREATE POLICY student_payment_reminders_owner ON public.student_payment_reminders
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ─── 4. Aumentos de precio programados ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.price_increase_settings (
  owner_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  percent numeric(5, 2) NOT NULL DEFAULT 3 CHECK (percent > 0 AND percent <= 100),
  every_months integer NOT NULL DEFAULT 3 CHECK (every_months BETWEEN 1 AND 24),
  next_date date,
  apply_students boolean NOT NULL DEFAULT true,
  apply_web_plans boolean NOT NULL DEFAULT true,
  -- Planes web a los que se aplica (null = todos los activos).
  web_plan_slugs text[],
  -- Último aviso al grupo copiado (para no repetirlo).
  notice_copied_for date,
  round_to integer NOT NULL DEFAULT 100 CHECK (round_to IN (1, 10, 100, 500, 1000)),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.price_increase_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS price_increase_settings_owner ON public.price_increase_settings;
CREATE POLICY price_increase_settings_owner ON public.price_increase_settings
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Historial de aumentos aplicados (qué se cambió y de cuánto a cuánto).
CREATE TABLE IF NOT EXISTS public.price_increase_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  applied_at timestamptz NOT NULL DEFAULT now(),
  percent numeric(5, 2) NOT NULL,
  details jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_price_increase_log_owner ON public.price_increase_log (owner_id, applied_at DESC);

ALTER TABLE public.price_increase_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS price_increase_log_owner ON public.price_increase_log;
CREATE POLICY price_increase_log_owner ON public.price_increase_log
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ─── 5. Asesorías bonificadas: cobros en $0 ─────────────────────────────────
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
      FROM pg_constraint con
     WHERE con.conrelid = 'public.income'::regclass
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) ~* 'amount\s*>\s*\(?0'
  LOOP
    EXECUTE format('ALTER TABLE public.income DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.income DROP CONSTRAINT IF EXISTS income_amount_not_negative;
ALTER TABLE public.income ADD CONSTRAINT income_amount_not_negative CHECK (amount >= 0);
