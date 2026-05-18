import type { WebPlanCatalogSegment } from '@/types/database'
import {
  INTAKE_FERSTER_OFFERS,
  INTAKE_FULL_INTEGRAL_OFFERS,
  type PublicIntakePlanDetail,
} from '@/lib/publicIntakeCatalogOffers'

export type CanonicalEditableWebPlan = {
  slug: string
  title: string
  price_label: string
  price_yearly_label: string | null
  price_3m_label: string | null
  price_6m_label: string | null
  short_description: string
  intro_text: string
  includes_items: string[]
  gifts_items: string[]
  sort_order: number
  is_active: boolean
  show_in_public_intake: boolean
  catalog_segment: WebPlanCatalogSegment
  display_badge: string | null
  credential_line_override: string | null
  /** Oferta base del catálogo público (/form); no es variante 3m/6m. */
  isCatalogCanonical: boolean
}

/** Nutrición individual — misma oferta que en /form (slug `plan-nutricion`). */
export const INTAKE_NUTRITION_OFFER: PublicIntakePlanDetail = {
  id: 'plan-nutricion',
  catalogSegment: 'with_nutritionist',
  displayBadge: null,
  credentialLineOverride: null,
  name: 'Nutrición individual',
  price: '$80.000',
  priceYearly: '$800.000',
  badge: 'Nutrición',
  shortDescription:
    'Plan nutricional personalizado con seguimiento mensual, antropometría y soporte continuo.',
  intro:
    'Acompañamiento nutricional integral para establecer y mantener hábitos saludables de forma sostenida, con planificación adaptada a tu contexto, objetivos y estilo de vida.',
  info: [
    'Videollamada de bienvenida gratuita.',
    'Videollamada mensual para seguimiento de progreso.',
    'Planificación nutricional adaptada a tus objetivos.',
    'Antropometría y ajustes mensuales según evolución.',
    'Soporte y seguimiento continuo por WhatsApp.',
    'Coordinación con tu equipo de profesionales si aplica.',
  ],
  gifts: [
    'Calendario gratis para anotar tus hábitos.',
    'Análisis estadístico de hábitos y progreso.',
    'En mujeres: análisis del ciclo menstrual y su rendimiento.',
    'Materiales y guías digitales.',
  ],
}

/** Orden fijo en gestión y en /form (7 planes base). */
export const CANONICAL_WEB_PLAN_SLUGS: readonly string[] = [
  'ferster-habitos-sedentario',
  'ferster-habitos-alto-rendimiento',
  'ferster-habitos-avanzado',
  'plan-nutricion',
  'cris-habitos-deportista',
  'cris-habitos-platino',
  'cris-habitos-premium',
] as const

const CANONICAL_SLUG_SET = new Set<string>(CANONICAL_WEB_PLAN_SLUGS)

export function isCanonicalWebPlanSlug(slug: string): boolean {
  return CANONICAL_SLUG_SET.has(slug)
}

function offerToEditable(offer: PublicIntakePlanDetail, sortOrder: number): CanonicalEditableWebPlan {
  return {
    slug: offer.id,
    title: offer.name,
    price_label: offer.price,
    price_yearly_label: offer.priceYearly,
    price_3m_label: offer.price3mLabel ?? null,
    price_6m_label: offer.price6mLabel ?? null,
    short_description: offer.shortDescription,
    intro_text: offer.intro,
    includes_items: [...offer.info],
    gifts_items: [...offer.gifts],
    sort_order: sortOrder,
    is_active: true,
    show_in_public_intake: true,
    catalog_segment: offer.catalogSegment,
    display_badge: offer.displayBadge,
    credential_line_override: offer.credentialLineOverride,
    isCatalogCanonical: true,
  }
}

export function buildCanonicalWebPlans(): CanonicalEditableWebPlan[] {
  const offers: PublicIntakePlanDetail[] = [
    ...INTAKE_FERSTER_OFFERS,
    INTAKE_NUTRITION_OFFER,
    ...INTAKE_FULL_INTEGRAL_OFFERS,
  ]
  return offers.map((o, i) => offerToEditable(o, i + 1))
}

type DbRow = Omit<CanonicalEditableWebPlan, 'isCatalogCanonical'>

/** Combina las 7 ofertas del catálogo con filas de `web_plans` (DB gana en campos editados). */
export function mergeWebPlansForManagement(dbRows: DbRow[]): CanonicalEditableWebPlan[] {
  const canonical = buildCanonicalWebPlans()
  const dbBySlug = new Map(dbRows.map((r) => [r.slug, r]))

  const mergedCanonical = canonical.map((base) => {
    const db = dbBySlug.get(base.slug)
    if (!db) return base
    return {
      ...base,
      ...db,
      isCatalogCanonical: true,
      catalog_segment: db.catalog_segment ?? base.catalog_segment,
    }
  })

  const extras = dbRows
    .filter((r) => !isCanonicalWebPlanSlug(r.slug))
    .sort((a, b) => a.sort_order - b.sort_order || a.slug.localeCompare(b.slug))
    .map((r, i) => ({
      ...r,
      isCatalogCanonical: false,
      sort_order: mergedCanonical.length + i + 1,
    }))

  return [...mergedCanonical, ...extras]
}
