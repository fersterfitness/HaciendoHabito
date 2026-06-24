-- Preferencias del entrenador por alumno (antes en localStorage: tags, cuota, peso objetivo).

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS trainer_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS monthly_fee_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS target_weight_kg numeric(6, 2);

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_monthly_fee_amount_positive;

ALTER TABLE public.students
  ADD CONSTRAINT students_monthly_fee_amount_positive
  CHECK (monthly_fee_amount IS NULL OR monthly_fee_amount > 0);

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_target_weight_kg_positive;

ALTER TABLE public.students
  ADD CONSTRAINT students_target_weight_kg_positive
  CHECK (target_weight_kg IS NULL OR target_weight_kg > 0);

COMMENT ON COLUMN public.students.trainer_tags IS 'Etiquetas libres (antes localStorage tags_{id}).';
COMMENT ON COLUMN public.students.monthly_fee_amount IS 'Cuota mensual de referencia en ARS (antes localStorage cuota_mensual_{id}).';
COMMENT ON COLUMN public.students.target_weight_kg IS 'Peso objetivo en kg (antes localStorage peso_goal_{id}).';
