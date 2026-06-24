-- Plan Full: cualquier nutricionista/admin ve pacientes Full aunque falle student_owners al intake.

CREATE OR REPLACE FUNCTION public.list_my_students()
RETURNS SETOF public.students
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.*
  FROM public.students s
  WHERE public.has_any_role(ARRAY['admin','trainer','nutritionist']::public.app_role[])
    AND (
      s.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.student_owners so
        WHERE so.student_id = s.id AND so.owner_id = auth.uid()
      )
      OR (
        public.has_any_role(ARRAY['nutritionist','admin']::public.app_role[])
        AND (
          s.selected_web_plan_slug = 'plan-full'
          OR (s.intake_nutrition IS NOT NULL AND s.intake_nutrition->>'form_type' = 'full')
        )
      )
    )
  ORDER BY s.full_name ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_my_student(p_student_id uuid)
RETURNS public.students
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.*
  FROM public.students s
  WHERE s.id = p_student_id
    AND public.has_any_role(ARRAY['admin','trainer','nutritionist']::public.app_role[])
    AND (
      s.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.student_owners so
        WHERE so.student_id = s.id AND so.owner_id = auth.uid()
      )
      OR (
        public.has_any_role(ARRAY['nutritionist','admin']::public.app_role[])
        AND (
          s.selected_web_plan_slug = 'plan-full'
          OR (s.intake_nutrition IS NOT NULL AND s.intake_nutrition->>'form_type' = 'full')
        )
      )
    )
  LIMIT 1;
$$;

DROP POLICY IF EXISTS students_full_plan_nutritionist_select ON public.students;
CREATE POLICY students_full_plan_nutritionist_select ON public.students
  FOR SELECT TO authenticated
  USING (
    public.has_any_role(ARRAY['nutritionist','admin']::public.app_role[])
    AND (
      selected_web_plan_slug = 'plan-full'
      OR (intake_nutrition IS NOT NULL AND intake_nutrition->>'form_type' = 'full')
    )
  );

-- Reparar vínculos student_owners para registros Full existentes.
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
