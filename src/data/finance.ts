/** Finanzas: ingresos, gastos y alumnos activos (para cuotas), con caché compartida. */

import { useQuery } from '@tanstack/react-query'
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/data/queryClient'
import { useAuthStore } from '@/stores/authStore'
import type { Expense, Income, Student } from '@/types/database'

export type IncomeWithStudent = Income & { student?: { full_name: string } | null }

/**
 * Superadmin de Finanzas: de quién se ven los números. `null` = los propios (lo normal para todos),
 * `'all'` = todos los profesionales, o el id de uno. Solo lo cambia la pantalla de Finanzas y lo
 * vuelve a `null` al salir, así el Inicio y la ficha siempre muestran lo propio.
 */
export const useFinanceView = create<{ owner: string | null; setOwner: (owner: string | null) => void }>((set) => ({
  owner: null,
  setOwner: (owner) => set({ owner }),
}))

/** A quién pertenecen los datos que se piden: el dueño elegido o el usuario. */
function useFinanceScope(): string | undefined {
  const { user } = useAuthStore()
  const owner = useFinanceView((s) => s.owner)
  return user ? (owner ?? user.id) : undefined
}

export const financeKeys = {
  all: ['finance'] as const,
  incomes: (userId: string | undefined) => ['finance', 'incomes', userId ?? 'anon'] as const,
  expenses: (userId: string | undefined) => ['finance', 'expenses', userId ?? 'anon'] as const,
  /** Bajo el prefijo de alumnos: se refresca también cuando cambia un alumno. */
  activeStudents: (userId: string | undefined) => ['students', 'active', userId ?? 'anon'] as const,
}

/** `scope`: id del dueño, o `'all'` (solo superadmin; la base lo limita por permisos). */
export async function fetchIncomes(scope: string): Promise<IncomeWithStudent[]> {
  let q = supabase.from('income').select('*, student:students(full_name)')
  if (scope !== 'all') q = q.eq('owner_id', scope)
  const { data, error } = await q.order('income_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as unknown as IncomeWithStudent[]) ?? []
}

export async function fetchExpenses(scope: string): Promise<Expense[]> {
  let q = supabase.from('expenses').select('*')
  if (scope !== 'all') q = q.eq('owner_id', scope)
  const { data, error } = await q.order('expense_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as Expense[]) ?? []
}

export async function fetchActiveStudents(scope: string): Promise<Student[]> {
  let q = supabase.from('students').select('*').eq('status', 'activo')
  if (scope !== 'all') q = q.eq('owner_id', scope)
  const { data, error } = await q.order('full_name')
  if (error) throw new Error(error.message)
  return (data as Student[]) ?? []
}

export async function deleteIncome(id: string, ownerId: string): Promise<void> {
  const { error } = await supabase.from('income').delete().eq('id', id).eq('owner_id', ownerId)
  if (error) throw new Error(error.message)
  void invalidateFinance()
}

export async function deleteExpense(id: string, ownerId: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id).eq('owner_id', ownerId)
  if (error) throw new Error(error.message)
  void invalidateFinance()
}

/** Recarga ingresos y gastos en todas las pantallas (tablero de cobros, listados, ficha). */
export function invalidateFinance(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: financeKeys.all })
}

export function useIncomes() {
  const scope = useFinanceScope()
  return useQuery({ queryKey: financeKeys.incomes(scope), queryFn: () => fetchIncomes(scope!), enabled: Boolean(scope) })
}

export function useExpenses() {
  const scope = useFinanceScope()
  return useQuery({ queryKey: financeKeys.expenses(scope), queryFn: () => fetchExpenses(scope!), enabled: Boolean(scope) })
}

export function useActiveStudents() {
  const scope = useFinanceScope()
  return useQuery({ queryKey: financeKeys.activeStudents(scope), queryFn: () => fetchActiveStudents(scope!), enabled: Boolean(scope) })
}

export type FinanceProfessional = { id: string; full_name: string; role: string }

/**
 * Profesionales cuyas finanzas puede ver el usuario. Vacío para todos salvo el superadmin de Finanzas
 * (o si todavía no se corrió 20261111120000_finance_superadmin.sql).
 */
export function useFinanceProfessionals() {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['finance', 'professionals', user?.id ?? 'anon'],
    queryFn: async (): Promise<FinanceProfessional[]> => {
      const { data, error } = await supabase.rpc('finance_professionals')
      if (error) return []
      return (data as FinanceProfessional[] | null) ?? []
    },
    enabled: Boolean(user),
    staleTime: 10 * 60_000,
  })
}

// ─── Recordatorios de pago enviados (día de pago y a los 7 días hábiles) ───────

export type SentReminder = { student_id: string; period: string; kind: 'due' | 'overdue' }

export const REMINDERS_SQL_HINT =
  'Falta ejecutar la migración 20261030160000_oct5_calendario_volumen_finanzas.sql para recordar qué avisos ya mandaste.'

/** Avisos ya mandados en un mes (`YYYY-MM`). Sin la migración devuelve null (se muestran todos). */
export async function fetchSentReminders(period: string): Promise<SentReminder[] | null> {
  const { data, error } = await supabase.from('student_payment_reminders').select('student_id, period, kind').eq('period', period)
  if (error) return null
  return (data ?? []) as SentReminder[]
}

export function useSentReminders(period: string) {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['finance', 'reminders', user?.id ?? 'anon', period],
    queryFn: () => fetchSentReminders(period),
    enabled: Boolean(user),
  })
}

/** Deshace «ya le avisé»: el alumno vuelve a la lista de avisos. */
export async function unmarkReminderSent(r: SentReminder): Promise<string | null> {
  const { error } = await supabase
    .from('student_payment_reminders')
    .delete()
    .eq('student_id', r.student_id)
    .eq('period', r.period)
    .eq('kind', r.kind)
  if (error) return error.message
  void invalidateFinance()
  return null
}

export async function markReminderSent(r: SentReminder): Promise<string | null> {
  const { error } = await supabase
    .from('student_payment_reminders')
    .upsert({ ...r, sent_at: new Date().toISOString() }, { onConflict: 'owner_id,student_id,period,kind' })
  if (error) return /does not exist|schema cache/i.test(error.message) ? REMINDERS_SQL_HINT : error.message
  void invalidateFinance()
  return null
}

/** Superadmin: nombres de los alumnos de otros profesionales (los cobros ajenos no traen el nombre por RLS). */
export function useFinanceStudentNames(enabled: boolean) {
  return useQuery({
    queryKey: ['finance', 'student-names'],
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase.rpc('finance_student_names')
      if (error) return new Map()
      return new Map(((data ?? []) as { id: string; full_name: string }[]).map((r) => [r.id, r.full_name]))
    },
    enabled,
    staleTime: 5 * 60_000,
  })
}
