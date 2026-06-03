import { INTAKE_FULL_INTEGRAL_SLUGS } from '@/lib/publicIntakeCatalogOffers'

/** Subcategorías del segmento `full` (Servicio dual), alineadas con /form. */
export type WebPlanFullSubcategory = 'entreno_nutricion' | 'entreno_psicologo' | 'mixto'

export const WEB_PLAN_FULL_SUBCATEGORIES = [
  { key: 'entreno_nutricion' as const, label: 'Entreno + Nutrición' },
  { key: 'entreno_psicologo' as const, label: 'Entreno + Psicólogo' },
] as const

/** Ofertas fijas entreno + nutrición (el título no siempre dice «nutri»). */
export function isCanonicalEntrenoNutricionPlan(slug: string, title: string): boolean {
  if (INTAKE_FULL_INTEGRAL_SLUGS.has(slug)) return true
  return /nutri/i.test(title) && !/psic/i.test(title)
}

export function isEntrenoPsicologoPlanTitle(title: string): boolean {
  return /psic/i.test(title) && !/nutri/i.test(title)
}

export function inferWebPlanFullSubcategory(slug: string, title: string): WebPlanFullSubcategory {
  if (isCanonicalEntrenoNutricionPlan(slug, title)) return 'entreno_nutricion'
  if (isEntrenoPsicologoPlanTitle(title)) return 'entreno_psicologo'
  return 'mixto'
}

export function webPlanFullSubcategoryLabel(slug: string, title: string): string | null {
  const key = inferWebPlanFullSubcategory(slug, title)
  if (key === 'mixto') return null
  return WEB_PLAN_FULL_SUBCATEGORIES.find((s) => s.key === key)?.label ?? null
}

/** Planes que el /form muestra bajo Servicio dual pero tienen otro segmento en BD. */
export function webPlanSegmentMismatchHint(
  catalogSegment: string,
  slug: string,
  title: string,
): string | null {
  const dualSub = inferWebPlanFullSubcategory(slug, title)
  if (dualSub === 'entreno_psicologo' && catalogSegment !== 'full') {
    return 'En /form aparece en Servicio dual (Entreno + Psicólogo). Asigná segmento «full» para editarla con el resto.'
  }
  if (dualSub === 'entreno_nutricion' && catalogSegment !== 'full') {
    return 'En /form aparece en Servicio dual (Entreno + Nutrición). Asigná segmento «full».'
  }
  return null
}
