import { describe, expect, it } from 'vitest'
import {
  addMonthsYmd,
  increaseAmount,
  increasePriceLabel,
  priceIncreaseNoticeMessage,
  priceIncreaseStage,
} from '@/lib/finance/priceIncrease'

describe('aumento de precios', () => {
  it('aumenta y redondea', () => {
    expect(increaseAmount(45000, 3, 100)).toBe(46400) // 46.350 → 46.400
    expect(increaseAmount(45000, 3, 1)).toBe(46350)
  })

  it('aumenta etiquetas de la web conservando el formato', () => {
    expect(increasePriceLabel('$80.000', 3, 100)).toBe('$82.400')
    expect(increasePriceLabel('$1.000.000 / año', 3, 1000)).toBe('$1.030.000 / año')
    expect(increasePriceLabel('$—', 3, 100)).toBeNull()
  })

  it('aviso 15 días antes y aplicar en la fecha', () => {
    expect(priceIncreaseStage('2026-12-01', new Date(2026, 10, 15)).stage).toBe(null) // faltan 16
    expect(priceIncreaseStage('2026-12-01', new Date(2026, 10, 16))).toEqual({ stage: 'notice', daysLeft: 15 })
    expect(priceIncreaseStage('2026-12-01', new Date(2026, 11, 1)).stage).toBe('due')
    expect(priceIncreaseStage(null, new Date()).stage).toBe(null)
  })

  it('próxima fecha cada N meses y mensaje con el día de inicio', () => {
    expect(addMonthsYmd('2026-12-01', 3)).toBe('2027-03-01')
    expect(priceIncreaseNoticeMessage('2026-12-01')).toContain('Arranca el 1 de diciembre.')
  })
})
