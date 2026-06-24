-- Textos del selector «Modalidad» en /form (editables desde Ajustes → Planes web).
ALTER TABLE public.web_intake_catalog_settings
  ADD COLUMN IF NOT EXISTS modality_label_solo text,
  ADD COLUMN IF NOT EXISTS modality_label_with_cris text,
  ADD COLUMN IF NOT EXISTS modality_label_full text;

COMMENT ON COLUMN public.web_intake_catalog_settings.modality_label_solo IS 'Etiqueta paso 1 · segmento solo (entreno). Vacío = texto por defecto en app.';
COMMENT ON COLUMN public.web_intake_catalog_settings.modality_label_with_cris IS 'Etiqueta paso 1 · solo nutrición (with_cris).';
COMMENT ON COLUMN public.web_intake_catalog_settings.modality_label_full IS 'Etiqueta paso 1 · plan full.';
