import type { Income, PaymentMethod } from '@/types/database'

export type PaymentState = 'pagado' | 'parcial' | 'pendiente' | 'vencido' | 'sin_cargo'

/**
 * Recordatorio que toca mandar por WhatsApp:
 * - due: llegó su fecha de pago y no hay cobro registrado.
 * - overdue: pasaron 7 días hábiles desde su fecha y sigue sin pago.
 */
export type PaymentReminderKind = 'due' | 'overdue'

/** Días hábiles después de la fecha de pago para el segundo aviso. */
export const OVERDUE_BUSINESS_DAYS = 7

export type StudentPaymentRow = {
  studentId: string
  fullName: string
  phone: string | null
  /** Día de pago del mes (el que acordó el alumno). */
  dueDay: number | null
  /** Ventana guardada (compatibilidad: el día de pago es `dayFrom`). */
  dayFrom: number | null
  dayTo: number | null
  /** Fecha de pago del mes mostrado (YYYY-MM-DD), si tiene día de pago. */
  dueDate: string | null
  /** Lo que se espera cobrar en el mes: rutinas pendientes o, si no hay, la cuota mensual. */
  expected: number
  /** Cobrado en el mes. */
  paid: number
  /** Cantidad de cobros del mes (cuenta los de $0: asesoría bonificada). */
  paidCount: number
  /** Pagó el mes con un cobro de $0. */
  gifted: boolean
  methods: PaymentMethod[]
  lastPaidAt: string | null
  state: PaymentState
  /** Aviso por WhatsApp que corresponde hoy (solo el mes en curso). */
  reminder: PaymentReminderKind | null
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
  created_at?: string | null
}

type IncomeLite = Pick<Income, 'id' | 'student_id' | 'amount' | 'status' | 'income_date' | 'payment_method'> & {
  scope?: Income['scope']
}

/** `YYYY-MM` del mes. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const ymdLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Último día real del mes (si paga el 31 y el mes tiene 30, la fecha es el 30). */
function lastDayOfMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

/** Fecha de pago del mes para un día acordado (ajustada a meses cortos). */
export function dueDateOf(month: Date, dueDay: number): Date {
  const y = month.getFullYear()
  const m = month.getMonth()
  return new Date(y, m, Math.min(dueDay, lastDayOfMonth(y, m)))
}

/** Suma días hábiles (lunes a viernes). */
export function addBusinessDays(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  let left = days
  while (left > 0) {
    d.setDate(d.getDate() + 1)
    const wd = d.getDay()
    if (wd !== 0 && wd !== 6) left -= 1
  }
  return d
}

/**
 * Estado de pago de un alumno en un mes.
 * - pagado: hay cobro del mes y cubre lo esperado (un cobro de $0 = bonificado).
 * - parcial: cobró algo pero menos de lo esperado.
 * - vencido: meses anteriores sin cubrir, o pasaron 7 días hábiles desde su fecha de pago.
 * - pendiente: todavía no pagó y está en fecha (o no tiene día de pago).
 */
export function computePaymentState(opts: {
  expected: number
  paid: number
  paidCount?: number
  dueDay: number | null
  month: Date
  today: Date
}): { state: PaymentState; reminder: PaymentReminderKind | null } {
  const { expected, paid, dueDay, month, today } = opts
  const paidCount = opts.paidCount ?? (paid > 0 ? 1 : 0)
  if (paidCount > 0 && paid >= expected) return { state: 'pagado', reminder: null }
  const y = month.getFullYear()
  const m = month.getMonth()
  const isPastMonth = y < today.getFullYear() || (y === today.getFullYear() && m < today.getMonth())
  if (isPastMonth) return { state: 'vencido', reminder: null }
  const isCurrentMonth = y === today.getFullYear() && m === today.getMonth()
  const unpaidState: PaymentState = paid > 0 ? 'parcial' : 'pendiente'
  if (!isCurrentMonth || dueDay == null) return { state: unpaidState, reminder: null }
  const todayYmd = ymdLocal(today)
  const due = dueDateOf(month, dueDay)
  if (todayYmd < ymdLocal(due)) return { state: unpaidState, reminder: null }
  if (todayYmd >= ymdLocal(addBusinessDays(due, OVERDUE_BUSINESS_DAYS))) return { state: 'vencido', reminder: 'overdue' }
  return { state: unpaidState, reminder: 'due' }
}

/**
 * Tablero de cobros de un mes: todos los alumnos activos (los que ya existían ese mes),
 * paguen cuota fija, por rutina o estén bonificados.
 */
export function buildPaymentBoard(opts: {
  students: StudentLite[]
  incomes: IncomeLite[]
  month: Date
  today: Date
}): StudentPaymentRow[] {
  const { students, incomes, month, today } = opts
  const key = monthKey(month)
  const monthEnd = ymdLocal(new Date(month.getFullYear(), month.getMonth() + 1, 0))
  return students
    .filter((s) => !s.created_at || s.created_at.slice(0, 10) <= monthEnd)
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
      const dueDay = s.payment_day_from ?? s.payment_day_to ?? null
      const { state, reminder } = computePaymentState({ expected, paid, paidCount: paidRows.length, dueDay, month, today })
      return {
        studentId: s.id,
        fullName: s.full_name,
        phone: s.phone ?? null,
        dueDay,
        dayFrom: s.payment_day_from ?? null,
        dayTo: s.payment_day_to ?? null,
        dueDate: dueDay != null ? ymdLocal(dueDateOf(month, dueDay)) : null,
        expected,
        paid,
        paidCount: paidRows.length,
        gifted: paidRows.length > 0 && paid === 0,
        methods: [...new Set(paidRows.map((i) => i.payment_method))],
        lastPaidAt: lastPaid ?? null,
        state,
        reminder,
        pendingIncomeIds: pendingRows.map((i) => i.id),
      }
    })
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.fullName.localeCompare(b.fullName, 'es'))
}

const STATE_ORDER: Record<PaymentState, number> = { vencido: 0, parcial: 1, pendiente: 2, pagado: 3, sin_cargo: 4 }

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name

/** Aviso del día de pago (texto del entrenador). */
export function dueReminderMessage(studentName: string): string {
  return `Hola ${firstName(studentName)}, ¿cómo estás? 👋
Te escribo para recordarte que hoy es la fecha de pago que acordamos para tu asesoría. Cuando puedas, realiza el pago correspondiente y me avisas para dejarlo registrado.
Si por algún motivo no te viene bien en este momento, o tienes cualquier inconveniente con el pago, escríbeme sin problema y lo vemos juntos. ¡Gracias y que tengas buen día!`
}

/** Aviso a los 7 días hábiles sin pago (texto del entrenador). */
export function overduePaymentMessage(studentName: string): string {
  return `Hola ${firstName(studentName)}, ¿cómo estás? Te escribo porque noté que todavía no se ha registrado el pago de tu asesoría, y ya pasaron los 7 días hábiles desde la fecha que acordamos.
Entiendo que a veces surgen cosas, así que, si tuviste algún inconveniente o necesitas coordinar el pago de otra forma, avísame y lo resolvemos sin problema. Si ya lo realizaste, por favor envíame el comprobante para poder registrarlo.
Quedo atento. ¡Gracias!`
}

export function reminderMessage(kind: PaymentReminderKind, studentName: string): string {
  return kind === 'due' ? dueReminderMessage(studentName) : overduePaymentMessage(studentName)
}

export function paymentWindowLabel(from: number | null, to: number | null): string {
  const day = from ?? to
  return day == null ? 'Sin fecha' : `Día ${day}`
}
