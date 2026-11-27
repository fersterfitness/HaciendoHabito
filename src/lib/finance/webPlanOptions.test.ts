import { describe, expect, it } from 'vitest'
import { webPlanOptions, webPlanSlugFrom, webPlanValue } from './webPlanOptions'

describe('webPlanOptions', () => {
  const plans = [
    { slug: 'plan-full', title: 'Plan Full', is_active: true, price_label: '$ 45.000' },
    { slug: 'plan-viejo', title: 'Plan Viejo', is_active: false, price_label: '$ 10.000' },
    { slug: 'plan-full', title: 'Repetido', is_active: true, price_label: '' },
    { slug: 'plan-sin-precio', title: '', is_active: true, price_label: null },
  ]

  it('deja los activos sin repetir y usa el slug si no hay título', () => {
    const out = webPlanOptions(plans, null)
    expect(out.map((p) => p.slug)).toEqual(['plan-full', 'plan-sin-precio'])
    expect(out[1].title).toBe('plan-sin-precio')
    expect(out[1].price).toBe(0)
  })

  it('suma el plan inactivo si es el del alumno', () => {
    expect(webPlanOptions(plans, 'plan-viejo').map((p) => p.slug)).toContain('plan-viejo')
  })

  it('arma y lee el valor del select', () => {
    expect(webPlanSlugFrom(webPlanValue('plan-full'))).toBe('plan-full')
    expect(webPlanSlugFrom('Cuota mensual')).toBeNull()
    expect(webPlanSlugFrom('web:')).toBeNull()
  })
})
