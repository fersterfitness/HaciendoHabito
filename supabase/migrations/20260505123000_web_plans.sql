-- Planes web editables para el formulario público.

CREATE OR REPLACE FUNCTION public.text_array_items_max_len(arr text[], max_len integer)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(bool_and(char_length(item) <= max_len), true)
  FROM unnest(arr) AS item;
$$;

CREATE TABLE IF NOT EXISTS public.web_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  price_label text NOT NULL,
  short_description text NOT NULL,
  intro_text text NOT NULL,
  includes_items text[] NOT NULL DEFAULT '{}'::text[],
  gifts_items text[] NOT NULL DEFAULT '{}'::text[],
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT web_plans_slug_not_blank CHECK (char_length(btrim(slug)) > 0),
  CONSTRAINT web_plans_title_len CHECK (char_length(title) BETWEEN 3 AND 60),
  CONSTRAINT web_plans_price_len CHECK (char_length(price_label) BETWEEN 2 AND 24),
  CONSTRAINT web_plans_short_len CHECK (char_length(short_description) BETWEEN 8 AND 140),
  CONSTRAINT web_plans_intro_len CHECK (char_length(intro_text) BETWEEN 20 AND 700),
  CONSTRAINT web_plans_includes_count CHECK (cardinality(includes_items) BETWEEN 1 AND 16),
  CONSTRAINT web_plans_gifts_count CHECK (cardinality(gifts_items) BETWEEN 1 AND 16),
  CONSTRAINT web_plans_includes_item_len CHECK (public.text_array_items_max_len(includes_items, 180)),
  CONSTRAINT web_plans_gifts_item_len CHECK (public.text_array_items_max_len(gifts_items, 180))
);

CREATE INDEX IF NOT EXISTS idx_web_plans_sort_order ON public.web_plans(sort_order);
CREATE INDEX IF NOT EXISTS idx_web_plans_active_sort ON public.web_plans(is_active, sort_order);

DROP TRIGGER IF EXISTS set_updated_at ON public.web_plans;
SELECT public.set_updated_at('web_plans');

ALTER TABLE public.web_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS web_plans_public_read ON public.web_plans;
CREATE POLICY web_plans_public_read ON public.web_plans
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS web_plans_manage_staff ON public.web_plans;
CREATE POLICY web_plans_manage_staff ON public.web_plans
  FOR ALL TO authenticated
  USING (public.has_any_role(ARRAY['admin','trainer','nutritionist']::public.app_role[]))
  WITH CHECK (public.has_any_role(ARRAY['admin','trainer','nutritionist']::public.app_role[]));

INSERT INTO public.web_plans (
  slug,
  title,
  price_label,
  short_description,
  intro_text,
  includes_items,
  gifts_items,
  sort_order,
  is_active
)
VALUES
  (
    'plan-entrenamiento',
    'Primer Plan Entrenamiento',
    '$60.000',
    'Entrenamiento personalizado con seguimiento mensual.',
    'Plan avanzado de entrenamiento orientado al rendimiento físico, con enfoque en fuerza, resistencia y recuperación. Seguimiento continuo y ajustes según objetivos.',
    ARRAY[
      'Videollamada de bienvenida gratuita.',
      'Videollamada mensual para ajustes/progreso.',
      'Actualización mensual de tu rutina.',
      'Rutina 100% personalizada.',
      'Correcciones por WhatsApp/video y seguimiento continuo.',
      'Encuentro presencial para ajustes técnicos (cuando se pueda pactar).'
    ]::text[],
    ARRAY[
      'Calendario gratis para anotar tus hábitos.',
      'Análisis estadístico de hábitos y progreso.',
      'En mujeres: análisis del ciclo menstrual y su rendimiento.',
      'Materiales y guías digitales.'
    ]::text[],
    1,
    true
  ),
  (
    'plan-nutricion',
    'Segundo Plan Nutrición',
    '$80.000',
    'Plan nutricional + seguimiento para sostener hábitos.',
    'Plan premium de acompañamiento integral en nutrición para establecer y mantener hábitos saludables de forma sostenida, con planificación adaptada a tu contexto.',
    ARRAY[
      'Videollamada de bienvenida gratuita.',
      'Videollamada mensual para seguimiento de progreso.',
      'Planificación nutricional adaptada a tus objetivos.',
      'Ajustes mensuales según evolución.',
      'Soporte y seguimiento continuo por WhatsApp.',
      'Coordinación con tu equipo de profesionales si aplica.'
    ]::text[],
    ARRAY[
      'Calendario gratis para anotar tus hábitos.',
      'Análisis estadístico de hábitos y progreso.',
      'En mujeres: análisis del ciclo menstrual y su rendimiento.',
      'Materiales y guías digitales.'
    ]::text[],
    2,
    true
  ),
  (
    'plan-full',
    'Plan Full',
    '$100.000',
    'Combina entrenamiento + nutrición en un plan integral.',
    'Plan integral que abarca entrenamiento y nutrición en conjunto, orientado a maximizar resultados con acompañamiento completo, estrategia personalizada y seguimiento continuo.',
    ARRAY[
      'Videollamada de bienvenida + evaluación inicial completa.',
      'Videollamada mensual de progreso y ajustes.',
      'Rutina 100% personalizada + planificación nutricional.',
      'Ajustes mensuales de entrenamiento y alimentación.',
      'Correcciones técnicas por video/WhatsApp.',
      'Soporte continuo y encuentros presenciales cuando se puedan pactar.'
    ]::text[],
    ARRAY[
      'Calendario gratis para anotar tus hábitos.',
      'Análisis estadístico de hábitos y progreso.',
      'En mujeres: análisis del ciclo menstrual y su rendimiento.',
      'Materiales y guías digitales.'
    ]::text[],
    3,
    true
  )
ON CONFLICT (slug) DO UPDATE
SET
  title = EXCLUDED.title,
  price_label = EXCLUDED.price_label,
  short_description = EXCLUDED.short_description,
  intro_text = EXCLUDED.intro_text,
  includes_items = EXCLUDED.includes_items,
  gifts_items = EXCLUDED.gifts_items,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
