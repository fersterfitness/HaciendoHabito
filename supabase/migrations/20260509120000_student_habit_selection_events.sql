-- Historial: cuándo el entrenador agrega o quita un hábito a un alumno (evolución y gráficos mensuales).

CREATE TABLE IF NOT EXISTS public.student_habit_selection_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  habit_id    uuid NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  action      text NOT NULL CHECK (action IN ('assigned', 'removed')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_habit_sel_ev_student_created
  ON public.student_habit_selection_events(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_habit_sel_ev_owner_created
  ON public.student_habit_selection_events(owner_id, created_at DESC);

ALTER TABLE public.student_habit_selection_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_habit_selection_events_owner ON public.student_habit_selection_events;
CREATE POLICY student_habit_selection_events_owner ON public.student_habit_selection_events
  FOR ALL USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

COMMENT ON TABLE public.student_habit_selection_events IS
  'Cuándo se asigna o saca un hábito del alumno. Sin filas retroactivas: el historial completo cuenta desde esta migración/app.';
