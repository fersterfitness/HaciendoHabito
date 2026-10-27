-- Finanzas v2.
-- 1) Ventana de pago mensual por alumno (ej. paga del 1 al 5): pasado el último día sin
--    cobro registrado en el mes, el alumno figura «vencido» con aviso por WhatsApp.
-- 2) El ingreso queda atado a la rutina que lo generó: al asignar una rutina con precio
--    se crea un ingreso «pendiente» y al marcar «Abonó» pasa a «cobrado» (mismo registro).

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS payment_day_from smallint
    CHECK (payment_day_from IS NULL OR payment_day_from BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS payment_day_to smallint
    CHECK (payment_day_to IS NULL OR payment_day_to BETWEEN 1 AND 31);

COMMENT ON COLUMN public.students.payment_day_from IS 'Primer día del mes en que el alumno suele pagar.';
COMMENT ON COLUMN public.students.payment_day_to IS 'Último día del mes para pagar; pasado este día sin cobro, figura vencido.';

ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS routine_id uuid REFERENCES public.routines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_income_routine ON public.income (routine_id) WHERE routine_id IS NOT NULL;
