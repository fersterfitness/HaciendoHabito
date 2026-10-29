-- Calendario del macrociclo: bloques que marca el entrenador a mano (días o semanas) con
-- tipo (intensificación, realización…), título y anotaciones. Son independientes de las rutinas
-- y quedan guardados como historial de cómo se armaron el macrociclo y los mesociclos.

CREATE TABLE IF NOT EXISTS public.macrocycle_plan_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  title text NOT NULL,
  block_type text
    CHECK (block_type IS NULL OR block_type IN ('adaptacion', 'desarrollo', 'intensificacion', 'realizacion', 'descarga', 'transicion')),
  color text CHECK (color IS NULL OR color ~ '^#[0-9a-fA-F]{6}$'),
  start_date date NOT NULL,
  end_date date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT macrocycle_plan_blocks_dates CHECK (end_date >= start_date)
);

COMMENT ON TABLE public.macrocycle_plan_blocks IS
  'Bloques del macrociclo marcados por el entrenador en el calendario anual (solo entrenador).';

CREATE INDEX IF NOT EXISTS idx_macrocycle_plan_blocks_student
  ON public.macrocycle_plan_blocks (student_id, start_date);

ALTER TABLE public.macrocycle_plan_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS macrocycle_plan_blocks_owner ON public.macrocycle_plan_blocks;
CREATE POLICY macrocycle_plan_blocks_owner ON public.macrocycle_plan_blocks
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
