-- get_my_student: PostgREST devolvía fila con id=null cuando no había match (RETURNS students).
-- SETOF + sin fila es más compatible con el cliente Supabase.

DROP FUNCTION IF EXISTS public.get_my_student(uuid);

CREATE FUNCTION public.get_my_student(p_student_id uuid)
RETURNS SETOF public.students
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
        SELECT 1 FROM public.student_owners so
        WHERE so.student_id = s.id AND so.owner_id = auth.uid()
      )
      OR (
        public.has_any_role(ARRAY['nutritionist','admin']::public.app_role[])
        AND public.student_is_full_plan(s)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.get_my_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_student(uuid) TO authenticated;
