-- Menús propios del profesional: se suman a la biblioteca de menús estacionales que trae la app.
CREATE TABLE IF NOT EXISTS public.nutrition_custom_menus (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  season            text NOT NULL DEFAULT 'todo-el-anio' CHECK (season IN ('invierno', 'verano', 'todo-el-anio')),
  tolerance         text NOT NULL DEFAULT 'alta' CHECK (tolerance IN ('baja', 'media', 'alta')),
  -- Etiquetas de patología (hashimoto, celiaquia, colon-irritable, sibo, gastritis, reflujo, diabetes, hipertension, general).
  pathologies       text[] NOT NULL DEFAULT ARRAY['general']::text[],
  approximate_kcal  integer CHECK (approximate_kcal IS NULL OR approximate_kcal BETWEEN 0 AND 20000),
  summary           text NOT NULL DEFAULT '',
  -- Contenido en el mismo formato que los menús de la app: «### Almuerzo (~550 kcal)» y una línea por alimento.
  body_md           text NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_updated_at ON public.nutrition_custom_menus;
SELECT public.set_updated_at('nutrition_custom_menus');

CREATE INDEX IF NOT EXISTS idx_nutrition_custom_menus_owner ON public.nutrition_custom_menus(owner_id, updated_at DESC);

ALTER TABLE public.nutrition_custom_menus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nutrition_custom_menus_owner ON public.nutrition_custom_menus;
CREATE POLICY nutrition_custom_menus_owner ON public.nutrition_custom_menus
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
