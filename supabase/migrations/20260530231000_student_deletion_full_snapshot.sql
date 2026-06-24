-- Snapshot completo al eliminar (incluye datos personales e intake JSON para restaurar bien).

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
