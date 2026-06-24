-- Item 8 · Notas importantes por alumno para la próxima rutina
-- Ej.: "Trabajar movilidad lumbo-pélvica (reportó dolor lumbar en semana 4)".
-- Aparecen marcadas al armar la siguiente rutina y se pueden dar por resueltas.

CREATE TABLE IF NOT EXISTS public.student_routine_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  content     text NOT NULL,
  is_done     boolean NOT NULL DEFAULT false,
  done_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_routine_notes_student
  ON public.student_routine_notes(student_id, is_done, created_at DESC);

DROP TRIGGER IF EXISTS set_updated_at ON public.student_routine_notes;
SELECT public.set_updated_at('student_routine_notes');

ALTER TABLE public.student_routine_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_routine_notes_trainer_admin ON public.student_routine_notes;
CREATE POLICY student_routine_notes_trainer_admin ON public.student_routine_notes
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() AND public.has_any_role(ARRAY['admin','trainer']::public.app_role[]))
  WITH CHECK (owner_id = auth.uid() AND public.has_any_role(ARRAY['admin','trainer']::public.app_role[]));
