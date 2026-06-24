-- Extras para student_plan_assignments: monto, método de pago, estado "cancelled".

ALTER TABLE public.student_plan_assignments
  ADD COLUMN IF NOT EXISTS amount         numeric(12, 2),
  ADD COLUMN IF NOT EXISTS payment_method text;

-- Permitir 'cancelled' como estado de pago/asignación.
ALTER TABLE public.student_plan_assignments
  DROP CONSTRAINT IF EXISTS student_plan_assignments_payment_status_check;

ALTER TABLE public.student_plan_assignments
  ADD CONSTRAINT student_plan_assignments_payment_status_check
  CHECK (payment_status IN ('pending', 'paid', 'overdue', 'cancelled'));

-- Restringir payment_method si existe.
ALTER TABLE public.student_plan_assignments
  DROP CONSTRAINT IF EXISTS student_plan_assignments_payment_method_check;

ALTER TABLE public.student_plan_assignments
  ADD CONSTRAINT student_plan_assignments_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('cash', 'mercadopago', 'transfer', 'other'));
