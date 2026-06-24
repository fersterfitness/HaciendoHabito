-- Circuitos / Preestablecidos
-- Bloques de entrenamiento ya armados (circuitos o ejercicios) listos para copiar/pegar en una rutina.
-- Mismo esquema de categorías que Métodos. El contenido (ejercicios, reps, semanas, %RM, RPE, RIR,
-- descanso, aclaración del bloque) se guarda en `payload` (JSONB).

CREATE TABLE IF NOT EXISTS public.preset_block_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_preset_block_categories_owner
  ON public.preset_block_categories(owner_id, sort_order);

CREATE TABLE IF NOT EXISTS public.preset_blocks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id  uuid REFERENCES public.preset_block_categories(id) ON DELETE SET NULL,
  name         text NOT NULL,
  description  text,
  kind         text NOT NULL DEFAULT 'circuit' CHECK (kind IN ('circuit', 'individual')),
  block_note   text,
  weeks_count  int NOT NULL DEFAULT 1 CHECK (weeks_count BETWEEN 1 AND 12),
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order   int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.preset_blocks.payload IS
  'Contenido del bloque. Forma: {"exercises":[{"exercise_id":uuid|null,"name":string,'
  '"is_superset":bool,"superset_group":int|null,"sets":int,"reps_scheme":string,'
  '"rest_seconds":int|null,"rpe":number|null,"rir":int|null,"percent_rm":number|null,'
  '"weeks":[{"reps_scheme":string,"percent_rm":number|null,"sets":int|null}]}]}. '
  'weeks es opcional (overrides por semana, index = semana).';

CREATE INDEX IF NOT EXISTS idx_preset_blocks_owner ON public.preset_blocks(owner_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_preset_blocks_category ON public.preset_blocks(category_id);

DROP TRIGGER IF EXISTS set_updated_at ON public.preset_block_categories;
SELECT public.set_updated_at('preset_block_categories');
DROP TRIGGER IF EXISTS set_updated_at ON public.preset_blocks;
SELECT public.set_updated_at('preset_blocks');

ALTER TABLE public.preset_block_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS preset_block_categories_owner ON public.preset_block_categories;
CREATE POLICY preset_block_categories_owner ON public.preset_block_categories
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS preset_blocks_owner ON public.preset_blocks;
CREATE POLICY preset_blocks_owner ON public.preset_blocks
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
