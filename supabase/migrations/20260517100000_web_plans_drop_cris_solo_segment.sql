-- Unificar «solo nutrición» en el segmento with_cris (2.ª tarjeta). Quitar cris_solo del modelo.

UPDATE public.web_plans
SET catalog_segment = 'with_cris'
WHERE catalog_segment = 'cris_solo';

ALTER TABLE public.web_plans
  DROP CONSTRAINT IF EXISTS web_plans_catalog_segment_chk;

ALTER TABLE public.web_plans
  ADD CONSTRAINT web_plans_catalog_segment_chk CHECK (
    catalog_segment IN ('solo', 'with_cris', 'full')
  );

-- La columna cris_solo_segment_image_url puede quedar sin uso; no la borramos por si hay URL guardada.
