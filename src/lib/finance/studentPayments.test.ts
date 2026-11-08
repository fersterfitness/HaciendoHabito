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
  it('antes de su fecha está al día; el mismo día, «abonan hoy» con el primer aviso', () => {
    expect(state({ expected: 50000, paid: 0, dueDay: 30, month: oct, today: new Date(2026, 9, 29) })).toEqual({ state: 'pendiente', reminder: null, timing: 'antes' })
    expect(state({ expected: 50000, paid: 0, dueDay: 30, month: oct, today: new Date(2026, 9, 30) })).toEqual({ state: 'pendiente', reminder: 'due', timing: 'hoy' })
  })

  it('pasada la fecha queda vencido; a los 7 días hábiles, el segundo aviso', () => {
    // Jueves 1/10 + 7 hábiles = lunes 12/10.
    expect(state({ expected: 50000, paid: 0, dueDay: 1, month: oct, today: new Date(2026, 9, 9) })).toEqual({ state: 'vencido', reminder: 'due', timing: 'despues' })
    expect(state({ expected: 50000, paid: 0, dueDay: 1, month: oct, today: new Date(2026, 9, 12) })).toEqual({ state: 'vencido', reminder: 'overdue', timing: 'despues' })
  })

  it('si arrancó después de su día de pago, ese mes no debe todavía', () => {
    expect(state({ expected: 50000, paid: 0, dueDay: 10, month: oct, today: new Date(2026, 9, 31), startedAt: '2026-10-20' })).toEqual({
      state: 'pendiente',
      reminder: null,
      timing: 'antes',
    })
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
      timing: 'despues',
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
    expect(rows[0].dueDate).toBe('2026-10-05')
    expect(rows[0].pendingIncomeIds).toEqual(['i1'])
  })

  it('con la ventana vieja (del 1 al 10) vence el 10, no el 1', () => {
    const board = (day: number) =>
      buildPaymentBoard({
        students: [{ id: 's1', full_name: 'Ailin', monthly_fee_amount: 45000, payment_day_from: 1, payment_day_to: 10, created_at: '2026-01-01T00:00:00Z' }],
        incomes: [],
        month: new Date(2026, 10, 1),
        today: new Date(2026, 10, day),
      })[0]
    expect(board(2)).toMatchObject({ state: 'pendiente', timing: 'antes', reminder: null, dueDate: '2026-11-10' })
    expect(board(10)).toMatchObject({ timing: 'hoy', reminder: 'due' })
    expect(board(11)).toMatchObject({ state: 'vencido', timing: 'despues' })
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
    expect(dueReminderMessage('Gustavo Cabral', new Date(2026, 10, 10))).toBe(
      'Hola Gustavo! Este es un mensaje AUTOMÁTICO para recordarte nuestra fecha de pago (10 de noviembre). Si contás con algún inconveniente o algo, no dudes en escribirme y lo resolvemos juntos!',
    )
    expect(overduePaymentMessage('Rosa Villar')).toMatch(/^Hola Rosa! Este es un mensaje AUTOMÁTICO para recordarte que nuestra fecha de pago ya se encuentra vencida\./)
  })
  it('etiqueta del día de pago', () => {
    expect(paymentWindowLabel(30, 30)).toBe('Día 30')
    expect(paymentWindowLabel(null, null)).toBe('Sin fecha')
  })
})
