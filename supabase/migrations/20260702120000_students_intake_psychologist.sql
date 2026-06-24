-- Cuestionario web modalidad psicólogo deportivo (/form).

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS intake_psychologist jsonb;

COMMENT ON COLUMN public.students.intake_psychologist IS
  'Datos del formulario público psicología: residencia, deporte, contacto de emergencia, plan elegido.';
