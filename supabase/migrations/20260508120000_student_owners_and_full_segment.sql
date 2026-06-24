-- ──────────────────────────────────────────────────────────────────────────────
-- student_owners: permite que un alumno sea visto por múltiples profesionales.
-- Caso de uso principal: plan Full (entrenador + nutricionista).
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Extender catalog_segment para permitir 'full'
ALTER TABLE public.web_plans
  DROP CONSTRAINT IF EXISTS web_plans_catalog_segment_chk;

ALTER TABLE public.web_plans
  ADD CONSTRAINT web_plans_catalog_segment_chk
  CHECK (catalog_segment IN ('solo', 'with_cris', 'full'));

COMMENT ON CONSTRAINT web_plans_catalog_segment_chk ON public.web_plans
  IS 'solo = solo entrenador; with_cris = solo nutricionista; full = ambos profesionales.';

-- Upsert del plan Full en la tabla web_plans (en caso de que no exista o esté con segmento incorrecto)
UPDATE public.web_plans
  SET catalog_segment = 'full'
  WHERE slug = 'plan-full' AND catalog_segment != 'full';

-- 2. Tabla student_owners
CREATE TABLE IF NOT EXISTS public.student_owners (
  student_id        uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  owner_id          uuid NOT NULL,
  professional_type text NOT NULL CHECK (professional_type IN ('trainer', 'nutritionist')),
  added_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_student_owners_owner ON public.student_owners(owner_id);
CREATE INDEX IF NOT EXISTS idx_student_owners_student ON public.student_owners(student_id);

COMMENT ON TABLE public.student_owners IS
  'Propietarios adicionales de un alumno. Cuando el alumno tiene plan Full aparece tanto en el dashboard del entrenador como en el del nutricionista.';

-- 3. RLS
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

-- 4. Política adicional en students: un profesional puede leer alumnos donde
--    aparezca en student_owners (además del owner_id directo).
DROP POLICY IF EXISTS students_shared_select ON public.students;
CREATE POLICY students_shared_select ON public.students
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT student_id FROM public.student_owners WHERE owner_id = auth.uid()
    )
  );
