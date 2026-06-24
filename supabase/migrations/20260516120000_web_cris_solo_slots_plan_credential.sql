-- Formulario público: segmento «solo Cris» (nutrición sin entrenamiento conjunto), cupos visibles, texto libre por plan.

-- 1) web_plans: segmento cris_solo + línea de credencial opcional por plan
ALTER TABLE public.web_plans
  DROP CONSTRAINT IF EXISTS web_plans_catalog_segment_chk;

ALTER TABLE public.web_plans
  ADD CONSTRAINT web_plans_catalog_segment_chk CHECK (
    catalog_segment IN ('solo', 'with_cris', 'full', 'cris_solo')
  );

ALTER TABLE public.web_plans
  ADD COLUMN IF NOT EXISTS credential_line_override text;

COMMENT ON COLUMN public.web_plans.credential_line_override IS 'Formulario /form: reemplaza la credencial por defecto del segmento en el detalle del plan (otro profesional o texto libre).';

-- 2) Ajustes públicos: foto segmento Cris solo + cupos
ALTER TABLE public.web_intake_catalog_settings
  ADD COLUMN IF NOT EXISTS cris_solo_segment_image_url text;

ALTER TABLE public.web_intake_catalog_settings
  ADD COLUMN IF NOT EXISTS intake_slots_open boolean NOT NULL DEFAULT true;

ALTER TABLE public.web_intake_catalog_settings
  ADD COLUMN IF NOT EXISTS intake_slots_remaining integer;

ALTER TABLE public.web_intake_catalog_settings
  ADD COLUMN IF NOT EXISTS intake_slots_public_message text;

COMMENT ON COLUMN public.web_intake_catalog_settings.cris_solo_segment_image_url IS 'Imagen selector /form · línea solo nutrición Cris (sin entrenador HH).';
COMMENT ON COLUMN public.web_intake_catalog_settings.intake_slots_open IS 'Si false, el banner web indica cupos cerrados.';
COMMENT ON COLUMN public.web_intake_catalog_settings.intake_slots_remaining IS 'Cupos numéricos opcionales para mostrar en la web; NULL = no mostrar número.';
COMMENT ON COLUMN public.web_intake_catalog_settings.intake_slots_public_message IS 'Texto corto del banner (ej. «Quedan pocos lugares» o «Cerrado hasta marzo»).';
