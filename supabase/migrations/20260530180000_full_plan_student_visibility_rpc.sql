-- Plan Full: visibilidad entrenador + nutricionista (idempotente; corre aunque falte la migración 20260508120000).

CREATE TABLE IF NOT EXISTS public.student_owners (
  student_id        uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  owner_id          uuid NOT NULL,
  professional_type text NOT NULL CHECK (professional_type IN ('trainer', 'nutritionist')),
  added_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_student_owners_owner ON public.student_owners(owner_id);
CREATE INDEX IF NOT EXISTS idx_student_owners_student ON public.student_owners(student_id);

ALTER TABLE public.student_owners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_owners_select_own ON public.student_owners;
CREATE POLICY student_owners_select_own ON public.student_owners
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.has_any_role(ARRAY['admin']::public.app_role[])
  );

DROP POLICY IF EXISTS student_owners_insert_staff ON public.student_owners;
CREATE POLICY student_owners_insert_staff ON public.student_owners
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_role(ARRAY['admin', 'trainer', 'nutritionist']::public.app_role[])
  );

DROP POLICY IF EXISTS student_owners_delete_staff ON public.student_owners;
CREATE POLICY student_owners_delete_staff ON public.student_owners
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.has_any_role(ARRAY['admin']::public.app_role[])
  );

DROP POLICY IF EXISTS students_shared_select ON public.students;
CREATE POLICY students_shared_select ON public.students
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT student_id FROM public.student_owners WHERE owner_id = auth.uid()
    )
  );

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

-- RPC: lista alumnos/pacientes del profesional (dueño directo o vía plan Full).
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
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.list_my_students() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_students() TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_student(uuid) TO authenticated;
