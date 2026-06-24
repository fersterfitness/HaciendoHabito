-- Item 2 · Rutinas completadas / historial
-- Permite marcar una rutina (típicamente vencida) como "realizada" y separarla de las activas.

-- Nuevo valor del enum de estado. (No se usa el valor en esta misma transacción, sólo se agrega.)
ALTER TYPE public.routine_status ADD VALUE IF NOT EXISTS 'completada';

-- Marca de cuándo el entrenador la dio por realizada (para ordenar el historial).
ALTER TABLE public.routines
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

COMMENT ON COLUMN public.routines.completed_at IS
  'Fecha/hora en que el entrenador marcó la rutina como realizada (estado completada).';

CREATE INDEX IF NOT EXISTS idx_routines_completed
  ON public.routines(student_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;
