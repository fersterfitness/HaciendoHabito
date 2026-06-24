-- Fotos de progreso por mes (bucket student-avatars: {student_id}/progress/...)
CREATE TABLE IF NOT EXISTS public.student_progress_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  year_month    text NOT NULL,
  storage_path  text NOT NULL,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_progress_photos_year_month_chk
    CHECK (year_month ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

CREATE INDEX IF NOT EXISTS idx_student_progress_photos_student_month
  ON public.student_progress_photos(student_id, year_month, created_at DESC);

ALTER TABLE public.student_progress_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_progress_photos_trainer_rw ON public.student_progress_photos;
CREATE POLICY student_progress_photos_trainer_rw ON public.student_progress_photos
  FOR ALL TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_progress_photos.student_id AND s.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_progress_photos.student_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS student_progress_photos_student_read ON public.student_progress_photos;
CREATE POLICY student_progress_photos_student_read ON public.student_progress_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_progress_photos.student_id
        AND s.profile_id = auth.uid()
    )
  );

-- Plantillas del plan tipo Excel (workbook completo), reutilizables entre alumnos / sesiones
CREATE TABLE IF NOT EXISTS public.nutrition_planning_workbook_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  data        jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_updated_at ON public.nutrition_planning_workbook_templates;
SELECT public.set_updated_at('nutrition_planning_workbook_templates');

CREATE INDEX IF NOT EXISTS idx_nutrition_workbook_templates_owner
  ON public.nutrition_planning_workbook_templates(owner_id, updated_at DESC);

ALTER TABLE public.nutrition_planning_workbook_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nutrition_workbook_templates_owner_roles ON public.nutrition_planning_workbook_templates;
CREATE POLICY nutrition_workbook_templates_owner_roles ON public.nutrition_planning_workbook_templates
  FOR ALL TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['admin', 'nutritionist', 'trainer']::public.app_role[])
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['admin', 'nutritionist', 'trainer']::public.app_role[])
    )
  );
