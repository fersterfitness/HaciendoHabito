-- Feedback nov24 (punto 5): tareas propias del entrenador en el Inicio, generales o de un alumno
-- («revisar calendario de Ailu»), con check. Separadas de los avisos y de «Para hoy».
-- Se puede correr más de una vez.

CREATE TABLE IF NOT EXISTS public.trainer_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Vacío = tarea general.
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(btrim(text)) BETWEEN 1 AND 300),
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trainer_tasks_owner ON public.trainer_tasks(owner_id, created_at);

COMMENT ON TABLE public.trainer_tasks IS 'Tareas propias del entrenador (Inicio), generales o de un alumno.';

ALTER TABLE public.trainer_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trainer_tasks_owner_all ON public.trainer_tasks;
CREATE POLICY trainer_tasks_owner_all ON public.trainer_tasks
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (
    owner_id = auth.uid()
    AND (student_id IS NULL OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = trainer_tasks.student_id))
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_tasks TO authenticated;

NOTIFY pgrst, 'reload schema';
