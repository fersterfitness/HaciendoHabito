-- Foto del psicólogo en bloques «Incluye» del formulario /form.

ALTER TABLE public.web_intake_catalog_settings
  ADD COLUMN IF NOT EXISTS psychologist_segment_image_url text;

COMMENT ON COLUMN public.web_intake_catalog_settings.psychologist_segment_image_url IS
  'URL HTTPS a imagen del psicólogo (bloques Incluye en ofertas web).';
