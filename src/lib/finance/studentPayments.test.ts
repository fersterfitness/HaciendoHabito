import { describe, expect, it } from 'vitest'
import { buildPaymentBoard, computePaymentState, overduePaymentMessage, paymentWindowLabel } from '@/lib/finance/studentPayments'

const oct = new Date(2026, 9, 1)

describe('computePaymentState', () => {
  it('vence pasado el último día de la ventana en el mes en curso', () => {
    expect(computePaymentState({ expected: 50000, paid: 0, dayTo: 5, month: oct, today: new Date(2026, 9, 6) })).toBe('vencido')
    expect(computePaymentState({ expected: 50000, paid: 0, dayTo: 5, month: oct, today: new Date(2026, 9, 5) })).toBe('pendiente')
  })

  it('pagado si lo cobrado cubre lo esperado', () => {
    expect(computePaymentState({ expected: 50000, paid: 50000, dayTo: 5, month: oct, today: new Date(2026, 9, 20) })).toBe('pagado')
  })

  it('parcial si cobró algo y sigue en fecha', () => {
    expect(computePaymentState({ expected: 50000, paid: 20000, dayTo: 10, month: oct, today: new Date(2026, 9, 3) })).toBe('parcial')
  })

  it('un mes anterior sin cubrir queda vencido', () => {
    expect(computePaymentState({ expected: 50000, paid: 0, dayTo: null, month: new Date(2026, 8, 1), today: new Date(2026, 9, 2) })).toBe('vencido')
  })

  it('ventana del 31 en un mes de 30 días vence el 30', () => {
    const sep = new Date(2026, 8, 1)
    expect(computePaymentState({ expected: 1, paid: 0, dayTo: 31, month: sep, today: new Date(2026, 8, 30) })).toBe('pendiente')
  })
})

describe('buildPaymentBoard', () => {
  it('usa la rutina pendiente como lo esperado y suma cobros del mes', () => {
    const rows = buildPaymentBoard({
      students: [{ id: 's1', full_name: 'Rosa Villar', monthly_fee_amount: 40000, payment_day_from: 1, payment_day_to: 5 }],
      incomes: [
        { id: 'i1', student_id: 's1', amount: 37500, status: 'pendiente', income_date: '2026-10-02', payment_method: 'transferencia' },
      ],
      month: oct,
      today: new Date(2026, 9, 8),
    })
    expect(rows[0].expected).toBe(37500)
    expect(rows[0].state).toBe('vencido')
    expect(rows[0].pendingIncomeIds).toEqual(['i1'])
  })

  it('sin rutina pendiente espera la cuota mensual', () => {
    const rows = buildPaymentBoard({
      students: [{ id: 's1', full_name: 'Gus', monthly_fee_amount: 40000 }],
      incomes: [{ id: 'i1', student_id: 's1', amount: 40000, status: 'cobrado', income_date: '2026-10-03', payment_method: 'cuenta_dni' }],
      month: oct,
      today: new Date(2026, 9, 8),
    })
    expect(rows[0].state).toBe('pagado')
    expect(rows[0].methods).toEqual(['cuenta_dni'])
  })
})

describe('textos', () => {
  it('mensaje de vencido usa el primer nombre', () => {
    expect(overduePaymentMessage('Rosa Villar')).toMatch(/^Hola Rosa, ¿Cómo estás\? tu pago se venció/)
  })
  it('etiqueta de ventana', () => {
    expect(paymentWindowLabel(1, 5)).toBe('Del 1 al 5')
    expect(paymentWindowLabel(null, null)).toBe('Sin fecha')
  })
})
