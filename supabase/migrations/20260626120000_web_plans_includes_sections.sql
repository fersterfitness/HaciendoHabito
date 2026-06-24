-- Secciones de «Incluye» por profesional (Entrenador / Psicólogo / Nutricionista) en ofertas web.

ALTER TABLE public.web_plans
  ADD COLUMN IF NOT EXISTS includes_sections jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.web_plans.includes_sections IS
  'Lista JSON: [{ "professional": "trainer"|"psychologist"|"nutritionist", "items": ["..."] }]. includes_items sigue siendo el listado plano (sincronizado desde la app).';

-- Backfill: una sección «entrenador» con los ítems actuales si aún no hay secciones.
UPDATE public.web_plans
SET includes_sections = jsonb_build_array(
  jsonb_build_object('professional', 'trainer', 'items', to_jsonb(includes_items))
)
WHERE includes_sections = '[]'::jsonb
  AND cardinality(includes_items) > 0;

NOTIFY pgrst, 'reload schema';
