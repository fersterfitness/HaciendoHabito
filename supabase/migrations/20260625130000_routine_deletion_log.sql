-- Historial de rutinas eliminadas (snapshot completo: bloques, días y ejercicios).

CREATE TABLE IF NOT EXISTS public.routine_deletion_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id      uuid NOT NULL,
  owner_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id      uuid NOT NULL,
  deleted_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at      timestamptz NOT NULL DEFAULT now(),
  routine_name    text NOT NULL,
  student_name    text,
  objective       text,
  level           text,
  status          text,
  start_date      date,
  end_date        date,
  snapshot        jsonb NOT NULL DEFAULT '{}'::jsonb,
  restored_at     timestamptz,
  restored_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_routine_deletion_log_deleted_at
  ON public.routine_deletion_log(deleted_at DESC);

CREATE INDEX IF NOT EXISTS idx_routine_deletion_log_owner_active
  ON public.routine_deletion_log(owner_id, deleted_at DESC)
  WHERE restored_at IS NULL;

COMMENT ON TABLE public.routine_deletion_log IS
  'Snapshot al eliminar una rutina; permite restaurar bloques, días y ejercicios.';

CREATE OR REPLACE FUNCTION public.log_routine_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot jsonb;
  v_student_name text;
BEGIN
  SELECT s.full_name INTO v_student_name
  FROM public.students s
  WHERE s.id = OLD.student_id;

  SELECT jsonb_build_object(
    'routine', to_jsonb(OLD),
    'blocks', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'block', to_jsonb(b),
          'days', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'day', to_jsonb(d),
                'exercises', COALESCE((
                  SELECT jsonb_agg(to_jsonb(e) ORDER BY e.sort_order, e.id)
                  FROM public.routine_exercises e
                  WHERE e.day_id = d.id
                ), '[]'::jsonb)
              )
              ORDER BY d.sort_order, d.id
            )
            FROM public.routine_days d
            WHERE d.block_id = b.id
          ), '[]'::jsonb)
        )
        ORDER BY b.sort_order, b.id
      )
      FROM public.routine_blocks b
      WHERE b.routine_id = OLD.id
    ), '[]'::jsonb)
  )
  INTO v_snapshot;

  INSERT INTO public.routine_deletion_log (
    routine_id,
    owner_id,
    student_id,
    deleted_by,
    routine_name,
    student_name,
    objective,
    level,
    status,
    start_date,
    end_date,
    snapshot
  ) VALUES (
    OLD.id,
    OLD.owner_id,
    OLD.student_id,
    auth.uid(),
    OLD.name,
    v_student_name,
    OLD.objective,
    OLD.level::text,
    OLD.status::text,
    OLD.start_date,
    OLD.end_date,
    v_snapshot
  );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_routine_deletion ON public.routines;
CREATE TRIGGER trg_log_routine_deletion
  BEFORE DELETE ON public.routines
  FOR EACH ROW
  EXECUTE FUNCTION public.log_routine_deletion();

ALTER TABLE public.routine_deletion_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS routine_deletion_log_select ON public.routine_deletion_log;
CREATE POLICY routine_deletion_log_select ON public.routine_deletion_log
  FOR SELECT TO authenticated
  USING (
    public.has_any_role(ARRAY['admin', 'trainer']::public.app_role[])
    AND deleted_by IS NOT NULL
    AND owner_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.list_my_routine_deletions()
RETURNS TABLE (
  id uuid,
  routine_id uuid,
  routine_name text,
  student_id uuid,
  student_name text,
  objective text,
  level text,
  status text,
  start_date date,
  end_date date,
  deleted_at timestamptz,
  deleted_by uuid,
  deleted_by_name text,
  can_restore boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    d.routine_id,
    d.routine_name,
    d.student_id,
    d.student_name,
    d.objective,
    d.level,
    d.status,
    d.start_date,
    d.end_date,
    d.deleted_at,
    d.deleted_by,
    dp.full_name AS deleted_by_name,
    (
      d.restored_at IS NULL
      AND d.owner_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = d.student_id)
    ) AS can_restore
  FROM public.routine_deletion_log d
  LEFT JOIN public.profiles dp ON dp.id = d.deleted_by
  WHERE public.has_any_role(ARRAY['admin', 'trainer']::public.app_role[])
    AND d.deleted_by IS NOT NULL
    AND d.restored_at IS NULL
    AND d.owner_id = auth.uid()
  ORDER BY d.deleted_at DESC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.list_my_routine_deletions() TO authenticated;

NOTIFY pgrst, 'reload schema';
