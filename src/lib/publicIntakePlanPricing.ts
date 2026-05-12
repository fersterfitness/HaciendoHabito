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
}

export function intakePlansToPricingPlans(
  plans: Array<{
    id: string
    name: string
    shortDescription: string
    price: string
    priceYearly?: string | null
    badge: string
    info: string[]
  }>,
): IntakeNormalizedPricingPlan[] {
  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.shortDescription,
    priceMonthlyDisplay: p.price,
    price3MonthsDisplay: bundlePrice3Months(p.price),
    price6MonthsDisplay: bundlePrice6Months(p.price),
    priceYearlyDisplay: effectiveYearlyLabel(p.price, p.priceYearly),
    badge: p.badge,
    featuresLabel: 'Incluye',
    features: p.info.map((text) => ({ text })),
  }))
}
