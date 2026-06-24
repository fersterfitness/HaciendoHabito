-- Web /form: videos testimonios (URLs) en settings (fila id=1).

ALTER TABLE public.web_intake_catalog_settings
  ADD COLUMN IF NOT EXISTS testimonial_videos text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.web_intake_catalog_settings.testimonial_videos IS 'URLs de videos testimonios (YouTube/Vimeo/mp4). Se renderizan en /form.';

