import type { WebPlanCatalogSegment, WebPlanIncludeSection } from '@/types/database'

/** Fila de oferta del intake público (alineada con `web_plans` + defaults de la app). */
export type PublicIntakePlanDetail = {
  id: string
  catalogSegment: WebPlanCatalogSegment
  displayBadge: string | null
  credentialLineOverride: string | null
  name: string
  price: string
  priceYearly: string | null
  /** Opcional: override para toggle x3 (solo filas desde panel si se persisten en código futuro). */
  price3mLabel?: string | null
  price6mLabel?: string | null
  badge: string
  shortDescription: string
  intro: string
  info: string[]
  /** Secciones por profesional (Entrenador / Psicólogo / Nutricionista) con colores en el form. */
  includeSections?: WebPlanIncludeSection[]
  gifts: string[]
}

const GIFTS_STANDARD: string[] = [
  'Calendario gratis para anotar tus hábitos.',
  'Análisis estadístico de hábitos y progreso.',
  'En mujeres: análisis del ciclo menstrual y su rendimiento.',
  'Materiales y guías digitales.',
]

/** Slugs de las tres ofertas fijas «Plan full» (entreno + nutrición). No se duplican desde `web_plans`. */
export const INTAKE_FULL_INTEGRAL_SLUGS = new Set([
  'cris-habitos-deportista',
  'cris-habitos-platino',
  'cris-habitos-premium',
])

/** Slugs de ofertas full en DB que ya cubre el catálogo fijo (evitar tarjeta genérica duplicada). */
const LEGACY_FULL_SLUGS_HIDE_FROM_DB = new Set(['plan-full'])

/** Nutrición individual — fallback en /form si la query a `web_plans` falla o está vacía. */
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

/** FERSTER FITNESS (`solo`): tres ofertas fijas. */
export const INTAKE_FERSTER_OFFERS: PublicIntakePlanDetail[] = [
  {
    id: 'ferster-habitos-alto-rendimiento',
    catalogSegment: 'solo',
    displayBadge: null,
    credentialLineOverride: null,
    name: 'Hábitos alto rendimiento',
    price: '$60.000',
    priceYearly: '$600.000',
    badge: 'Alto rendimiento',
    shortDescription:
      'Entrenamiento orientado al rendimiento, fuerza, resistencia y recuperación, con calendario competitivo.',
    intro:
      'Plan avanzado de entrenamiento orientado al rendimiento físico, especializado en tu deporte. Enfoque en fuerza, resistencia y recuperación, con seguimiento personalizado, planes de entrenamiento progresivos y soporte continuo con ajustes según tu calendario competitivo.',
    info: [
      'Videollamada de bienvenida gratuita.',
      'Videollamada mensual para ajustes, progreso y organización del calendario competitivo.',
      'Actualización mensual de tu rutina y ajuste del calendario competitivo.',
      'Rutina 100% personalizada según etapas de competición o fuera de temporada.',
      'Correcciones por WhatsApp o video y seguimiento continuo.',
      'Encuentro presencial para testeos o ajustes muy técnicos.',
    ],
    gifts: GIFTS_STANDARD,
  },
  {
    id: 'ferster-habitos-avanzado',
    catalogSegment: 'solo',
    displayBadge: null,
    credentialLineOverride: null,
    name: 'Hábitos avanzado',
    price: '$45.000',
    priceYearly: '$450.000',
    badge: 'Avanzado',
    shortDescription:
      'Acompañamiento integral para hábitos saludables: rutinas, videollamadas mensuales y guía alimentaria.',
    intro:
      'Plan de acompañamiento integral para establecer y mantener hábitos saludables de forma sostenida, con seguimiento personalizado, rutinas detalladas, videollamadas mensuales, guía de alimentación y soporte continuo.',
    info: [
      'Videollamada de bienvenida gratuita.',
      'Videollamada mensual para ajustes y progreso.',
      'Actualización mensual de tu rutina.',
      'Rutina 100% personalizada según tus contextos y objetivos.',
      'Guía de alimentación según tu contexto. Si tenés nutricionista, coordinamos con él o ella para ajustar el progreso y trabajar en equipo.',
      'Correcciones por WhatsApp o video y seguimiento continuo.',
      'Encuentro presencial cuando se requiera o pueda pactarse.',
    ],
    gifts: GIFTS_STANDARD,
  },
  {
    id: 'ferster-habitos-sedentario',
    catalogSegment: 'solo',
    displayBadge: null,
    credentialLineOverride: null,
    name: 'Hábitos sedentario',
    price: '$60.000',
    priceYearly: '$600.000',
    badge: 'Desde casa',
    shortDescription:
      'Empezar desde cero en casa, sin gimnasio: guía alimentaria, correcciones y videollamadas tipo clase.',
    intro:
      'Plan diseñado para empezar desde cero: ideal si entrenás en tu casa y no podés ir a un gimnasio. Incluye guía alimentaria, correcciones y videollamadas frecuentes que funcionan como clases presenciales cuando la modalidad lo permite.',
    info: [
      'Videollamada de bienvenida gratuita.',
      'Videollamada con seguimiento en vivo 1 a 1 (costo adicional de $10.000 por clase).',
      'Actualización mensual de tu rutina adaptada a tu hogar.',
      'Rutina 100% personalizada según tus contextos y objetivos.',
      'Guía de alimentación según tu contexto. Si tenés nutricionista, coordinamos para trabajar en equipo.',
      'Correcciones en vivo más seguimiento por WhatsApp.',
      'Entreno presencial cuando pueda pactarse (costo adicional).',
    ],
    gifts: GIFTS_STANDARD,
  },
]

/**
 * Plan full (ENTRENO + NUTRICIÓN): tres ofertas fijas (antes bajo modalidad nutrición; ahora solo esta modalidad las lista).
 * Se mantienen los mismos `id`/slug para no romper envíos previos del formulario.
 */
export const INTAKE_FULL_INTEGRAL_OFFERS: PublicIntakePlanDetail[] = [
  {
    id: 'cris-habitos-deportista',
    catalogSegment: 'full',
    displayBadge: null,
    credentialLineOverride: null,
    name: 'Hábitos deportista',
    price: '$100.000',
    priceYearly: '$1.000.000',
    badge: 'Deportista',
    shortDescription:
      'Entrenamiento y nutrición para rendimiento: fuerza, resistencia, recuperación y antropometría.',
    intro:
      'Plan avanzado de entrenamiento y nutrición orientado al rendimiento físico, especializado en tu deporte. Enfoque en fuerza, resistencia y recuperación, con seguimiento personalizado, planes de entrenamiento progresivos, antropometría y seguimiento continuo.',
    info: [
      'Videollamada de bienvenida gratuita (con Cris: encuentro presencial).',
      'Videollamada mensual para seguimiento de progreso (con Cris: encuentro presencial).',
      'Videollamada mensual para ajustes, progreso y organización del calendario competitivo.',
      'Actualización mensual de tu rutina.',
      'Rutina 100% personalizada según etapas de competición o fuera de temporada.',
      'Planificación nutricional según tu deporte y contexto + antropometría mensual (Lomas de Zamora).',
      'Correcciones de ejercicios por video o WhatsApp (Tomi).',
      'Soporte y seguimiento continuo por WhatsApp (ambos).',
      'Encuentro presencial con ambos cuando pueda pactarse.',
    ],
    gifts: GIFTS_STANDARD,
  },
  {
    id: 'cris-habitos-platino',
    catalogSegment: 'full',
    displayBadge: null,
    credentialLineOverride: null,
    name: 'Hábitos platino',
    price: '$90.000',
    priceYearly: '$900.000',
    badge: 'Platino',
    shortDescription:
      'Premium integral: rutinas, videollamadas, plan de alimentación, antropometría y soporte continuo.',
    intro:
      'Plan premium de acompañamiento integral para establecer y mantener hábitos saludables de forma sostenida, con seguimiento personalizado, rutinas detalladas, videollamadas mensuales, plan de alimentación, antropometría y soporte continuo.',
    info: [
      'Videollamada de bienvenida gratuita (con Cris: encuentro presencial).',
      'Videollamada mensual para seguimiento de progreso (con Cris: encuentro presencial).',
      'Videollamada mensual para ajustes y progreso.',
      'Actualización mensual de tu rutina.',
      'Rutina 100% personalizada según tus objetivos.',
      'Planificación nutricional según tus objetivos y contexto + antropometría mensual (Lomas de Zamora).',
      'Correcciones de ejercicios por video o WhatsApp (Tomi).',
      'Soporte y seguimiento continuo por WhatsApp (ambos).',
      'Encuentro presencial con ambos cuando pueda pactarse.',
    ],
    gifts: GIFTS_STANDARD,
  },
  {
    id: 'cris-habitos-premium',
    catalogSegment: 'full',
    displayBadge: null,
    credentialLineOverride: null,
    name: 'Hábitos premium',
    price: '$80.000',
    priceYearly: '$800.000',
    badge: 'Premium',
    shortDescription:
      'Integral premium: rutinas, videollamadas, plan de alimentación y soporte continuo.',
    intro:
      'Plan premium de acompañamiento integral para establecer y mantener hábitos saludables de forma sostenida, con seguimiento personalizado, rutinas detalladas, videollamadas mensuales, plan de alimentación y soporte continuo.',
    info: [
      'Videollamada de bienvenida gratuita.',
      'Videollamada mensual para seguimiento de progreso.',
      'Videollamada mensual para ajustes y progreso.',
      'Actualización mensual de tu rutina.',
      'Rutina 100% personalizada según tus objetivos.',
      'Planificación nutricional según tus objetivos y contexto.',
      'Correcciones de ejercicios por video o WhatsApp (Tomi).',
      'Soporte y seguimiento continuo por WhatsApp (ambos).',
      'Encuentro presencial con ambos cuando pueda pactarse.',
    ],
    gifts: GIFTS_STANDARD,
  },
]

const HIDE_DB_FULL_SLUGS = new Set([...INTAKE_FULL_INTEGRAL_SLUGS, ...LEGACY_FULL_SLUGS_HIDE_FROM_DB])

const INTAKE_FERSTER_SLUGS = new Set(INTAKE_FERSTER_OFFERS.map((o) => o.id))

function overlayIntakeOfferFromDb(
  base: PublicIntakePlanDetail,
  db?: PublicIntakePlanDetail,
): PublicIntakePlanDetail {
  if (!db) return base
  return {
    ...base,
    ...db,
    id: base.id,
    catalogSegment: base.catalogSegment,
  }
}

function mergeCanonicalIntakeOffers(
  offers: PublicIntakePlanDetail[],
  dbById: Map<string, PublicIntakePlanDetail>,
): PublicIntakePlanDetail[] {
  return offers.map((base) => overlayIntakeOfferFromDb(base, dbById.get(base.id)))
}

/**
 * Catálogo del formulario público:
 * - Ferster: 3 ofertas fijas (`solo`) + extras `solo` en `web_plans` (p. ej. ACTION SPORT GYM).
 * - Nutrición (`with_nutritionist`): filas en `web_plans` con ese segmento (activas y «Mostrar en /form» ya filtradas en la query).
 * - Plan full: 3 ofertas fijas + filas extra `full` en `web_plans` (promos, etc.), sin duplicar las fijas ni `plan-full` genérico.
 */
export function mergePublicIntakePlansFromDb(dbPlans: PublicIntakePlanDetail[]): PublicIntakePlanDetail[] {
  const dbById = new Map(dbPlans.map((p) => [p.id, p]))
  const ferster = mergeCanonicalIntakeOffers(INTAKE_FERSTER_OFFERS, dbById)
  const extraSolo = dbPlans.filter((p) => p.catalogSegment === 'solo' && !INTAKE_FERSTER_SLUGS.has(p.id))
  const fullIntegral = mergeCanonicalIntakeOffers(INTAKE_FULL_INTEGRAL_OFFERS, dbById)
  const extraFull = dbPlans.filter((p) => p.catalogSegment === 'full' && !HIDE_DB_FULL_SLUGS.has(p.id))
  const extraWithNutritionist = dbPlans.filter((p) => p.catalogSegment === 'with_nutritionist')
  const extraPsychologist = dbPlans.filter((p) => p.catalogSegment === 'psychologist')
  const nutrition =
    extraWithNutritionist.length > 0
      ? extraWithNutritionist
      : [overlayIntakeOfferFromDb(INTAKE_NUTRITION_OFFER, dbById)]
  return [...ferster, ...extraSolo, ...fullIntegral, ...extraFull, ...nutrition, ...extraPsychologist]
}
