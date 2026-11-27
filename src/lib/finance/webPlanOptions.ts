import { numericFromPriceLabel } from '@/lib/publicIntakePlanPricing'

/**
 * Feedback nov27 (5): en «Registrar pago», los planes de la web como tipo de ingreso. Elegir uno lo deja como
 * plan del alumno (`students.selected_web_plan_slug`), para los que entraron por el formulario anterior.
 */
export interface WebPlanOption {
  slug: string
  title: string
  /** Precio mensual; 0 si no se puede leer. */
  price: number
}

/** El valor del select: los planes van con prefijo para no confundirse con los tipos de ingreso fijos. */
export const WEB_PLAN_PREFIX = 'web:'

export function webPlanValue(slug: string): string {
  return WEB_PLAN_PREFIX + slug
}

export function webPlanSlugFrom(value: string): string | null {
  return value.startsWith(WEB_PLAN_PREFIX) ? value.slice(WEB_PLAN_PREFIX.length) || null : null
}

/** Planes activos, más el del alumno aunque ya no esté activo, sin repetir. */
export function webPlanOptions(
  plans: { slug: string; title: string; is_active?: boolean | null; price_label?: string | null }[] | null | undefined,
  currentSlug: string | null | undefined,
): WebPlanOption[] {
  const out: WebPlanOption[] = []
  for (const p of plans ?? []) {
    const slug = p.slug?.trim()
    if (!slug || out.some((o) => o.slug === slug)) continue
    if (p.is_active === false && slug !== currentSlug?.trim()) continue
    out.push({ slug, title: p.title?.trim() || slug, price: numericFromPriceLabel(p.price_label ?? '') })
  }
  return out
}
