-- Link público del plan alimentario (v2): la nutricionista comparte un link por paciente y el
-- paciente lo abre sin cuenta. El link muestra siempre el plan vigente; generar uno nuevo invalida el anterior.

CREATE TABLE IF NOT EXISTS public.nutrition_plan_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, student_id)
);

COMMENT ON TABLE public.nutrition_plan_shares IS
  'Token del link público del plan alimentario de un paciente (uno por profesional y paciente).';

ALTER TABLE public.nutrition_plan_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nutrition_plan_shares_owner ON public.nutrition_plan_shares;
CREATE POLICY nutrition_plan_shares_owner ON public.nutrition_plan_shares
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Lo que ve el paciente: sólo el plan vigente de quien compartió el link, el nombre de pila y el contacto
-- del profesional. Nada de datos clínicos (peso, edad, mediciones).
CREATE OR REPLACE FUNCTION public.get_shared_nutrition_plan(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_share public.nutrition_plan_shares%ROWTYPE;
  v_first_name text;
  v_pro_name text;
  v_pro_phone text;
  v_plan jsonb;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_share FROM public.nutrition_plan_shares WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT split_part(trim(s.full_name), ' ', 1) INTO v_first_name
    FROM public.students s WHERE s.id = v_share.student_id;

  SELECT p.full_name, p.phone INTO v_pro_name, v_pro_phone
    FROM public.profiles p WHERE p.id = v_share.owner_id;

  -- Plan vigente: la versión activa (o la última); si el paciente es de antes de las versiones, la grilla única.
  SELECT jsonb_build_object(
           'title', v.title,
           'objective', l.objective,
           'merge_weekends', v.merge_weekends,
           'grid', v.grid,
           'total_kcal', v.total_kcal,
           'next_consultation_date', v.next_consultation_date,
           'notes', v.notes,
           'updated_at', v.updated_at)
    INTO v_plan
    FROM public.nutrition_patient_plan_versions v
    LEFT JOIN public.nutrition_plan_library l ON l.id = v.source_library_id
   WHERE v.owner_id = v_share.owner_id AND v.student_id = v_share.student_id
   ORDER BY v.is_active DESC, v.version_number DESC
   LIMIT 1;

  IF v_plan IS NULL THEN
    SELECT jsonb_build_object(
             'title', NULL,
             'objective', NULL,
             'merge_weekends', w.merge_weekends,
             'grid', w.grid,
             'total_kcal', w.total_kcal,
             'next_consultation_date', w.next_consultation_date,
             'notes', NULL,
             'updated_at', w.updated_at)
      INTO v_plan
      FROM public.nutrition_week_schedules w
     WHERE w.owner_id = v_share.owner_id AND w.student_id = v_share.student_id
     LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'patient_first_name', coalesce(v_first_name, ''),
    'professional_name', v_pro_name,
    'professional_phone', v_pro_phone,
    'plan', v_plan);
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_nutrition_plan(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_nutrition_plan(text) TO anon, authenticated;
