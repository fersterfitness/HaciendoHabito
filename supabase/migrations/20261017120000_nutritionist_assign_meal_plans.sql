-- El nutricionista también asigna planes al paciente (antes solo entrenador / admin).
-- Es la tabla que lee el paciente en «Mi plan de alimentación»: así el plan armado
-- en «Armar plan» le llega al paciente sin depender del PDF.

DROP POLICY IF EXISTS trainer_student_meal_plans_trainer_rw ON public.trainer_student_meal_plans;
CREATE POLICY trainer_student_meal_plans_trainer_rw ON public.trainer_student_meal_plans
  FOR ALL TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['trainer', 'admin', 'nutritionist']::public.app_role[])
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
        AND p.role = ANY (ARRAY['trainer', 'admin', 'nutritionist']::public.app_role[])
    )
  );
