-- Biblioteca de alimentos con macros por 100 g (USDA como fuente inicial en app).
CREATE TABLE IF NOT EXISTS public.nutrition_food_library (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name          text NOT NULL,
  external_source       text NOT NULL DEFAULT 'manual' CHECK (external_source IN ('manual', 'usda_fdc')),
  external_fdc_id       bigint,
  protein_g_per_100g    numeric(8,2),
  fat_g_per_100g        numeric(8,2),
  carbs_g_per_100g      numeric(8,2),
  fiber_g_per_100g      numeric(8,2),
  energy_kcal_per_100g  numeric(10,2),
  portion_basis         text NOT NULL DEFAULT 'no_especificado'
    CHECK (portion_basis IN ('crudo', 'cocido', 'no_especificado')),
  source_label          text,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_nutrition_food_usda_requires_fdc
    CHECK (external_source <> 'usda_fdc' OR external_fdc_id IS NOT NULL)
);

DROP TRIGGER IF EXISTS set_updated_at ON public.nutrition_food_library;
SELECT public.set_updated_at('nutrition_food_library');

CREATE INDEX IF NOT EXISTS idx_nutrition_food_library_owner ON public.nutrition_food_library(owner_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_food_library_owner_name ON public.nutrition_food_library(owner_id, display_name);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_nutrition_food_library_owner_usda_fdc_id
  ON public.nutrition_food_library(owner_id, external_fdc_id)
  WHERE external_source = 'usda_fdc' AND external_fdc_id IS NOT NULL;

ALTER TABLE public.nutrition_food_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nutrition_food_library_nutritionist_admin_owner ON public.nutrition_food_library;
CREATE POLICY nutrition_food_library_nutritionist_admin_owner ON public.nutrition_food_library
  FOR ALL USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['admin', 'nutritionist', 'trainer']::public.app_role[])
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['admin', 'nutritionist', 'trainer']::public.app_role[])
    )
  );
