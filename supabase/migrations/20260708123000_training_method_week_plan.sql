-- Métodos · Planificación por semana + % de RM
-- Permite definir el método por semana (ej. cargas ondulatorias en olas):
--   Semana 1: 6,6,6 · Semana 2: 6,6,5 · Semana 3: 6,5,5 · Semana 4: 5,5,5
-- y opcionalmente un % de RM por semana. Al aplicar el método en la rutina, cada
-- semana copia su "reps por serie"; si el alumno tiene RM cargado, el % calcula el peso.

ALTER TABLE public.training_methods
  ADD COLUMN IF NOT EXISTS week_plan jsonb;

COMMENT ON COLUMN public.training_methods.week_plan IS
  'Plan por semana del método. Array JSON ordenado por semana: '
  '[{"reps_scheme":"6,6,6","percent_rm":70}, {"reps_scheme":"6,6,5","percent_rm":75}, ...]. '
  'percent_rm es opcional (null = sin %).';

-- % de RM planificado por ejercicio/semana en la rutina (se persiste al aplicar el método).
ALTER TABLE public.routine_exercises
  ADD COLUMN IF NOT EXISTS percent_rm numeric(5,2)
    CHECK (percent_rm IS NULL OR (percent_rm > 0 AND percent_rm <= 200));

COMMENT ON COLUMN public.routine_exercises.percent_rm IS
  'Porcentaje de RM planificado para esta serie/semana. Si el alumno tiene RM, se usa para sugerir el peso.';
