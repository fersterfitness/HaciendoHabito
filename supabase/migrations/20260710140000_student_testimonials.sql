-- Feedback mensual / testimonios del alumno (para redes).
-- El entrenador pide el feedback (WhatsApp) y guarda acá la respuesta del alumno.

CREATE TABLE IF NOT EXISTS public.student_testimonials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  period_label  text NOT NULL,
  content       text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.student_testimonials.period_label IS 'Mes/período al que corresponde el feedback (ej. "Julio 2026").';

CREATE INDEX IF NOT EXISTS idx_student_testimonials_student
  ON public.student_testimonials(student_id, created_at DESC);

DROP TRIGGER IF EXISTS set_updated_at ON public.student_testimonials;
SELECT public.set_updated_at('student_testimonials');

ALTER TABLE public.student_testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_testimonials_trainer_admin ON public.student_testimonials;
CREATE POLICY student_testimonials_trainer_admin ON public.student_testimonials
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() AND public.has_any_role(ARRAY['admin','trainer']::public.app_role[]))
  WITH CHECK (owner_id = auth.uid() AND public.has_any_role(ARRAY['admin','trainer']::public.app_role[]));
