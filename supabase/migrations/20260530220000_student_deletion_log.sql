-- Historial de alumnos/pacientes eliminados (visibilidad para co-profesionales del plan Full).

CREATE TABLE IF NOT EXISTS public.student_deletion_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            uuid NOT NULL,
  primary_owner_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at            timestamptz NOT NULL DEFAULT now(),
  full_name             text NOT NULL,
  email                 text,
  phone                 text,
  status                text,
  selected_web_plan_slug text,
  shared_owner_ids      uuid[] NOT NULL DEFAULT '{}',
  snapshot              jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_student_deletion_log_deleted_at
  ON public.student_deletion_log(deleted_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_deletion_log_shared_owners
  ON public.student_deletion_log USING gin(shared_owner_ids);

COMMENT ON TABLE public.student_deletion_log IS
  'Snapshot al eliminar un alumno/paciente; visible para dueño primario y profesionales en student_owners.';

CREATE OR REPLACE FUNCTION public.log_student_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shared uuid[];
BEGIN
  SELECT COALESCE(array_agg(so.owner_id ORDER BY so.owner_id), '{}'::uuid[])
  INTO v_shared
  FROM public.student_owners so
  WHERE so.student_id = OLD.id;

  INSERT INTO public.student_deletion_log (
    student_id,
    primary_owner_id,
    deleted_by,
    full_name,
    email,
    phone,
    status,
    selected_web_plan_slug,
    shared_owner_ids,
    snapshot
  ) VALUES (
    OLD.id,
    OLD.owner_id,
    auth.uid(),
    OLD.full_name,
    OLD.email,
    OLD.phone,
    OLD.status::text,
    OLD.selected_web_plan_slug,
    v_shared,
    jsonb_build_object(
      'birth_date', OLD.birth_date,
      'level', OLD.level,
      'plan_end_date', OLD.plan_end_date,
      'notes', LEFT(COALESCE(OLD.notes, ''), 500)
    )
  );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_student_deletion ON public.students;
CREATE TRIGGER trg_log_student_deletion
  BEFORE DELETE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.log_student_deletion();

ALTER TABLE public.student_deletion_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_deletion_log_select ON public.student_deletion_log;
CREATE POLICY student_deletion_log_select ON public.student_deletion_log
  FOR SELECT TO authenticated
  USING (
    public.has_any_role(ARRAY['admin', 'trainer', 'nutritionist']::public.app_role[])
    AND deleted_by IS NOT NULL
    AND (
      primary_owner_id = auth.uid()
      OR deleted_by = auth.uid()
      OR auth.uid() = ANY(shared_owner_ids)
    )
  );

CREATE OR REPLACE FUNCTION public.list_my_student_deletions()
RETURNS TABLE (
  id uuid,
  student_id uuid,
  full_name text,
  email text,
  phone text,
  status text,
  deleted_at timestamptz,
  deleted_by uuid,
  deleted_by_name text,
  primary_owner_id uuid,
  primary_owner_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    d.student_id,
    d.full_name,
    d.email,
    d.phone,
    d.status,
    d.deleted_at,
    d.deleted_by,
    dp.full_name AS deleted_by_name,
    d.primary_owner_id,
    po.full_name AS primary_owner_name
  FROM public.student_deletion_log d
  LEFT JOIN public.profiles dp ON dp.id = d.deleted_by
  LEFT JOIN public.profiles po ON po.id = d.primary_owner_id
  WHERE public.has_any_role(ARRAY['admin', 'trainer', 'nutritionist']::public.app_role[])
    AND d.deleted_by IS NOT NULL
    AND (
      d.primary_owner_id = auth.uid()
      OR d.deleted_by = auth.uid()
      OR auth.uid() = ANY(d.shared_owner_ids)
    )
  ORDER BY d.deleted_at DESC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.list_my_student_deletions() TO authenticated;

-- Refrescar cache de PostgREST (Supabase) para que el RPC aparezca de inmediato.
NOTIFY pgrst, 'reload schema';
