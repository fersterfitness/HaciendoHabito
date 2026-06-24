-- Plantillas reutilizables (diccionario de rutinas) para crear rutinas nuevas más rápido.

CREATE TABLE IF NOT EXISTS public.routine_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routine_blueprints_owner ON public.routine_blueprints(owner_id);

DROP TRIGGER IF EXISTS set_updated_at ON public.routine_blueprints;
SELECT public.set_updated_at('routine_blueprints');

ALTER TABLE public.routine_blueprints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS routine_blueprints_trainer_admin ON public.routine_blueprints;
CREATE POLICY routine_blueprints_trainer_admin ON public.routine_blueprints
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() AND public.has_any_role(ARRAY['admin','trainer']::public.app_role[]))
  WITH CHECK (owner_id = auth.uid() AND public.has_any_role(ARRAY['admin','trainer']::public.app_role[]));
