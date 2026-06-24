-- Precio anual opcional en formulario público (toggle mensual / anual).
ALTER TABLE public.web_plans
  ADD COLUMN IF NOT EXISTS price_yearly_label text;

COMMENT ON COLUMN public.web_plans.price_yearly_label IS
  'Precio por modalidad anual en /form. Null o vacío: el front puede derivar valor referencial desde el mensual.';

ALTER TABLE public.web_plans DROP CONSTRAINT IF EXISTS web_plans_price_yearly_label_len;

ALTER TABLE public.web_plans
  ADD CONSTRAINT web_plans_price_yearly_label_len CHECK (
    price_yearly_label IS NULL
    OR (char_length(btrim(price_yearly_label)) BETWEEN 2 AND 28)
  );
