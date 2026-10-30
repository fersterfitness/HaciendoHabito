import { describe, expect, it } from 'vitest'
import {
  addBusinessDays,
  buildPaymentBoard,
  computePaymentState,
  dueReminderMessage,
  overduePaymentMessage,
  paymentWindowLabel,
} from '@/lib/finance/studentPayments'

const oct = new Date(2026, 9, 1)
const state = (o: Parameters<typeof computePaymentState>[0]) => computePaymentState(o)

describe('computePaymentState', () => {
  it('en su fecha de pago sin cobro: pendiente con el primer aviso', () => {
    expect(state({ expected: 50000, paid: 0, dueDay: 30, month: oct, today: new Date(2026, 9, 29) })).toEqual({ state: 'pendiente', reminder: null })
    expect(state({ expected: 50000, paid: 0, dueDay: 30, month: oct, today: new Date(2026, 9, 30) })).toEqual({ state: 'pendiente', reminder: 'due' })
  })

  it('a los 7 días hábiles sin pago: vencido con el segundo aviso', () => {
    // Jueves 1/10 + 7 hábiles = lunes 12/10.
    expect(state({ expected: 50000, paid: 0, dueDay: 1, month: oct, today: new Date(2026, 9, 9) }).reminder).toBe('due')
    expect(state({ expected: 50000, paid: 0, dueDay: 1, month: oct, today: new Date(2026, 9, 12) })).toEqual({ state: 'vencido', reminder: 'overdue' })
  })

  it('pagado si lo cobrado cubre lo esperado; un cobro de $0 cuenta (bonificado)', () => {
    expect(state({ expected: 50000, paid: 50000, dueDay: 5, month: oct, today: new Date(2026, 9, 20) }).state).toBe('pagado')
    expect(state({ expected: 0, paid: 0, paidCount: 1, dueDay: 5, month: oct, today: new Date(2026, 9, 20) }).state).toBe('pagado')
  })

  it('sin cuota ni pago igual figura como pendiente (falta pagar)', () => {
    expect(state({ expected: 0, paid: 0, dueDay: null, month: oct, today: new Date(2026, 9, 3) }).state).toBe('pendiente')
  })

  it('parcial si cobró algo y sigue en fecha', () => {
    expect(state({ expected: 50000, paid: 20000, dueDay: 10, month: oct, today: new Date(2026, 9, 3) }).state).toBe('parcial')
  })

  it('un mes anterior sin cubrir queda vencido, sin aviso', () => {
    expect(state({ expected: 50000, paid: 0, dueDay: null, month: new Date(2026, 8, 1), today: new Date(2026, 9, 2) })).toEqual({
      state: 'vencido',
      reminder: null,
    })
  })

  it('día 31 en un mes de 30 días: la fecha es el 30', () => {
    const sep = new Date(2026, 8, 1)
    expect(state({ expected: 1, paid: 0, dueDay: 31, month: sep, today: new Date(2026, 8, 30) }).reminder).toBe('due')
  })
})

describe('addBusinessDays', () => {
  it('saltea sábados y domingos', () => {
    expect(addBusinessDays(new Date(2026, 9, 30), 7).getDate()).toBe(10) // viernes 30/10 → martes 10/11
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
      today: new Date(2026, 9, 14),
    })
    expect(rows[0].expected).toBe(37500)
    expect(rows[0].state).toBe('vencido')
    expect(rows[0].dueDate).toBe('2026-10-01')
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

  it('muestra a todos los alumnos (también sin cuota) salvo los que no existían ese mes', () => {
    const rows = buildPaymentBoard({
      students: [
        { id: 's1', full_name: 'Sin cuota', created_at: '2026-01-01T00:00:00Z' },
        { id: 's2', full_name: 'Bonificado', created_at: '2026-01-01T00:00:00Z' },
        { id: 's3', full_name: 'Nuevo', created_at: '2026-11-05T00:00:00Z' },
      ],
      incomes: [{ id: 'i1', student_id: 's2', amount: 0, status: 'cobrado', income_date: '2026-10-03', payment_method: 'otro' }],
      month: oct,
      today: new Date(2026, 9, 8),
    })
    expect(rows.map((r) => [r.fullName, r.state, r.gifted])).toEqual([
      ['Sin cuota', 'pendiente', false],
      ['Bonificado', 'pagado', true],
    ])
  })
})

describe('textos', () => {
  it('avisos con el primer nombre', () => {
    expect(dueReminderMessage('Gustavo Cabral')).toMatch(/^Hola Gustavo, ¿cómo estás\? 👋\nTe escribo para recordarte que hoy es la fecha de pago/)
    expect(overduePaymentMessage('Rosa Villar')).toMatch(/^Hola Rosa, ¿cómo estás\? Te escribo porque noté/)
  })
  it('etiqueta del día de pago', () => {
    expect(paymentWindowLabel(30, 30)).toBe('Día 30')
    expect(paymentWindowLabel(null, null)).toBe('Sin fecha')
  })
})
