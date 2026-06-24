-- Finanzas: separar Haciéndolo Hábito vs Vida personal + nuevos métodos.

-- 1) Scope / ámbito
ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'business';

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'business';

ALTER TABLE public.income
  DROP CONSTRAINT IF EXISTS income_scope_chk;
ALTER TABLE public.income
  ADD CONSTRAINT income_scope_chk CHECK (scope IN ('business', 'personal'));

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_scope_chk;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_scope_chk CHECK (scope IN ('business', 'personal'));

COMMENT ON COLUMN public.income.scope IS 'business = Haciéndolo hábito; personal = vida personal.';
COMMENT ON COLUMN public.expenses.scope IS 'business = Haciéndolo hábito; personal = vida personal.';

-- 2) Métodos de pago extra (no se cambia el tipo en DB; sólo se documenta)
-- Nota: payment_method ya existe; el frontend aceptará valores nuevos:
-- - cuenta_dni
-- - efectivo_ars

