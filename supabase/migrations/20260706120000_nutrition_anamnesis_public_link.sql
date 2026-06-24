-- Enlace público de anamnesis: emisión y envío por el paciente
ALTER TABLE public.nutrition_anamnesis
  ADD COLUMN IF NOT EXISTS public_link_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_submitted_at timestamptz;

COMMENT ON COLUMN public.nutrition_anamnesis.public_link_issued_at IS
  'Cuándo el nutricionista generó/copió el link personalizado para el paciente.';
COMMENT ON COLUMN public.nutrition_anamnesis.public_submitted_at IS
  'Cuándo el paciente envió el formulario público; bloquea nuevo envío y nuevo link.';
