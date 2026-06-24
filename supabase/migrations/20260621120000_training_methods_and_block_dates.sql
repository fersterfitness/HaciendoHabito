-- Fechas por semana/bloque (si faltan en el proyecto)
ALTER TABLE public.routine_blocks
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date;

-- Categorías de métodos (Hipertrofia, Fuerza, etc.)
CREATE TABLE IF NOT EXISTS public.training_method_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_method_categories_owner
  ON public.training_method_categories(owner_id, sort_order);

-- Métodos reutilizables (wave loading, etc.)
CREATE TABLE IF NOT EXISTS public.training_methods (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id         uuid REFERENCES public.training_method_categories(id) ON DELETE SET NULL,
  name                text NOT NULL,
  default_reps_scheme text,
  default_sets        int CHECK (default_sets IS NULL OR default_sets BETWEEN 1 AND 20),
  coach_guide         text,
  sort_order          int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_methods_owner
  ON public.training_methods(owner_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_training_methods_category
  ON public.training_methods(category_id);

-- Prescripción en rutina: método opcional + notas privadas del entrenador (no van al PDF)
ALTER TABLE public.routine_exercises
  ADD COLUMN IF NOT EXISTS training_method_id uuid
    REFERENCES public.training_methods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS method_coach_notes text;

-- RLS
ALTER TABLE public.training_method_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS training_method_categories_owner ON public.training_method_categories;
CREATE POLICY training_method_categories_owner ON public.training_method_categories
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS training_methods_owner ON public.training_methods;
CREATE POLICY training_methods_owner ON public.training_methods
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
