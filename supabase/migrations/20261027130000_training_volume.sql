-- Volumen de entrenamiento (contador de series efectivas por músculo).
-- 1) Factores de implicación muscular por ejercicio (1.0 objetivo, ~0.5 sinérgico), editables
--    por cada entrenador sin tocar la biblioteca compartida.
-- 2) Perfiles de parámetros (rango objetivo, regla de RIR, multiplicadores de técnicas),
--    p. ej. uno para principiantes y otro para avanzados.

CREATE TABLE IF NOT EXISTS public.exercise_volume_factors (
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercise_library(id) ON DELETE CASCADE,
  factors jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, exercise_id)
);

COMMENT ON TABLE public.exercise_volume_factors IS
  'Implicación muscular por ejercicio para el contador de volumen: {"pecho":1,"triceps":0.5,...}.';

ALTER TABLE public.exercise_volume_factors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exercise_volume_factors_owner ON public.exercise_volume_factors;
CREATE POLICY exercise_volume_factors_owner ON public.exercise_volume_factors
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.trainer_volume_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trainer_volume_profiles IS
  'Parámetros del contador de volumen (rango 10–20, RIR, multiplicadores de dropset/burns/…).';

CREATE INDEX IF NOT EXISTS idx_trainer_volume_profiles_owner ON public.trainer_volume_profiles (owner_id);

ALTER TABLE public.trainer_volume_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trainer_volume_profiles_owner ON public.trainer_volume_profiles;
CREATE POLICY trainer_volume_profiles_owner ON public.trainer_volume_profiles
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
