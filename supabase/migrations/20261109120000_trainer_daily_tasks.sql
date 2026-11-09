-- «Para hoy» como misiones: cada tarea del Inicio del entrenador queda guardada con el día en que
-- apareció y, cuando se tilda, con la fecha en que se completó. Así no reaparece al recargar, se puede
-- deshacer y, si no se tildó, al día siguiente figura como vencida.
--
-- task_key identifica la tarea (ej. 'cobro:<alumno>:2026-11:due', 'rutina-fin:<rutina>').

CREATE TABLE IF NOT EXISTS public.trainer_daily_tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  task_key      text NOT NULL CHECK (length(task_key) <= 200),
  category      text NOT NULL CHECK (category IN ('feedback', 'rutinas', 'avisos', 'cobros')),
  title         text NOT NULL CHECK (length(title) <= 300),
  detail        text CHECK (detail IS NULL OR length(detail) <= 600),
  href          text CHECK (href IS NULL OR length(href) <= 300),
  first_seen_on date NOT NULL DEFAULT current_date,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trainer_daily_tasks_owner_key UNIQUE (owner_id, task_key)
);

COMMENT ON TABLE public.trainer_daily_tasks IS 'Misiones del Inicio del entrenador: cuándo aparecieron y cuándo se completaron.';

CREATE INDEX IF NOT EXISTS idx_trainer_daily_tasks_owner_seen ON public.trainer_daily_tasks (owner_id, first_seen_on DESC);

ALTER TABLE public.trainer_daily_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trainer_daily_tasks_owner_rw ON public.trainer_daily_tasks;
CREATE POLICY trainer_daily_tasks_owner_rw ON public.trainer_daily_tasks
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
