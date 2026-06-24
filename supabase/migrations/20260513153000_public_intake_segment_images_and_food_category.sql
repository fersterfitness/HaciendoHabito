-- Imágenes opcionales del selector «solo vs conjunto» (nutrición) + categoría por alimento en guía.

-- 1) Fila única: URLs públicas (Supabase Storage, CDN o similar).
CREATE TABLE IF NOT EXISTS public.web_intake_catalog_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  solo_segment_image_url text,
  with_cris_segment_image_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.web_intake_catalog_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS set_updated_at ON public.web_intake_catalog_settings;
SELECT public.set_updated_at('web_intake_catalog_settings');

ALTER TABLE public.web_intake_catalog_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS web_intake_catalog_settings_public_read ON public.web_intake_catalog_settings;
CREATE POLICY web_intake_catalog_settings_public_read ON public.web_intake_catalog_settings
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS web_intake_catalog_settings_staff_write ON public.web_intake_catalog_settings;
CREATE POLICY web_intake_catalog_settings_staff_write ON public.web_intake_catalog_settings
  FOR ALL TO authenticated
  USING (public.has_any_role(ARRAY['admin','trainer','nutritionist']::public.app_role[]))
  WITH CHECK (public.has_any_role(ARRAY['admin','trainer','nutritionist']::public.app_role[]));

COMMENT ON TABLE public.web_intake_catalog_settings IS 'Formulario /form: imágenes del selector de línea (fila id=1).';
COMMENT ON COLUMN public.web_intake_catalog_settings.solo_segment_image_url IS 'URL HTTPS a imagen «solo entrenador».';
COMMENT ON COLUMN public.web_intake_catalog_settings.with_cris_segment_image_url IS 'URL HTTPS a imagen línea conjunta (Cristian Vázquez).';

-- 2) Agrupar alimentos en «Mi lista» (nombre libre tipo rutinas/ejercicios).
ALTER TABLE public.nutrition_food_library
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'General';

CREATE INDEX IF NOT EXISTS idx_nutrition_food_library_owner_category ON public.nutrition_food_library(owner_id, category);

COMMENT ON COLUMN public.nutrition_food_library.category IS 'Grupo editable en la guía (ej. Lácteos, Verduras).';
