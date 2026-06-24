-- Cómo interpretar / mostrar la referencia de macros al pasar a la planificación (g / uds. / ml).
ALTER TABLE public.nutrition_food_library
  ADD COLUMN IF NOT EXISTS macro_qty_presentation text NOT NULL DEFAULT 'grams'
  CHECK (macro_qty_presentation IN ('grams', 'units', 'volume'));

COMMENT ON COLUMN public.nutrition_food_library.macro_qty_presentation IS
  'Referencia de etiqueta: gramos por 100 g, unidades (misma tabla numérica por 100 g + modo uds. en plan), o mililitros por 100 ml.';
