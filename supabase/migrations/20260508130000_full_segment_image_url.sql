-- Agrega columna para imagen del plan «Full» en el selector /form
ALTER TABLE public.web_intake_catalog_settings
  ADD COLUMN IF NOT EXISTS full_segment_image_url text;

COMMENT ON COLUMN public.web_intake_catalog_settings.full_segment_image_url IS 'URL HTTPS a imagen del plan Full (Tomás Ferster + Cristian Crossetto).';
