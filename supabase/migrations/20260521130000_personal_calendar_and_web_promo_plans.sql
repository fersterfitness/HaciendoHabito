-- Agenda personal (sin alumno) + planes web 3 y 6 meses por segmento.

-- ── 1) personal_calendar_items ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.personal_calendar_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personal_calendar_title_len CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  CONSTRAINT personal_calendar_time_order CHECK (ends_at > starts_at)
);

DROP TRIGGER IF EXISTS set_updated_at ON public.personal_calendar_items;
SELECT public.set_updated_at('personal_calendar_items');

CREATE INDEX IF NOT EXISTS idx_personal_calendar_owner_starts
  ON public.personal_calendar_items(owner_id, starts_at);

ALTER TABLE public.personal_calendar_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personal_calendar_items_roles_owner ON public.personal_calendar_items;
CREATE POLICY personal_calendar_items_roles_owner ON public.personal_calendar_items
  FOR ALL USING (
    owner_id = auth.uid()
    AND public.has_any_role(ARRAY['admin','trainer','nutritionist']::public.app_role[])
  )
  WITH CHECK (
    owner_id = auth.uid()
    AND public.has_any_role(ARRAY['admin','trainer','nutritionist']::public.app_role[])
  );

COMMENT ON TABLE public.personal_calendar_items IS
  'Eventos de agenda solo del profesional (no ligados a students ni videollamadas de alumnos).';

-- ── 2) Planes promo 3 y 6 meses (FK students.selected_web_plan_slug) ─────────
INSERT INTO public.web_plans (
  slug,
  title,
  price_label,
  price_yearly_label,
  short_description,
  intro_text,
  includes_items,
  gifts_items,
  catalog_segment,
  display_badge,
  sort_order,
  is_active
)
VALUES
  (
    'promo-3m-ferster',
    'FERSTER FITNESS — 3 meses',
    '$165.600',
    NULL,
    'Pack trimestral con descuento: mismo servicio mensual, compromiso 3 meses.',
    'Incluye todo lo del plan mensual FERSTER FITNESS con precio total trimestral conveniente. Videollamadas de seguimiento, rutina personalizada y canal de consultas. Ideal si ya decidiste el camino y querés asegurar tu lugar varios meses.',
    ARRAY[
      'Videollamada de bienvenida gratuita.',
      'Videollamadas de seguimiento según plan mensual equivalente.',
      'Rutina personalizada y actualizaciones del período.',
      'Correcciones por WhatsApp o video.',
      'Materiales y guías digitales del programa.'
    ]::text[],
    ARRAY[
      'Calendario de hábitos incluido.',
      'Análisis de progreso y hábitos.',
      'Material descargable.'
    ]::text[],
    'solo',
    '3 meses',
    11,
    true
  ),
  (
    'promo-6m-ferster',
    'FERSTER FITNESS — 6 meses',
    '$306.000',
    NULL,
    'Pack semestral con mayor descuento: continuidad y mejor precio por mes.',
    'Seis meses de acompañamiento con el mismo estándar de calidad que el plan mensual, con beneficio por compromiso extendido. Seguimiento, ajustes de rutina y soporte como en la modalidad habitual, optimizando el valor del semestre.',
    ARRAY[
      'Videollamada de bienvenida gratuita.',
      'Videollamadas de seguimiento según plan mensual equivalente.',
      'Rutina personalizada y actualizaciones del período.',
      'Correcciones por WhatsApp o video.',
      'Materiales y guías digitales del programa.'
    ]::text[],
    ARRAY[
      'Calendario de hábitos incluido.',
      'Análisis de progreso y hábitos.',
      'Material descargable.'
    ]::text[],
    'solo',
    '6 meses',
    12,
    true
  ),
  (
    'promo-3m-nutricion',
    'Solo Nutrición — 3 meses',
    '$220.800',
    NULL,
    'Nutrición y hábitos: trimestral con descuento sobre la cuota mensual.',
    'Tres meses de plan nutricional y seguimiento con la misma propuesta que la modalidad mensual Solo Nutrición, con precio trimestral preferencial. Videollamadas, ajustes y soporte según la dinámica habitual del servicio.',
    ARRAY[
      'Videollamada de bienvenida gratuita.',
      'Seguimiento nutricional por videollamada según plan equivalente.',
      'Planificación y ajustes del período.',
      'Soporte por WhatsApp.',
      'Coordinación con otros profesionales si aplica.'
    ]::text[],
    ARRAY[
      'Calendario de hábitos incluido.',
      'Análisis de hábitos y evolución.',
      'Guías digitales.'
    ]::text[],
    'with_cris',
    '3 meses',
    21,
    true
  ),
  (
    'promo-6m-nutricion',
    'Solo Nutrición — 6 meses',
    '$408.000',
    NULL,
    'Nutrición semestral: mejor precio por mes con compromiso 6 meses.',
    'Medio año de acompañamiento nutricional con beneficios por pago/compromiso anticipado. Misma calidad de intervención que la mensual, pensado para quien busca constancia y ahorro en el total del período.',
    ARRAY[
      'Videollamada de bienvenida gratuita.',
      'Seguimiento nutricional por videollamada según plan equivalente.',
      'Planificación y ajustes del período.',
      'Soporte por WhatsApp.',
      'Coordinación con otros profesionales si aplica.'
    ]::text[],
    ARRAY[
      'Calendario de hábitos incluido.',
      'Análisis de hábitos y evolución.',
      'Guías digitales.'
    ]::text[],
    'with_cris',
    '6 meses',
    22,
    true
  ),
  (
    'promo-3m-full',
    'ENTRENO+NUTRICIÓN — 3 meses',
    '$276.000',
    NULL,
    'Plan integral trimestral: entreno + nutrición con descuento.',
    'Pack de tres meses combinando entrenamiento personalizado y nutrición, alineado al plan mensual integral con precio trimestral ventajoso. Evaluación, seguimiento y ajustes en ambas áreas durante el período.',
    ARRAY[
      'Videollamada de bienvenida y evaluación inicial.',
      'Seguimiento mensual combinado entreno + nutrición.',
      'Rutina y plan alimentario personalizados.',
      'Ajustes y correcciones por video o WhatsApp.',
      'Material de apoyo digital.'
    ]::text[],
    ARRAY[
      'Calendario de hábitos incluido.',
      'Seguimiento integral de progreso.',
      'Guías y recursos digitales.'
    ]::text[],
    'full',
    '3 meses',
    31,
    true
  ),
  (
    'promo-6m-full',
    'ENTRENO+NUTRICIÓN — 6 meses',
    '$510.000',
    NULL,
    'Plan integral semestral: máximo ahorro por mes con compromiso 6 meses.',
    'Seis meses de trabajo conjunto en entrenamiento y nutrición, con la misma propuesta de valor que la mensual pero optimizando el costo total del semestre. Ideal para objetivos de medio plazo con equipo profesional.',
    ARRAY[
      'Videollamada de bienvenida y evaluación inicial.',
      'Seguimiento mensual combinado entreno + nutrición.',
      'Rutina y plan alimentario personalizados.',
      'Ajustes y correcciones por video o WhatsApp.',
      'Material de apoyo digital.'
    ]::text[],
    ARRAY[
      'Calendario de hábitos incluido.',
      'Seguimiento integral de progreso.',
      'Guías y recursos digitales.'
    ]::text[],
    'full',
    '6 meses',
    32,
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  price_label = EXCLUDED.price_label,
  price_yearly_label = EXCLUDED.price_yearly_label,
  short_description = EXCLUDED.short_description,
  intro_text = EXCLUDED.intro_text,
  includes_items = EXCLUDED.includes_items,
  gifts_items = EXCLUDED.gifts_items,
  catalog_segment = EXCLUDED.catalog_segment,
  display_badge = EXCLUDED.display_badge,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
