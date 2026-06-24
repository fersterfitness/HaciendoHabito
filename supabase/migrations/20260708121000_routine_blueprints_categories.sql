-- Item 7 · Plantillas de rutina por categoría y subcategoría
-- Ej.: categoría "Fase de intensificación" › subcategoría "Principiantes" › plantilla "3 días fuerza + hipertrofia".

ALTER TABLE public.routine_blueprints
  ADD COLUMN IF NOT EXISTS category    text,
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS sort_order  int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.routine_blueprints.category IS 'Categoría principal de la plantilla (texto libre, ej. "Fase de intensificación").';
COMMENT ON COLUMN public.routine_blueprints.subcategory IS 'Subcategoría dentro de la categoría (texto libre, ej. "Principiantes").';

CREATE INDEX IF NOT EXISTS idx_routine_blueprints_category
  ON public.routine_blueprints(owner_id, category, subcategory, sort_order);
