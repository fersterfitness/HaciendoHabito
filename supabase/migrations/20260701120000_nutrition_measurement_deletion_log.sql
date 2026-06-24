-- Historial de antropometrías eliminadas (snapshot completo de la medición).
-- Permite ver las eliminadas y restaurarlas con el mismo id.

CREATE TABLE IF NOT EXISTS public.nutrition_measurement_deletion_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id      uuid NOT NULL,
  owner_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id          uuid NOT NULL,
  deleted_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at          timestamptz NOT NULL DEFAULT now(),
  student_name        text,
  measured_at         timestamptz,
  measurement_number  integer,
  weight_kg           numeric,
  bmi                 numeric,
  body_fat_pct        numeric,
  muscle_mass_kg      numeric,
  snapshot            jsonb NOT NULL DEFAULT '{}'::jsonb,
  restored_at         timestamptz,
  restored_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_nutrition_measurement_deletion_log_deleted_at
  ON public.nutrition_measurement_deletion_log(deleted_at DESC);

CREATE INDEX IF NOT EXISTS idx_nutrition_measurement_deletion_log_owner_active
  ON public.nutrition_measurement_deletion_log(owner_id, student_id, deleted_at DESC)
  WHERE restored_at IS NULL;

COMMENT ON TABLE public.nutrition_measurement_deletion_log IS
  'Snapshot al eliminar una antropometría; permite ver el historial y restaurarla.';

CREATE OR REPLACE FUNCTION public.log_nutrition_measurement_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_name text;
BEGIN
  SELECT s.full_name INTO v_student_name
  FROM public.students s
  WHERE s.id = OLD.student_id;

  INSERT INTO public.nutrition_measurement_deletion_log (
    measurement_id,
    owner_id,
    student_id,
    deleted_by,
    student_name,
    measured_at,
    measurement_number,
    weight_kg,
    bmi,
    body_fat_pct,
    muscle_mass_kg,
    snapshot
  ) VALUES (
    OLD.id,
    OLD.owner_id,
    OLD.student_id,
    auth.uid(),
    v_student_name,
    OLD.measured_at,
    OLD.measurement_number,
    OLD.weight_kg,
    OLD.bmi,
    OLD.body_fat_pct,
    OLD.muscle_mass_kg,
    to_jsonb(OLD)
  );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_nutrition_measurement_deletion ON public.nutrition_measurements;
CREATE TRIGGER trg_log_nutrition_measurement_deletion
  BEFORE DELETE ON public.nutrition_measurements
  FOR EACH ROW
  EXECUTE FUNCTION public.log_nutrition_measurement_deletion();

ALTER TABLE public.nutrition_measurement_deletion_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nutrition_measurement_deletion_log_select ON public.nutrition_measurement_deletion_log;
CREATE POLICY nutrition_measurement_deletion_log_select ON public.nutrition_measurement_deletion_log
  FOR SELECT TO authenticated
  USING (
    public.has_any_role(ARRAY['admin', 'nutritionist']::public.app_role[])
    AND deleted_by IS NOT NULL
    AND owner_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.list_my_nutrition_measurement_deletions(
  p_student_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  measurement_id uuid,
  student_id uuid,
  student_name text,
  measured_at timestamptz,
  measurement_number integer,
  weight_kg numeric,
  bmi numeric,
  body_fat_pct numeric,
  muscle_mass_kg numeric,
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
    d.measurement_id,
    d.student_id,
    d.student_name,
    d.measured_at,
    d.measurement_number,
    d.weight_kg,
    d.bmi,
    d.body_fat_pct,
    d.muscle_mass_kg,
    d.deleted_at,
    d.deleted_by,
    dp.full_name AS deleted_by_name,
    (
      d.restored_at IS NULL
      AND d.owner_id = auth.uid()
      AND NOT EXISTS (
        SELECT 1 FROM public.nutrition_measurements m WHERE m.id = d.measurement_id
      )
    ) AS can_restore
  FROM public.nutrition_measurement_deletion_log d
  LEFT JOIN public.profiles dp ON dp.id = d.deleted_by
  WHERE public.has_any_role(ARRAY['admin', 'nutritionist']::public.app_role[])
    AND d.deleted_by IS NOT NULL
    AND d.restored_at IS NULL
    AND d.owner_id = auth.uid()
    AND (p_student_id IS NULL OR d.student_id = p_student_id)
  ORDER BY d.deleted_at DESC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.list_my_nutrition_measurement_deletions(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_deleted_nutrition_measurement(p_deletion_log_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log public.nutrition_measurement_deletion_log%ROWTYPE;
  v_row jsonb;
BEGIN
  IF NOT public.has_any_role(ARRAY['admin', 'nutritionist']::public.app_role[]) THEN
    RAISE EXCEPTION 'No tenés permiso para restaurar antropometrías';
  END IF;

  SELECT *
  INTO v_log
  FROM public.nutrition_measurement_deletion_log d
  WHERE d.id = p_deletion_log_id
    AND d.restored_at IS NULL
    AND d.deleted_by IS NOT NULL
    AND d.owner_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro no encontrado o ya restaurado';
  END IF;

  IF EXISTS (SELECT 1 FROM public.nutrition_measurements m WHERE m.id = v_log.measurement_id) THEN
    RAISE EXCEPTION 'Ya existe una medición con ese identificador';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.students s WHERE s.id = v_log.student_id) THEN
    RAISE EXCEPTION 'El paciente de esta medición ya no existe; no se puede restaurar';
  END IF;

  v_row := v_log.snapshot;
  IF v_row IS NULL OR v_row = 'null'::jsonb THEN
    RAISE EXCEPTION 'Snapshot de medición inválido';
  END IF;

  INSERT INTO public.nutrition_measurements (
    id,
    owner_id,
    student_id,
    measured_at,
    weight_kg,
    bmi,
    body_fat_pct,
    muscle_mass_kg,
    perimeters_notes,
    skinfolds_notes,
    notes,
    measurement_number,
    height_cm,
    sitting_height_cm,
    detail,
    created_at
  ) VALUES (
    (v_row->>'id')::uuid,
    (v_row->>'owner_id')::uuid,
    (v_row->>'student_id')::uuid,
    (v_row->>'measured_at')::timestamptz,
    NULLIF(v_row->>'weight_kg', '')::numeric,
    NULLIF(v_row->>'bmi', '')::numeric,
    NULLIF(v_row->>'body_fat_pct', '')::numeric,
    NULLIF(v_row->>'muscle_mass_kg', '')::numeric,
    v_row->>'perimeters_notes',
    v_row->>'skinfolds_notes',
    v_row->>'notes',
    NULLIF(v_row->>'measurement_number', '')::integer,
    NULLIF(v_row->>'height_cm', '')::numeric,
    NULLIF(v_row->>'sitting_height_cm', '')::numeric,
    COALESCE(v_row->'detail', '{}'::jsonb),
    COALESCE(NULLIF(v_row->>'created_at', '')::timestamptz, v_log.deleted_at)
  );

  UPDATE public.nutrition_measurement_deletion_log
  SET restored_at = now(),
      restored_by = auth.uid()
  WHERE id = v_log.id;

  RETURN v_log.measurement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_deleted_nutrition_measurement(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
