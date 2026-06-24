-- Historial de planes asignados a un alumno/paciente.
-- Requiere 20260704115000_app_role_psychologist.sql (enum en migración previa).
-- Cada vez que un alumno se registra o un profesional le asigna un nuevo plan,
-- se inserta una fila. El "plan vigente" es la fila con start_date <= today <= end_date
-- (o la última creada si ninguna cae en ese rango).

CREATE TABLE IF NOT EXISTS public.student_plan_assignments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id           uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  web_plan_slug        text REFERENCES public.web_plans(slug) ON DELETE SET NULL,
  plan_name_snapshot   text NOT NULL,
  billing_period       text NOT NULL CHECK (billing_period IN ('monthly','months3','months6','annual')),
  start_date           date NOT NULL,
  end_date             date NOT NULL,
  payment_status       text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','overdue')),
  assigned_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT student_plan_assignments_dates_chk CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS student_plan_assignments_student_idx
  ON public.student_plan_assignments (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS student_plan_assignments_active_idx
  ON public.student_plan_assignments (student_id, start_date, end_date);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_student_plan_assignments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_plan_assignments_updated_at ON public.student_plan_assignments;
CREATE TRIGGER student_plan_assignments_updated_at
  BEFORE UPDATE ON public.student_plan_assignments
  FOR EACH ROW EXECUTE FUNCTION public.tg_student_plan_assignments_updated_at();

-- RLS: solo profesionales con acceso al alumno (vía student_owners) pueden leer/escribir.
ALTER TABLE public.student_plan_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS spa_select ON public.student_plan_assignments;
CREATE POLICY spa_select ON public.student_plan_assignments
  FOR SELECT TO authenticated
  USING (
    student_id IN (SELECT student_id FROM public.student_owners WHERE owner_id = auth.uid())
    OR public.has_any_role(ARRAY['admin']::public.app_role[])
  );

DROP POLICY IF EXISTS spa_insert ON public.student_plan_assignments;
CREATE POLICY spa_insert ON public.student_plan_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id IN (SELECT student_id FROM public.student_owners WHERE owner_id = auth.uid())
    AND public.has_any_role(ARRAY['admin','trainer','nutritionist','psychologist']::public.app_role[])
  );

DROP POLICY IF EXISTS spa_update ON public.student_plan_assignments;
CREATE POLICY spa_update ON public.student_plan_assignments
  FOR UPDATE TO authenticated
  USING (
    student_id IN (SELECT student_id FROM public.student_owners WHERE owner_id = auth.uid())
    AND public.has_any_role(ARRAY['admin','trainer','nutritionist','psychologist']::public.app_role[])
  )
  WITH CHECK (
    student_id IN (SELECT student_id FROM public.student_owners WHERE owner_id = auth.uid())
    AND public.has_any_role(ARRAY['admin','trainer','nutritionist','psychologist']::public.app_role[])
  );

DROP POLICY IF EXISTS spa_delete ON public.student_plan_assignments;
CREATE POLICY spa_delete ON public.student_plan_assignments
  FOR DELETE TO authenticated
  USING (
    public.has_any_role(ARRAY['admin']::public.app_role[])
  );

-- Vista helper: plan vigente por alumno (start <= today <= end, o último creado).
CREATE OR REPLACE VIEW public.student_current_plan_assignment AS
SELECT DISTINCT ON (a.student_id)
  a.*
FROM public.student_plan_assignments a
ORDER BY a.student_id,
  -- Priorizar el que cae dentro del rango de hoy
  (CURRENT_DATE BETWEEN a.start_date AND a.end_date) DESC,
  a.created_at DESC;

GRANT SELECT ON public.student_current_plan_assignment TO authenticated;
