import { supabase } from '@/lib/supabase'
import type { Income, PaymentMethod } from '@/types/database'
import { invalidateFinance } from '@/data/finance'
import { invalidateRoutines } from '@/data/routines'
import { invalidateStudents } from '@/data/students'

export const FINANCE_SQL_HINT =
  'Falta un cambio en la base: corré el SQL 20261027120000_finance_payment_window (Finanzas v2).'

function isMissingColumn(err: { code?: string; message?: string } | null): boolean {
  return !!err && (err.code === '42703' || /routine_id|payment_day/.test(err.message ?? ''))
}

export const GIFT_SQL_HINT =
  'Para registrar asesorías bonificadas ($0) falta ejecutar la migración 20261030160000_oct5_calendario_volumen_finanzas.sql.'

/** Cobros de $0 rechazados por la regla vieja de la base (monto > 0). */
function zeroAmountError(err: { code?: string; message?: string } | null, amount: number): string | null {
  if (!err) return null
  if (amount === 0 && (err.code === '23514' || /check constraint/i.test(err.message ?? ''))) return GIFT_SQL_HINT
  return err.message ?? 'Error'
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Al asignar una rutina con precio: queda un cobro «pendiente» en Haciéndolo hábito. */
async function createRoutinePendingIncomeImpl(opts: {
  ownerId: string
  routineId: string
  routineName: string
  studentId: string
  amount: number
  date?: string
}): Promise<string | null> {
  if (!(opts.amount > 0)) return null
  const { error } = await supabase.from('income').insert({
    owner_id: opts.ownerId,
    student_id: opts.studentId,
    routine_id: opts.routineId,
    amount: opts.amount,
    payment_method: 'transferencia',
    income_type: 'Rutina',
    category: 'Entrenamiento',
    description: opts.routineName,
    income_date: opts.date ?? today(),
    status: 'pendiente',
    scope: 'business',
    notes: null,
  })
  if (!error) return null
  return isMissingColumn(error) ? FINANCE_SQL_HINT : error.message
}

/**
 * «Abonó»: la rutina queda paga y su cobro pasa a «cobrado» con el medio elegido.
 * Si la rutina no tenía cobro (rutinas viejas), se crea uno ya cobrado.
 */
async function markRoutinePaidImpl(opts: {
  ownerId: string
  routineId: string
  routineName: string
  studentId: string
  amount: number
  method: PaymentMethod
  date?: string
}): Promise<string | null> {
  const date = opts.date ?? today()
  const { error: rErr } = await supabase
    .from('routines')
    .update({ is_paid: true, price: opts.amount > 0 ? opts.amount : null })
    .eq('id', opts.routineId)
  if (rErr) return rErr.message

  const { data: existing, error: findErr } = await supabase
    .from('income')
    .select('id')
    .eq('routine_id', opts.routineId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (findErr && !isMissingColumn(findErr)) return findErr.message

  if (existing?.id) {
    const { error } = await supabase
      .from('income')
      .update({ status: 'cobrado', payment_method: opts.method, amount: opts.amount, income_date: date })
      .eq('id', existing.id)
    return zeroAmountError(error, opts.amount)
  }
  // También con $0 (asesoría bonificada): así el mes figura como pagado en Finanzas.
  if (!(opts.amount >= 0)) return null
  const row: Record<string, unknown> = {
    owner_id: opts.ownerId,
    student_id: opts.studentId,
    amount: opts.amount,
    payment_method: opts.method,
    income_type: 'Rutina',
    category: 'Entrenamiento',
    description: opts.routineName,
    income_date: date,
    status: 'cobrado',
    scope: 'business',
    notes: null,
  }
  if (!isMissingColumn(findErr)) row.routine_id = opts.routineId
  const { error } = await supabase.from('income').insert(row)
  return zeroAmountError(error, opts.amount)
}

/** Desmarcar «Abonó»: la rutina vuelve a impaga y su cobro a «pendiente». */
async function unmarkRoutinePaidImpl(routineId: string): Promise<string | null> {
  const { error: rErr } = await supabase.from('routines').update({ is_paid: false }).eq('id', routineId)
  if (rErr) return rErr.message
  const { error } = await supabase.from('income').update({ status: 'pendiente' }).eq('routine_id', routineId)
  if (error && !isMissingColumn(error)) return error.message
  return null
}

/**
 * Cobro desde el tablero mensual: si el alumno tiene cobros pendientes (rutinas), pasan a cobrados
 * con el medio elegido; si no, se registra un cobro nuevo por el monto indicado (cuota del mes).
 */
async function registerStudentPaymentImpl(opts: {
  ownerId: string
  studentId: string
  studentName: string
  amount: number
  method: PaymentMethod
  date: string
  pendingIncomeIds: string[]
}): Promise<string | null> {
  if (opts.pendingIncomeIds.length) {
    const { data, error } = await supabase
      .from('income')
      .update({ status: 'cobrado', payment_method: opts.method, income_date: opts.date })
      .in('id', opts.pendingIncomeIds)
      .select('routine_id')
    if (error) return error.message
    const routineIds = ((data ?? []) as Pick<Income, 'routine_id'>[]).map((r) => r.routine_id).filter(Boolean) as string[]
    if (routineIds.length) {
      const { error: rErr } = await supabase.from('routines').update({ is_paid: true }).in('id', routineIds)
      if (rErr) return rErr.message
    }
    return null
  }
  if (!(opts.amount >= 0)) return 'Ingresá un monto válido (0 si es bonificada)'
  const { error } = await supabase.from('income').insert({
    owner_id: opts.ownerId,
    student_id: opts.studentId,
    amount: opts.amount,
    payment_method: opts.method,
    income_type: 'Cuota mensual',
    category: 'Entrenamiento',
    description: opts.amount === 0 ? `Asesoría bonificada de ${opts.studentName}` : `Pago de ${opts.studentName}`,
    income_date: opts.date,
    status: 'cobrado',
    scope: 'business',
    notes: null,
  })
  return zeroAmountError(error, opts.amount)
}

/** Ventana de pago del alumno (días del mes). */
async function saveStudentPaymentWindowImpl(studentId: string, from: number | null, to: number | null): Promise<string | null> {
  const { error } = await supabase
    .from('students')
    .update({ payment_day_from: from, payment_day_to: to })
    .eq('id', studentId)
  if (!error) return null
  return isMissingColumn(error) ? FINANCE_SQL_HINT : error.message
}

/** Después de cualquier cobro, las pantallas que muestran plata, rutinas o alumnos se refrescan. */
function refreshing<A extends unknown[]>(fn: (...args: A) => Promise<string | null>) {
  return async (...args: A): Promise<string | null> => {
    const err = await fn(...args)
    if (!err) void Promise.all([invalidateFinance(), invalidateRoutines(), invalidateStudents()])
    return err
  }
}

export const createRoutinePendingIncome = refreshing(createRoutinePendingIncomeImpl)
export const markRoutinePaid = refreshing(markRoutinePaidImpl)
export const unmarkRoutinePaid = refreshing(unmarkRoutinePaidImpl)
export const registerStudentPayment = refreshing(registerStudentPaymentImpl)
export const saveStudentPaymentWindow = refreshing(saveStudentPaymentWindowImpl)
