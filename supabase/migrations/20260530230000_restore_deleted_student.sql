-- Restaurar ficha básica de alumno/paciente desde student_deletion_log (no rutinas ni datos clínicos).

ALTER TABLE public.student_deletion_log
  ADD COLUMN IF NOT EXISTS restored_at timestamptz,
  ADD COLUMN IF NOT EXISTS restored_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_student_deletion_log_active
  ON public.student_deletion_log(deleted_at DESC)
  WHERE restored_at IS NULL;

-- Snapshot más completo para restauraciones futuras.
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
      'notes', OLD.notes,
      'gender', OLD.gender,
      'document_id', OLD.document_id,
      'address', OLD.address,
      'weight_kg', OLD.weight_kg,
      'height_cm', OLD.height_cm,
      'profile_id', OLD.profile_id,
      'avatar_path', OLD.avatar_path,
      'intake_ferster', OLD.intake_ferster,
      'intake_nutrition', OLD.intake_nutrition,
      'created_at', OLD.created_at
    )
  );

  RETURN OLD;
END;
$$;

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
  primary_owner_name text,
  can_restore boolean
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
    po.full_name AS primary_owner_name,
    (
      d.restored_at IS NULL
      AND (
        d.primary_owner_id = auth.uid()
        OR public.has_any_role(ARRAY['admin']::public.app_role[])
      )
    ) AS can_restore
  FROM public.student_deletion_log d
  LEFT JOIN public.profiles dp ON dp.id = d.deleted_by
  LEFT JOIN public.profiles po ON po.id = d.primary_owner_id
  WHERE public.has_any_role(ARRAY['admin', 'trainer', 'nutritionist']::public.app_role[])
    AND d.deleted_by IS NOT NULL
    AND d.restored_at IS NULL
    AND (
      d.primary_owner_id = auth.uid()
      OR d.deleted_by = auth.uid()
      OR auth.uid() = ANY(d.shared_owner_ids)
    )
  ORDER BY d.deleted_at DESC
  LIMIT 200;
$$;

CREATE OR REPLACE FUNCTION public.restore_deleted_student(p_deletion_log_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log public.student_deletion_log%ROWTYPE;
  v_owner uuid;
  v_level public.student_level;
  v_status public.student_status;
  v_avatar_path text;
BEGIN
  IF NOT public.has_any_role(ARRAY['admin', 'trainer']::public.app_role[]) THEN
    RAISE EXCEPTION 'No tenés permiso para restaurar alumnos';
  END IF;

  SELECT *
  INTO v_log
  FROM public.student_deletion_log d
  WHERE d.id = p_deletion_log_id
    AND d.restored_at IS NULL
    AND d.deleted_by IS NOT NULL
    AND (
      d.primary_owner_id = auth.uid()
      OR public.has_any_role(ARRAY['admin']::public.app_role[])
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de eliminación no encontrado o ya restaurado';
  END IF;

  IF EXISTS (SELECT 1 FROM public.students s WHERE s.id = v_log.student_id) THEN
    RAISE EXCEPTION 'Ya existe un alumno/paciente con ese identificador';
  END IF;

  v_level := COALESCE(
    NULLIF(v_log.snapshot->>'level', '')::public.student_level,
    'inicial'::public.student_level
  );
  v_status := COALESCE(
    NULLIF(v_log.status, '')::public.student_status,
    'activo'::public.student_status
  );

  v_avatar_path := NULLIF(v_log.snapshot->>'avatar_path', '');
  IF v_avatar_path IS NULL THEN
    SELECT o.name INTO v_avatar_path
    FROM storage.objects o
    WHERE o.bucket_id = 'student-avatars'
      AND o.name LIKE v_log.student_id::text || '/avatar.%'
    ORDER BY o.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  INSERT INTO public.students (
    id,
    owner_id,
    profile_id,
    full_name,
    email,
    phone,
    birth_date,
    level,
    gender,
    status,
    notes,
    document_id,
    address,
    weight_kg,
    height_cm,
    selected_web_plan_slug,
    intake_ferster,
    intake_nutrition,
    avatar_path,
    plan_end_date,
    created_at
  ) VALUES (
    v_log.student_id,
    v_log.primary_owner_id,
    NULLIF(v_log.snapshot->>'profile_id', '')::uuid,
    v_log.full_name,
    v_log.email,
    v_log.phone,
    NULLIF(v_log.snapshot->>'birth_date', '')::date,
    v_level,
    NULLIF(v_log.snapshot->>'gender', ''),
    v_status,
    v_log.snapshot->>'notes',
    NULLIF(v_log.snapshot->>'document_id', ''),
    NULLIF(v_log.snapshot->>'address', ''),
    NULLIF(v_log.snapshot->>'weight_kg', '')::numeric,
    NULLIF(v_log.snapshot->>'height_cm', '')::numeric,
    v_log.selected_web_plan_slug,
    v_log.snapshot->'intake_ferster',
    v_log.snapshot->'intake_nutrition',
    v_avatar_path,
    NULLIF(v_log.snapshot->>'plan_end_date', '')::date,
    COALESCE(NULLIF(v_log.snapshot->>'created_at', '')::timestamptz, v_log.deleted_at)
  );

  FOREACH v_owner IN ARRAY v_log.shared_owner_ids LOOP
    INSERT INTO public.student_owners (student_id, owner_id, professional_type)
    VALUES (
      v_log.student_id,
      v_owner,
      CASE
        WHEN v_owner = v_log.primary_owner_id THEN 'trainer'
        WHEN EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = v_owner AND p.role = 'nutritionist'
        ) THEN 'nutritionist'
        ELSE 'trainer'
      END
    )
    ON CONFLICT (student_id, owner_id) DO NOTHING;
  END LOOP;

  UPDATE public.student_deletion_log
  SET restored_at = now(),
      restored_by = auth.uid()
  WHERE id = v_log.id;

  RETURN v_log.student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_deleted_student(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
