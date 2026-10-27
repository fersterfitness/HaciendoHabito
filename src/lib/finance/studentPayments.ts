import type { Income, PaymentMethod } from '@/types/database'

export type PaymentState = 'pagado' | 'parcial' | 'pendiente' | 'vencido' | 'sin_cargo'

export type StudentPaymentRow = {
  studentId: string
  fullName: string
  phone: string | null
  /** Ventana de pago del mes (días). */
  dayFrom: number | null
  dayTo: number | null
  /** Lo que se espera cobrar en el mes: rutinas pendientes o, si no hay, la cuota mensual. */
  expected: number
  /** Cobrado en el mes. */
  paid: number
  methods: PaymentMethod[]
  lastPaidAt: string | null
  state: PaymentState
  /** Ingresos pendientes del alumno (rutinas asignadas sin abonar). */
  pendingIncomeIds: string[]
}

type StudentLite = {
  id: string
  full_name: string
  phone?: string | null
  monthly_fee_amount?: number | null
  payment_day_from?: number | null
  payment_day_to?: number | null
}

type IncomeLite = Pick<Income, 'id' | 'student_id' | 'amount' | 'status' | 'income_date' | 'payment_method'> & {
  scope?: Income['scope']
}

/** `YYYY-MM` del mes. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Último día real del mes (si la ventana dice 31 y el mes tiene 30, vence el 30). */
function lastDayOfMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

/**
 * Estado de pago de un alumno en un mes.
 * - pagado: lo cobrado cubre lo esperado.
 * - parcial: cobró algo pero menos de lo esperado.
 * - vencido: no cubrió y ya pasó el último día de su ventana (en el mes en curso o anteriores).
 * - pendiente: no cubrió y todavía está en fecha (o no tiene ventana).
 * - sin_cargo: no hay nada esperado ni cobrado ese mes.
 */
export function computePaymentState(opts: {
  expected: number
  paid: number
  dayTo: number | null
  month: Date
  today: Date
}): PaymentState {
  const { expected, paid, dayTo, month, today } = opts
  if (expected <= 0 && paid <= 0) return 'sin_cargo'
  if (paid >= expected && paid > 0) return 'pagado'
  const y = month.getFullYear()
  const m = month.getMonth()
  const isPastMonth = y < today.getFullYear() || (y === today.getFullYear() && m < today.getMonth())
  const isCurrentMonth = y === today.getFullYear() && m === today.getMonth()
  const deadline = dayTo != null ? Math.min(dayTo, lastDayOfMonth(y, m)) : null
  const overdue = isPastMonth || (isCurrentMonth && deadline != null && today.getDate() > deadline)
  if (overdue && expected > paid) return 'vencido'
  return paid > 0 ? 'parcial' : 'pendiente'
}

/** Arma el tablero de cobros de un mes a partir de alumnos activos e ingresos de negocio. */
export function buildPaymentBoard(opts: {
  students: StudentLite[]
  incomes: IncomeLite[]
  month: Date
  today: Date
}): StudentPaymentRow[] {
  const { students, incomes, month, today } = opts
  const key = monthKey(month)
  return students
    .map((s) => {
      const own = incomes.filter((i) => i.student_id === s.id && (i.scope ?? 'business') === 'business')
      const ofMonth = own.filter((i) => i.income_date.startsWith(key))
      const paidRows = ofMonth.filter((i) => i.status === 'cobrado')
      const paid = paidRows.reduce((acc, i) => acc + Number(i.amount || 0), 0)
      // Pendientes: los del mes + los de meses anteriores que siguen sin cobrar (deuda arrastrada).
      const pendingRows = own.filter((i) => i.status === 'pendiente' && i.income_date.slice(0, 7) <= key)
      const pendingAmount = pendingRows.reduce((acc, i) => acc + Number(i.amount || 0), 0)
      const fee = Number(s.monthly_fee_amount || 0)
      const expected = pendingAmount > 0 ? paid + pendingAmount : Math.max(fee, 0)
      const lastPaid = own
        .filter((i) => i.status === 'cobrado')
        .map((i) => i.income_date)
        .sort()
        .slice(-1)[0]
      return {
        studentId: s.id,
        fullName: s.full_name,
        phone: s.phone ?? null,
        dayFrom: s.payment_day_from ?? null,
        dayTo: s.payment_day_to ?? null,
        expected,
        paid,
        methods: [...new Set(paidRows.map((i) => i.payment_method))],
        lastPaidAt: lastPaid ?? null,
        state: computePaymentState({ expected, paid, dayTo: s.payment_day_to ?? null, month, today }),
        pendingIncomeIds: pendingRows.map((i) => i.id),
      }
    })
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.fullName.localeCompare(b.fullName, 'es'))
}

const STATE_ORDER: Record<PaymentState, number> = { vencido: 0, parcial: 1, pendiente: 2, pagado: 3, sin_cargo: 4 }

/** Mensaje de WhatsApp para pago vencido (texto pedido por el entrenador). */
export function overduePaymentMessage(studentName: string): string {
  const first = studentName.trim().split(/\s+/)[0] || studentName
  return `Hola ${first}, ¿Cómo estás? tu pago se venció hace muy poco! Si por cuestiones personales no podés abonar o surgió algún problema no dudes en comunicármelo.`
}

export function paymentWindowLabel(from: number | null, to: number | null): string {
  if (from == null && to == null) return 'Sin fecha'
  if (from != null && to != null) return from === to ? `Día ${from}` : `Del ${from} al ${to}`
  return `Hasta el ${to ?? from}`
}
