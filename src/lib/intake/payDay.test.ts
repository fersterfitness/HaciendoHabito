import { describe, expect, it } from 'vitest'
import { paymentNotesSchema, preferredPayDayOf, withPreferredPayDay } from '@/lib/intake/payDay'

describe('día de pago del formulario (feedback nov19)', () => {
  it('el último día del mes y la lectura de lo elegido', () => {
    const notes = withPreferredPayDay('alias juan.mp', 'ultimo')
    expect(notes).toBe('Prefiere pagar el último día de cada mes.\nalias juan.mp')
    expect(preferredPayDayOf(notes)).toBe('ultimo')
    expect(preferredPayDayOf(withPreferredPayDay(notes, '15'))).toBe('15')
    expect(preferredPayDayOf('alias juan.mp')).toBe('')
  })

  it('es obligatorio elegir el día', () => {
    expect(paymentNotesSchema.safeParse('').success).toBe(false)
    expect(paymentNotesSchema.safeParse('alias juan.mp').success).toBe(false)
    expect(paymentNotesSchema.safeParse('Prefiere pagar el día 5 de cada mes.').success).toBe(true)
  })
})
