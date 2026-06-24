-- Psicólogo: ver y editar alumnos donde es owner_id (+ RPC list_my_students / get_my_student).

DROP POLICY IF EXISTS students_owner_read ON public.students;
CREATE POLICY students_owner_read ON public.students
  FOR SELECT USING (
    owner_id = auth.uid()
    AND public.has_any_role(ARRAY['admin','trainer','nutritionist','psychologist']::public.app_role[])
  );

DROP POLICY IF EXISTS students_owner_write ON public.students;
CREATE POLICY students_owner_write ON public.students
  FOR ALL USING (
    owner_id = auth.uid()
    AND public.has_any_role(ARRAY['admin','trainer','nutritionist','psychologist']::public.app_role[])
  )
  WITH CHECK (
    owner_id = auth.uid()
    AND public.has_any_role(ARRAY['admin','trainer','nutritionist','psychologist']::public.app_role[])
  );

CREATE OR REPLACE FUNCTION public.list_my_students()
RETURNS SETOF public.students
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.*
  FROM public.students s
  WHERE public.has_any_role(ARRAY['admin','trainer','nutritionist','psychologist']::public.app_role[])
    AND (
      s.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.student_owners so
        WHERE so.student_id = s.id AND so.owner_id = auth.uid()
      )
      OR (
        public.has_any_role(ARRAY['nutritionist','admin']::public.app_role[])
        AND public.student_is_full_plan(s)
      )
    )
  ORDER BY s.full_name ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_my_student(p_student_id uuid)
RETURNS SETOF public.students
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.*
  FROM public.students s
  WHERE s.id = p_student_id
    AND public.has_any_role(ARRAY['admin','trainer','nutritionist','psychologist']::public.app_role[])
    AND (
      s.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.student_owners so
        WHERE so.student_id = s.id AND so.owner_id = auth.uid()
      )
      OR (
        public.has_any_role(ARRAY['nutritionist','admin']::public.app_role[])
        AND public.student_is_full_plan(s)
      )
    );
$$;

NOTIFY pgrst, 'reload schema';
