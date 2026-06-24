-- Plan Full: el nutricionista comparte alumno vía student_owners pero no es owner_id primario.
-- Permite actualizar la ficha cuando el profesional está en student_owners.

DROP POLICY IF EXISTS students_shared_update ON public.students;
CREATE POLICY students_shared_update ON public.students
  FOR UPDATE TO authenticated
  USING (
    id IN (SELECT student_id FROM public.student_owners WHERE owner_id = auth.uid())
    AND public.has_any_role(ARRAY['admin','trainer','nutritionist']::public.app_role[])
  )
  WITH CHECK (
    id IN (SELECT student_id FROM public.student_owners WHERE owner_id = auth.uid())
    AND public.has_any_role(ARRAY['admin','trainer','nutritionist']::public.app_role[])
  );

-- Backfill: registros Full que quedaron solo con owner_id del entrenador.
INSERT INTO public.student_owners (student_id, owner_id, professional_type)
SELECT s.id, s.owner_id, 'trainer'
FROM public.students s
WHERE (
  s.selected_web_plan_slug = 'plan-full'
  OR (s.intake_nutrition IS NOT NULL AND s.intake_nutrition->>'form_type' = 'full')
)
AND NOT EXISTS (
  SELECT 1 FROM public.student_owners so
  WHERE so.student_id = s.id AND so.owner_id = s.owner_id
)
ON CONFLICT (student_id, owner_id) DO NOTHING;

INSERT INTO public.student_owners (student_id, owner_id, professional_type)
SELECT s.id, p.id, 'nutritionist'
FROM public.students s
CROSS JOIN LATERAL (
  SELECT id FROM public.profiles
  WHERE role = 'nutritionist'
  ORDER BY created_at
  LIMIT 1
) p
WHERE (
  s.selected_web_plan_slug = 'plan-full'
  OR (s.intake_nutrition IS NOT NULL AND s.intake_nutrition->>'form_type' = 'full')
)
AND NOT EXISTS (
  SELECT 1 FROM public.student_owners so
  WHERE so.student_id = s.id AND so.professional_type = 'nutritionist'
)
ON CONFLICT (student_id, owner_id) DO NOTHING;
