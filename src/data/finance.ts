/** Finanzas: ingresos, gastos y alumnos activos (para cuotas), con caché compartida. */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/data/queryClient'
import { useAuthStore } from '@/stores/authStore'
import type { Expense, Income, Student } from '@/types/database'

export type IncomeWithStudent = Income & { student?: { full_name: string } | null }

export const financeKeys = {
  all: ['finance'] as const,
  incomes: (userId: string | undefined) => ['finance', 'incomes', userId ?? 'anon'] as const,
  expenses: (userId: string | undefined) => ['finance', 'expenses', userId ?? 'anon'] as const,
  /** Bajo el prefijo de alumnos: se refresca también cuando cambia un alumno. */
  activeStudents: (userId: string | undefined) => ['students', 'active', userId ?? 'anon'] as const,
}

export async function fetchIncomes(ownerId: string): Promise<IncomeWithStudent[]> {
  const { data, error } = await supabase
    .from('income')
    .select('*, student:students(full_name)')
    .eq('owner_id', ownerId)
    .order('income_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as unknown as IncomeWithStudent[]) ?? []
}

export async function fetchExpenses(ownerId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('owner_id', ownerId)
    .order('expense_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as Expense[]) ?? []
}

export async function fetchActiveStudents(ownerId: string): Promise<Student[]> {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('status', 'activo')
    .order('full_name')
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
  const { user } = useAuthStore()
  return useQuery({ queryKey: financeKeys.incomes(user?.id), queryFn: () => fetchIncomes(user!.id), enabled: Boolean(user) })
}

export function useExpenses() {
  const { user } = useAuthStore()
  return useQuery({ queryKey: financeKeys.expenses(user?.id), queryFn: () => fetchExpenses(user!.id), enabled: Boolean(user) })
}

export function useActiveStudents() {
  const { user } = useAuthStore()
  return useQuery({ queryKey: financeKeys.activeStudents(user?.id), queryFn: () => fetchActiveStudents(user!.id), enabled: Boolean(user) })
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

export async function markReminderSent(r: SentReminder): Promise<string | null> {
  const { error } = await supabase
    .from('student_payment_reminders')
    .upsert({ ...r, sent_at: new Date().toISOString() }, { onConflict: 'owner_id,student_id,period,kind' })
  if (error) return /does not exist|schema cache/i.test(error.message) ? REMINDERS_SQL_HINT : error.message
  void invalidateFinance()
  return null
}
