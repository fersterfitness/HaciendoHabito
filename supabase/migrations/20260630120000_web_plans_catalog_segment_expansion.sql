-- Allow psychologist and with_nutritionist catalog segments (UI already sends these values).

UPDATE public.web_plans
SET catalog_segment = 'with_nutritionist'
WHERE catalog_segment IN ('with_cris', 'cris_solo');

ALTER TABLE public.web_plans
  DROP CONSTRAINT IF EXISTS web_plans_catalog_segment_chk;

ALTER TABLE public.web_plans
  ADD CONSTRAINT web_plans_catalog_segment_chk CHECK (
    catalog_segment IN ('solo', 'with_nutritionist', 'with_cris', 'full', 'psychologist')
  );

COMMENT ON COLUMN public.web_plans.catalog_segment IS
  'Modalidad en /form: solo (entrenamiento), with_nutritionist (nutrición), full, psychologist. with_cris es legacy.';
