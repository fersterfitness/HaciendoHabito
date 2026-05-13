/** Modalidades de pago en /form (x3/x6: total referencial desde precio mensual con descuento). */
export type PlanBilling = 'monthly' | 'months3' | 'months6' | 'annual'

/** Ordena y parsea precios tipo «$60.000», «$100.000». */
export function numericFromPriceLabel(label: string): number {
  const digits = label.replace(/\s/g, '').replace(/[^\d]/g, '')
  return digits ? parseInt(digits, 10) : 0
}

export function formatArsRounded(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  return `$${Math.round(n).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

/** Precio anual configurado en panel, o valor referencial 10× mensual si falta. */
export function effectiveYearlyLabel(monthlyLabel: string, yearlyLabel: string | null | undefined): string {
  const t = yearlyLabel?.trim()
  if (t) return t
  const n = numericFromPriceLabel(monthlyLabel)
  if (n <= 0) return monthlyLabel
  return formatArsRounded(n * 10)
}

/** Descuento referencial al pagar bloque (UI; no implica checkout). */
const BUNDLE_3M_FACTOR = 0.95
const BUNDLE_6M_FACTOR = 0.9

/**
 * Ofertas «pack» 3 o 6 meses en `web_plans` (slug promo-* o título tipo «Algo — 3 meses»).
 * En el /form solo deben listarse cuando el toggle coincide (x3 / x6), no en Mensual ni Anual.
 */
export function inferWebPlanBundleCommitment(planId: string, planName: string): 3 | 6 | null {
  const id = planId.trim().toLowerCase()
  if (id.startsWith('promo-3m-')) return 3
  if (id.startsWith('promo-6m-')) return 6
  const n = planName.trim()
  if (/\b(—|–|-)\s*3\s*meses\b/i.test(n)) return 3
  if (/\b(—|–|-)\s*6\s*meses\b/i.test(n)) return 6
  return null
}

export function planVisibleForIntakeBilling(bundleMonths: 3 | 6 | null, billing: PlanBilling): boolean {
  if (bundleMonths == null) return true
  if (billing === 'monthly' || billing === 'annual') return false
  if (billing === 'months3') return bundleMonths === 3
  if (billing === 'months6') return bundleMonths === 6
  return true
}

/** Total redondeado ARS por 3 meses (~5% menos que 3× mensual). */
export function bundlePrice3Months(monthlyLabel: string): string {
  const n = numericFromPriceLabel(monthlyLabel)
  if (n <= 0) return monthlyLabel
  return formatArsRounded(Math.round(n * 3 * BUNDLE_3M_FACTOR))
}

/** Total redondeado ARS por 6 meses (~10% menos que 6× mensual). */
export function bundlePrice6Months(monthlyLabel: string): string {
  const n = numericFromPriceLabel(monthlyLabel)
  if (n <= 0) return monthlyLabel
  return formatArsRounded(Math.round(n * 6 * BUNDLE_6M_FACTOR))
}

export interface IntakeNormalizedPricingPlan {
  id: string
  name: string
  description: string
  priceMonthlyDisplay: string
  price3MonthsDisplay: string
  price6MonthsDisplay: string
  priceYearlyDisplay: string
  badge?: string | null
  featuresLabel?: string
  features: { text: string; hasInfo?: boolean }[]
  giftsLabel?: string
  gifts?: { text: string }[]
}

export function intakePlansToPricingPlans(
  plans: Array<{
    id: string
    name: string
    shortDescription: string
    price: string
    priceYearly?: string | null
    price3mLabel?: string | null
    price6mLabel?: string | null
    badge: string
    info: string[]
    gifts?: string[]
  }>,
): IntakeNormalizedPricingPlan[] {
  return plans.map((p) => {
    const commit = inferWebPlanBundleCommitment(p.id, p.name)
    const totalN = numericFromPriceLabel(p.price)
    const override3 = p.price3mLabel?.trim()
    const override6 = p.price6mLabel?.trim()

    if (commit === 3 && totalN > 0) {
      const impliedMonthly = formatArsRounded(Math.round(totalN / 3))
      return {
        id: p.id,
        name: p.name,
        description: p.shortDescription,
        priceMonthlyDisplay: impliedMonthly,
        price3MonthsDisplay: p.price,
        price6MonthsDisplay: override6 || bundlePrice6Months(impliedMonthly),
        priceYearlyDisplay: effectiveYearlyLabel(impliedMonthly, p.priceYearly),
        badge: p.badge,
        featuresLabel: 'Incluye',
        features: p.info.map((text) => ({ text })),
        giftsLabel: p.gifts?.length ? 'De regalo' : undefined,
        gifts: p.gifts?.length ? p.gifts.map((text) => ({ text })) : undefined,
      }
    }

    if (commit === 6 && totalN > 0) {
      const impliedMonthly = formatArsRounded(Math.round(totalN / 6))
      return {
        id: p.id,
        name: p.name,
        description: p.shortDescription,
        priceMonthlyDisplay: impliedMonthly,
        price3MonthsDisplay: override3 || bundlePrice3Months(impliedMonthly),
        price6MonthsDisplay: p.price,
        priceYearlyDisplay: effectiveYearlyLabel(impliedMonthly, p.priceYearly),
        badge: p.badge,
        featuresLabel: 'Incluye',
        features: p.info.map((text) => ({ text })),
        giftsLabel: p.gifts?.length ? 'De regalo' : undefined,
        gifts: p.gifts?.length ? p.gifts.map((text) => ({ text })) : undefined,
      }
    }

    return {
      id: p.id,
      name: p.name,
      description: p.shortDescription,
      priceMonthlyDisplay: p.price,
      price3MonthsDisplay: override3 || bundlePrice3Months(p.price),
      price6MonthsDisplay: override6 || bundlePrice6Months(p.price),
      priceYearlyDisplay: effectiveYearlyLabel(p.price, p.priceYearly),
      badge: p.badge,
      featuresLabel: 'Incluye',
      features: p.info.map((text) => ({ text })),
      giftsLabel: p.gifts?.length ? 'De regalo' : undefined,
      gifts: p.gifts?.length ? p.gifts.map((text) => ({ text })) : undefined,
    }
  })
}
