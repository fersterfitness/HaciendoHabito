-- Calendario anual del macrociclo (herramienta interna del entrenador).
-- Cada rutina del alumno es un bloque del macrociclo; se dibuja como barra sobre sus semanas.
-- El calendario no guarda la planificación: la arma con las fechas de las rutinas y sus semanas.

ALTER TABLE public.routines
  ADD COLUMN IF NOT EXISTS block_type text
    CHECK (block_type IS NULL OR block_type IN ('adaptacion', 'desarrollo', 'intensificacion', 'realizacion', 'descarga', 'transicion')),
  ADD COLUMN IF NOT EXISTS calendar_color text
    CHECK (calendar_color IS NULL OR calendar_color ~ '^#[0-9a-fA-F]{6}$');

COMMENT ON COLUMN public.routines.block_type IS 'Tipo de bloque del macrociclo (desarrollo, intensificación, descarga…).';
COMMENT ON COLUMN public.routines.calendar_color IS 'Color de la barra en el calendario anual (#rrggbb). NULL = color del tipo.';
