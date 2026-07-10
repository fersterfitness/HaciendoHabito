-- Plan de alimentación: estado "completado" (como las rutinas realizadas).
-- Los planes no se borran: quedan ordenados por alumno y se marcan al terminar.

ALTER TABLE public.trainer_student_meal_plans
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

COMMENT ON COLUMN public.trainer_student_meal_plans.completed_at IS
  'Fecha/hora en que el entrenador marcó el plan de alimentación como completado (null = vigente).';

CREATE INDEX IF NOT EXISTS idx_meal_plans_student_completed
  ON public.trainer_student_meal_plans(student_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;
