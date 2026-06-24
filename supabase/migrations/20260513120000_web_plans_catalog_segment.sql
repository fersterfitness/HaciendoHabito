-- Catálogo público: segmento (solo entrenador vs con Cris), badge editable, textos más largos.

ALTER TABLE public.web_plans
  DROP CONSTRAINT IF EXISTS web_plans_title_len,
  DROP CONSTRAINT IF EXISTS web_plans_intro_len;

ALTER TABLE public.web_plans
  ADD CONSTRAINT web_plans_title_len CHECK (char_length(title) BETWEEN 3 AND 120),
  ADD CONSTRAINT web_plans_intro_len CHECK (char_length(intro_text) BETWEEN 20 AND 3500);

ALTER TABLE public.web_plans
  ADD COLUMN IF NOT EXISTS catalog_segment text NOT NULL DEFAULT 'solo',
  ADD COLUMN IF NOT EXISTS display_badge text;

UPDATE public.web_plans SET catalog_segment = 'solo' WHERE catalog_segment IS NULL OR btrim(catalog_segment) = '';

ALTER TABLE public.web_plans
  DROP CONSTRAINT IF EXISTS web_plans_catalog_segment_chk;

ALTER TABLE public.web_plans
  ADD CONSTRAINT web_plans_catalog_segment_chk CHECK (catalog_segment IN ('solo', 'with_cris', 'full'));

COMMENT ON COLUMN public.web_plans.catalog_segment IS 'Formulario público: solo = entrenador; with_cris = nutrición; full = entreno + nutrición.';
COMMENT ON COLUMN public.web_plans.display_badge IS 'Etiqueta en la tarjeta (ej. Entrenamiento). Null = el front puede deducir por slug.';
