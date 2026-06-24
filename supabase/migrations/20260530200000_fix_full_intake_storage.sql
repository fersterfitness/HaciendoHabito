-- Plan Full: columna intake_nutrition, slugs de catálogo sin romper FK, visibilidad nutricionista.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS intake_nutrition jsonb;

COMMENT ON COLUMN public.students.intake_nutrition IS
  'Anamnesis nutricional del /form (solo nutrición o plan Full).';

-- Los slugs del catálogo fijo (ferster-*, cris-habitos-*) no estaban en web_plans → FK dejaba selected_web_plan_slug en NULL o fallaba el insert.
ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_selected_web_plan_slug_fkey;

-- Slugs mínimos para referencia (evita errores si se vuelve a poner FK más adelante).
INSERT INTO public.web_plans (slug, title, price_label, short_description, intro_text, includes_items, gifts_items, sort_order, is_active, catalog_segment)
VALUES
  (
    'ferster-habitos-alto-rendimiento',
    'Hábitos alto rendimiento',
    '$60.000',
    'Entrenamiento personalizado con seguimiento mensual.',
    'Plan avanzado de entrenamiento orientado al rendimiento físico.',
    ARRAY['Rutina personalizada.', 'Seguimiento mensual.']::text[],
    ARRAY['Calendario de hábitos.']::text[],
    10,
    true,
    'solo'
  ),
  (
    'ferster-habitos-intermedio',
    'Hábitos intermedio',
    '$50.000',
    'Plan intermedio con seguimiento.',
    'Plan intermedio de entrenamiento con seguimiento personalizado.',
    ARRAY['Rutina personalizada.', 'Seguimiento mensual.']::text[],
    ARRAY['Calendario de hábitos.']::text[],
    11,
    true,
    'solo'
  ),
  (
    'ferster-habitos-casa',
    'Hábitos en casa',
    '$45.000',
    'Entrenamiento en casa.',
    'Plan diseñado para entrenar en casa.',
    ARRAY['Rutina personalizada.', 'Seguimiento mensual.']::text[],
    ARRAY['Calendario de hábitos.']::text[],
    12,
    true,
    'solo'
  ),
  (
    'cris-habitos-deportista',
    'Hábitos deportista',
    '$100.000',
    'Plan Full deportista.',
    'Plan integral entrenamiento + nutrición orientado al rendimiento.',
    ARRAY['Rutina y plan nutricional.', 'Seguimiento mensual.']::text[],
    ARRAY['Calendario de hábitos.']::text[],
    20,
    true,
    'full'
  ),
  (
    'cris-habitos-platino',
    'Hábitos platino',
    '$90.000',
    'Plan Full platino.',
    'Plan premium integral entrenamiento + nutrición.',
    ARRAY['Rutina y plan nutricional.', 'Seguimiento mensual.']::text[],
    ARRAY['Calendario de hábitos.']::text[],
    21,
    true,
    'full'
  ),
  (
    'cris-habitos-premium',
    'Hábitos premium',
    '$80.000',
    'Plan Full premium.',
    'Plan integral entrenamiento + nutrición.',
    ARRAY['Rutina y plan nutricional.', 'Seguimiento mensual.']::text[],
    ARRAY['Calendario de hábitos.']::text[],
    22,
    true,
    'full'
  )
ON CONFLICT (slug) DO UPDATE SET
  catalog_segment = EXCLUDED.catalog_segment,
  is_active = true;

-- Helper: ¿es registro plan Full?
CREATE OR REPLACE FUNCTION public.student_is_full_plan(s public.students)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    s.selected_web_plan_slug IN ('plan-full', 'cris-habitos-deportista', 'cris-habitos-platino', 'cris-habitos-premium')
    OR COALESCE(s.intake_ferster->>'selected_plan_slug', '') LIKE 'cris-habitos-%'
    OR (s.intake_nutrition IS NOT NULL AND s.intake_nutrition->>'form_type' = 'full')
    OR (s.notes IS NOT NULL AND s.notes LIKE '[Full /form]%');
$$;

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
        SELECT 1 FROM public.student_owners so
        WHERE so.student_id = s.id AND so.owner_id = auth.uid()
      )
      OR (
        public.has_any_role(ARRAY['nutritionist','admin']::public.app_role[])
        AND public.student_is_full_plan(s)
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
        SELECT 1 FROM public.student_owners so
        WHERE so.student_id = s.id AND so.owner_id = auth.uid()
      )
      OR (
        public.has_any_role(ARRAY['nutritionist','admin']::public.app_role[])
        AND public.student_is_full_plan(s)
      )
    )
  LIMIT 1;
$$;

DROP POLICY IF EXISTS students_full_plan_nutritionist_select ON public.students;
CREATE POLICY students_full_plan_nutritionist_select ON public.students
  FOR SELECT TO authenticated
  USING (
    public.has_any_role(ARRAY['nutritionist','admin']::public.app_role[])
    AND public.student_is_full_plan(students)
  );

-- Completar intake_nutrition en Full guardados solo como entreno (slug en intake_ferster).
UPDATE public.students s
SET intake_nutrition = jsonb_build_object(
  'version', 1,
  'form_type', 'full',
  'selected_plan_slug', COALESCE(s.intake_ferster->>'selected_plan_slug', s.selected_web_plan_slug),
  'repaired_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
)
WHERE s.intake_nutrition IS NULL
  AND (
    COALESCE(s.intake_ferster->>'selected_plan_slug', '') LIKE 'cris-habitos-%'
    OR s.selected_web_plan_slug IN ('plan-full', 'cris-habitos-deportista', 'cris-habitos-platino', 'cris-habitos-premium')
  );

UPDATE public.students s
SET selected_web_plan_slug = s.intake_ferster->>'selected_plan_slug'
WHERE s.selected_web_plan_slug IS NULL
  AND COALESCE(s.intake_ferster->>'selected_plan_slug', '') LIKE 'cris-habitos-%'
  AND EXISTS (SELECT 1 FROM public.web_plans w WHERE w.slug = s.intake_ferster->>'selected_plan_slug');

-- Vincular nutricionista a todos los Full (incluidos reparados).
INSERT INTO public.student_owners (student_id, owner_id, professional_type)
SELECT s.id, p.id, 'nutritionist'
FROM public.students s
CROSS JOIN LATERAL (
  SELECT id FROM public.profiles WHERE role = 'nutritionist' ORDER BY created_at LIMIT 1
) p
WHERE public.student_is_full_plan(s)
  AND NOT EXISTS (
    SELECT 1 FROM public.student_owners so
    WHERE so.student_id = s.id AND so.professional_type = 'nutritionist'
  )
ON CONFLICT (student_id, owner_id) DO NOTHING;

INSERT INTO public.student_owners (student_id, owner_id, professional_type)
SELECT s.id, s.owner_id, 'trainer'
FROM public.students s
WHERE public.student_is_full_plan(s)
  AND NOT EXISTS (
    SELECT 1 FROM public.student_owners so
    WHERE so.student_id = s.id AND so.owner_id = s.owner_id
  )
ON CONFLICT (student_id, owner_id) DO NOTHING;
