-- Guarda plan web elegido en el perfil del alumno.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS selected_web_plan_slug text REFERENCES public.web_plans(slug) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_selected_web_plan_slug
  ON public.students(selected_web_plan_slug);
