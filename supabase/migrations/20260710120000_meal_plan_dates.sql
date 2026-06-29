-- Plan de alimentación: fechas de vigencia (inicio/fin), igual que en rutinas.
-- Permite asignar planes por períodos (ej. 2 semanas un plan, otras 2 semanas otro).

ALTER TABLE public.trainer_student_meal_plans
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date;

COMMENT ON COLUMN public.trainer_student_meal_plans.start_date IS 'Fecha de inicio de vigencia del plan de alimentación.';
COMMENT ON COLUMN public.trainer_student_meal_plans.end_date IS 'Fecha de fin de vigencia del plan de alimentación.';
