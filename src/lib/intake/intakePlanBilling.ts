import type { IntakeNormalizedPricingPlan, PlanBilling } from '@/lib/publicIntakePlanPricing'

/** Plazos de pago que ofrece /form, en el orden en que se muestran. */
export const INTAKE_BILLING_OPTIONS: { value: PlanBilling; label: string }[] = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'months3', label: '3 meses' },
  { value: 'months6', label: '6 meses' },
  { value: 'annual', label: 'Anual' },
]

export function intakeBillingCaption(billing: PlanBilling): string {
  switch (billing) {
    case 'monthly':
      return 'por mes'
    case 'months3':
      return 'total por 3 meses'
    case 'months6':
      return 'total por 6 meses'
    case 'annual':
      return 'por año, pago único'
  }
}

export function intakePlanPriceFor(plan: IntakeNormalizedPricingPlan, billing: PlanBilling): string {
  switch (billing) {
    case 'monthly':
      return plan.priceMonthlyDisplay
    case 'months3':
      return plan.price3MonthsDisplay
    case 'months6':
      return plan.price6MonthsDisplay
    case 'annual':
      return plan.priceYearlyDisplay
  }
}

/** Nombres cargados en MAYÚSCULAS se muestran como título («HÁBITOS LEYENDA» → «Hábitos Leyenda»). */
export function intakePlanTitle(name: string): string {
  const t = name.trim()
  if (!t || t !== t.toLocaleUpperCase('es') || t === t.toLocaleLowerCase('es')) return t
  return t.toLocaleLowerCase('es').replace(/(^|[\s—–\-/(])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('es'))
}
