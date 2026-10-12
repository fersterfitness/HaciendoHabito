-- Aviso «TESTEAR RM»: cada 12 semanas de rutina (sumando rutinas) desde el último test.
-- Al marcar el aviso como leído se guarda la fecha y la cuenta vuelve a cero.
-- Cargar un RM nuevo también reinicia la cuenta (se calcula en la app con student_rm_records).

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS rm_test_reset_at timestamptz;

COMMENT ON COLUMN public.students.rm_test_reset_at IS
  'Último «leído» del aviso TESTEAR RM; las 12 semanas se cuentan desde acá o desde el último RM cargado.';
