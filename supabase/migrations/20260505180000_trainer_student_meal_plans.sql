-- Planes tipo Excel HH asignados por entrenador a alumnos (varios por alumno). Independiente del flujo nutricionista clínico.

CREATE TABLE IF NOT EXISTS public.trainer_student_meal_plans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id        uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  title             text NOT NULL DEFAULT 'Plan de alimentación',
  data              jsonb NOT NULL DEFAULT '{}',
  cloned_from_id    uuid REFERENCES public.trainer_student_meal_plans(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_updated_at ON public.trainer_student_meal_plans;
SELECT public.set_updated_at('trainer_student_meal_plans');

CREATE INDEX IF NOT EXISTS idx_trainer_student_meal_plans_owner_student
  ON public.trainer_student_meal_plans(owner_id, student_id);
CREATE INDEX IF NOT EXISTS idx_trainer_student_meal_plans_student
  ON public.trainer_student_meal_plans(student_id);

ALTER TABLE public.trainer_student_meal_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trainer_student_meal_plans_trainer_rw ON public.trainer_student_meal_plans;
CREATE POLICY trainer_student_meal_plans_trainer_rw ON public.trainer_student_meal_plans
  FOR ALL TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['trainer', 'admin']::public.app_role[])
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id AND s.owner_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['trainer', 'admin']::public.app_role[])
    )
  );

DROP POLICY IF EXISTS trainer_student_meal_plans_student_read ON public.trainer_student_meal_plans;
CREATE POLICY trainer_student_meal_plans_student_read ON public.trainer_student_meal_plans
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id
        AND s.profile_id = auth.uid()
    )
  );
