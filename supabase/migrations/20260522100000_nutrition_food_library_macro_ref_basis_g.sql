-- Gramos (o base) de referencia para los valores P/G/HC/kcal guardados en cada fila (ej. 25 g rebanada, 50 g dulce de leche).
ALTER TABLE public.nutrition_food_library
  ADD COLUMN IF NOT EXISTS macro_ref_basis_g double precision NOT NULL DEFAULT 100;

COMMENT ON COLUMN public.nutrition_food_library.macro_ref_basis_g IS
  'Cantidad de gramos de referencia para los campos nutricionales de la fila (no siempre 100). Ej.: 25 para pan por rebanada.';

ALTER TABLE public.nutrition_food_library
  DROP CONSTRAINT IF EXISTS nutrition_food_library_macro_ref_basis_g_chk;

ALTER TABLE public.nutrition_food_library
  ADD CONSTRAINT nutrition_food_library_macro_ref_basis_g_chk
  CHECK (macro_ref_basis_g > 0 AND macro_ref_basis_g <= 10000);
