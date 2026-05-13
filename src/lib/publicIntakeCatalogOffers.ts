import type { WebPlanCatalogSegment } from '@/types/database'

/** Fila de oferta del intake público (alineada con `web_plans` + defaults de la app). */
export type PublicIntakePlanDetail = {
  id: string
  catalogSegment: WebPlanCatalogSegment
  displayBadge: string | null
  credentialLineOverride: string | null
  name: string
  price: string
  priceYearly: string | null
  badge: string
  shortDescription: string
  intro: string
  info: string[]
  gifts: string[]
}

const GIFTS_STANDARD: string[] = [
  'Calendario gratis para anotar tus hábitos.',
  'Análisis estadístico de hábitos y progreso.',
  'En mujeres: análisis del ciclo menstrual y su rendimiento.',
  'Materiales y guías digitales.',
]

/** Plan integral cuando no hay filas `full` en `web_plans`. */
export const DEFAULT_FULL_PLAN: PublicIntakePlanDetail = {
  id: 'plan-full',
  catalogSegment: 'full',
  displayBadge: null,
  credentialLineOverride: null,
  name: 'Plan Full',
  price: '$100.000',
  priceYearly: '$1.000.000',
  badge: 'Full',
  shortDescription: 'Combina entrenamiento + nutrición en un plan integral.',
  intro:
    'Plan integral que abarca entrenamiento y nutrición en conjunto, orientado a maximizar resultados con acompañamiento completo, estrategia personalizada y seguimiento continuo.',
  info: [
    'Videollamada de bienvenida + evaluación inicial completa.',
    'Videollamada mensual de progreso y ajustes.',
    'Rutina 100% personalizada + planificación nutricional.',
    'Ajustes mensuales de entrenamiento y alimentación.',
    'Correcciones técnicas por video o WhatsApp.',
    'Soporte continuo y encuentros presenciales cuando se puedan pactar.',
  ],
  gifts: GIFTS_STANDARD,
}

/** FERSTER FITNESS (`solo`): tres ofertas fijas (contenido entrenador). */
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

/** NUTRICIÓN (`with_cris`): tres ofertas fijas (Cris + Tomi). */
export const INTAKE_CRIS_OFFERS: PublicIntakePlanDetail[] = [
  {
    id: 'cris-habitos-deportista',
    catalogSegment: 'with_cris',
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
    catalogSegment: 'with_cris',
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
    catalogSegment: 'with_cris',
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

/**
 * Catálogo del formulario público: ofertas Ferster y Rutinas con Cris son fijas;
 * las ofertas `full` siguen viniendo de `web_plans` si existen.
 */
export function mergePublicIntakePlansFromDb(dbPlans: PublicIntakePlanDetail[]): PublicIntakePlanDetail[] {
  const fullPlans = dbPlans.filter((p) => p.catalogSegment === 'full')
  const full = fullPlans.length > 0 ? fullPlans : [DEFAULT_FULL_PLAN]
  return [...INTAKE_FERSTER_OFFERS, ...INTAKE_CRIS_OFFERS, ...full]
}
