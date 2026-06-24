-- Restaurar rutina completa desde routine_deletion_log (mismo routine_id).

CREATE OR REPLACE FUNCTION public.restore_deleted_routine(p_deletion_log_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log public.routine_deletion_log%ROWTYPE;
  v_routine jsonb;
  v_block jsonb;
  v_day_wrap jsonb;
  v_ex jsonb;
  v_blocks jsonb;
  v_days jsonb;
  v_exercises jsonb;
BEGIN
  IF NOT public.has_any_role(ARRAY['admin', 'trainer']::public.app_role[]) THEN
    RAISE EXCEPTION 'No tenés permiso para restaurar rutinas';
  END IF;

  SELECT *
  INTO v_log
  FROM public.routine_deletion_log d
  WHERE d.id = p_deletion_log_id
    AND d.restored_at IS NULL
    AND d.deleted_by IS NOT NULL
    AND d.owner_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro no encontrado o ya restaurado';
  END IF;

  IF EXISTS (SELECT 1 FROM public.routines r WHERE r.id = v_log.routine_id) THEN
    RAISE EXCEPTION 'Ya existe una rutina con ese identificador';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.students s WHERE s.id = v_log.student_id) THEN
    RAISE EXCEPTION 'El alumno de esta rutina ya no existe; no se puede restaurar';
  END IF;

  v_routine := v_log.snapshot->'routine';
  IF v_routine IS NULL OR v_routine = 'null'::jsonb THEN
    RAISE EXCEPTION 'Snapshot de rutina inválido';
  END IF;

  INSERT INTO public.routines (
    id,
    owner_id,
    student_id,
    student_plan_id,
    name,
    objective,
    level,
    start_date,
    end_date,
    duration_days,
    price,
    status,
    notes,
    last_status_change,
    created_at,
    updated_at
  ) VALUES (
    (v_routine->>'id')::uuid,
    (v_routine->>'owner_id')::uuid,
    (v_routine->>'student_id')::uuid,
    NULLIF(v_routine->>'student_plan_id', '')::uuid,
    v_routine->>'name',
    v_routine->>'objective',
    COALESCE(NULLIF(v_routine->>'level', '')::public.student_level, 'inicial'::public.student_level),
    (v_routine->>'start_date')::date,
    (v_routine->>'end_date')::date,
    (v_routine->>'duration_days')::int,
    COALESCE(NULLIF(v_routine->>'price', '')::numeric, 0),
    COALESCE(NULLIF(v_routine->>'status', '')::public.routine_status, 'activa'::public.routine_status),
    v_routine->>'notes',
    NULLIF(v_routine->>'last_status_change', '')::timestamptz,
    COALESCE(NULLIF(v_routine->>'created_at', '')::timestamptz, v_log.deleted_at),
    now()
  );

  v_blocks := COALESCE(v_log.snapshot->'blocks', '[]'::jsonb);
  FOR v_block IN SELECT * FROM jsonb_array_elements(v_blocks)
  LOOP
    INSERT INTO public.routine_blocks (id, routine_id, name, sort_order, notes)
    VALUES (
      (v_block->'block'->>'id')::uuid,
      (v_block->'block'->>'routine_id')::uuid,
      v_block->'block'->>'name',
      COALESCE((v_block->'block'->>'sort_order')::int, 0),
      v_block->'block'->>'notes'
    );

    v_days := COALESCE(v_block->'days', '[]'::jsonb);
    FOR v_day_wrap IN SELECT * FROM jsonb_array_elements(v_days)
    LOOP
      INSERT INTO public.routine_days (id, block_id, day_name, day_of_week, muscle_focus, warmup_notes, sort_order)
      VALUES (
        (v_day_wrap->'day'->>'id')::uuid,
        (v_day_wrap->'day'->>'block_id')::uuid,
        v_day_wrap->'day'->>'day_name',
        NULLIF(v_day_wrap->'day'->>'day_of_week', '')::int,
        v_day_wrap->'day'->>'muscle_focus',
        v_day_wrap->'day'->>'warmup_notes',
        COALESCE((v_day_wrap->'day'->>'sort_order')::int, 0)
      );

      v_exercises := COALESCE(v_day_wrap->'exercises', '[]'::jsonb);
      FOR v_ex IN SELECT * FROM jsonb_array_elements(v_exercises)
      LOOP
        INSERT INTO public.routine_exercises (
          id, day_id, exercise_id, sort_order, sets, reps_min, reps_max,
          weight_kg, rir, rpe, rest_seconds, tempo, video_url,
          technical_notes, is_superset, superset_group
        ) VALUES (
          (v_ex->>'id')::uuid,
          (v_ex->>'day_id')::uuid,
          (v_ex->>'exercise_id')::uuid,
          COALESCE((v_ex->>'sort_order')::int, 0),
          NULLIF(v_ex->>'sets', '')::int,
          NULLIF(v_ex->>'reps_min', '')::int,
          NULLIF(v_ex->>'reps_max', '')::int,
          NULLIF(v_ex->>'weight_kg', '')::numeric,
          NULLIF(v_ex->>'rir', '')::int,
          NULLIF(v_ex->>'rpe', '')::numeric,
          NULLIF(v_ex->>'rest_seconds', '')::int,
          v_ex->>'tempo',
          v_ex->>'video_url',
          v_ex->>'technical_notes',
          COALESCE((v_ex->>'is_superset')::boolean, false),
          NULLIF(v_ex->>'superset_group', '')::int
        );
      END LOOP;
    END LOOP;
  END LOOP;

  UPDATE public.routine_deletion_log
  SET restored_at = now(),
      restored_by = auth.uid()
  WHERE id = v_log.id;

  RETURN v_log.routine_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_deleted_routine(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
