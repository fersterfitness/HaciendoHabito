-- Segmento explícito: entreno + nutrición + psicólogo deportivo (modalidad propia en /form).

ALTER TABLE public.web_plans
  DROP CONSTRAINT IF EXISTS web_plans_catalog_segment_chk;

ALTER TABLE public.web_plans
  ADD CONSTRAINT web_plans_catalog_segment_chk CHECK (
    catalog_segment IN (
      'solo',
      'with_nutritionist',
      'with_cris',
      'full',
      'full_trio',
      'psychologist'
    )
  );

COMMENT ON COLUMN public.web_plans.catalog_segment IS
  'Modalidad en /form: solo, with_nutritionist, full, full_trio (trío), psychologist. with_cris es legacy.';

ALTER TABLE public.web_intake_catalog_settings
  ADD COLUMN IF NOT EXISTS modality_label_full_trio text;

COMMENT ON COLUMN public.web_intake_catalog_settings.modality_label_full_trio IS
  'Etiqueta paso 1 · segmento full_trio (entreno + nutrición + psicólogo). Vacío = texto por defecto en app.';
