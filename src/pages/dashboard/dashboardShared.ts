import { brandRgb } from '@/theme/brandColors'
import { FINANCE_SCOPES } from '@/lib/constants'
import type { Routine, CheckInSendSchedule, TrainerResourceSendSchedule } from '@/types/database'

export interface RecentIncomeRow {
  id: string
  student_name: string | null
  amount: number
  status: string
  payment_method: string
  income_date: string
}

export type DueCheckInScheduleRow = CheckInSendSchedule & { form: { title: string } | null }
export type DueResourceScheduleRow = TrainerResourceSendSchedule & {
  resource: { title: string; url: string; description: string | null } | null
  template: { title: string; body: string } | null
}

export const LEVEL_META = [
  { key: 'inicial', label: 'Inicial' },
  { key: 'intermedio', label: 'Intermedio' },
  { key: 'avanzado', label: 'Avanzado' },
]

/** Ciclo secondary / tertiary para filas sin semántica fija de color. */
export const BRAND_ROW_ACCENT_PAIR = [
  { dot: 'bg-brand-secondary', bar: 'bg-brand-secondary', text: 'text-brand-secondary' },
  { dot: 'bg-brand-tertiary', bar: 'bg-brand-tertiary', text: 'text-brand-tertiary' },
] as const

/** Tres niveles alumno: igual patrón S / T / S que antes. */
export const LEVEL_BRAND_ACCENT = [
  BRAND_ROW_ACCENT_PAIR[0],
  BRAND_ROW_ACCENT_PAIR[1],
  BRAND_ROW_ACCENT_PAIR[0],
] satisfies typeof BRAND_ROW_ACCENT_PAIR[number][]

export const GOAL_META: Record<string, { label: string }> = {
  healthy_life: { label: 'Vida saludable' },
  sport: { label: 'Deporte' },
  cut_lean: { label: 'Bajar / Definir' },
  bulk: { label: 'Ganar músculo' },
}

export interface Stats {
  activeStudents: number
  activeRoutines: number
  /** Planes de alimentación (HH) ligados a alumnos activos. */
  activeMealPlans: number
  /** Turnos futuros del perfil entrenamiento (scheduled / confirmed). */
  pendingAppointments: number
  /** Modelos en `nutrition_plan_library` (Planes de alimentación). */
  activeNutritionPlans: number
  nutritionDocuments: number
  /** Ingresos cobrados en el mes actual */
  currentMonthIncome: number
  prevMonthIncome: number
  /** Flujos mes vs mes anterior (cards: comparativa bajo el total). */
  momStudentsThis: number
  momStudentsPrev: number
  momRoutinesThis: number
  momRoutinesPrev: number
  momMealPlansThis: number
  momMealPlansPrev: number
  momAppointmentsThis: number
  momAppointmentsPrev: number
  momNutPlansThis: number
  momNutPlansPrev: number
  momNutDocsThis: number
  momNutDocsPrev: number
}

export interface ExpiringRoutine extends Omit<Routine, 'student'> {
  student: { full_name: string } | null
}

export interface ExpiringPlan {
  id: string
  full_name: string
  plan_end_date: string
  status: string
}

export type MergedExpiringItem = {
  kind: 'routine' | 'plan'
  id: string
  sortDate: string
  title: string
  subtitle: string
  href: string
  days: number
  lastWeek?: boolean
}

export const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

/** Límites del mes calendario actual y del anterior (local) para filtros ISO en Supabase. */
export function monthBoundsISO() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  return {
    startThis: new Date(y, m, 1).toISOString(),
    startNext: new Date(y, m + 1, 1).toISOString(),
    startPrev: new Date(y, m - 1, 1).toISOString(),
  }
}

/** Mapa rápido scope (DB) → etiqueta conocida · si agregás valores en FINANCE_SCOPES, el gráfico las reconoce. */
export const KNOWN_FINANCE_SCOPE_LABEL: Record<string, string> = Object.fromEntries(
  FINANCE_SCOPES.map((s) => [s.value, s.label]),
)

export function expenseScopeDisplayLabel(scopeKey: string): string {
  const k = scopeKey.trim()
  if (!k) return KNOWN_FINANCE_SCOPE_LABEL.business ?? 'Haciéndolo hábito'
  if (KNOWN_FINANCE_SCOPE_LABEL[k]) return KNOWN_FINANCE_SCOPE_LABEL[k]
  return k.replace(/_/g, ' ')
}

/** Filas de gastos para la serie temporal del dashboard (últimos 6 meses). */
export interface DashboardExpenseRow {
  expense_date: string
  amount: number
  /** `business` = HH, `personal` = vida personal; otros valores aparecen como líneas extra si existieran en BD. */
  scope: string | null
}

/** Ingresos cobrados con ámbito (misma fecha `sinceStr` que el dashboard). */
export interface DashboardIncomeScopeRow {
  income_date: string
  amount: number
  scope: string | null
}

/** Paleta derivada de brand.secondary ↔ brand.tertiary (violetero → magenta). */
export function expenseChartStroke(index: number): string {
  const PALETTE = [
    brandRgb('secondary', 0.94),
    brandRgb('tertiary', 0.92),
    'rgba(206, 102, 255, 0.92)',
    'rgba(238, 96, 232, 0.90)',
    'rgba(144, 88, 255, 0.92)',
    'rgba(255, 138, 224, 0.90)',
    'rgba(186, 130, 255, 0.91)',
    'rgba(255, 118, 244, 0.88)',
    'rgba(152, 106, 255, 0.89)',
    'rgba(223, 110, 250, 0.91)',
    'rgba(178, 98, 255, 0.89)',
    'rgba(250, 92, 215, 0.87)',
  ]
  return PALETTE[index % PALETTE.length]
}

export interface ExpenseSeriesMeta {
  key: string
  label: string
  color: string
}

export interface ScopeMonthDetail {
  cobrados: number
  gastos: number
}

export interface ExpenseChartMonthRow {
  label: string
  /** Una serie de datos por línea: neto mensual (= cobrados − gastos por ámbito). */
  values: Record<string, number>
  /** Desglose por línea para el tooltip. */
  detail: Record<string, ScopeMonthDetail>
  /** Σ netos todos los ámbitos (único numero para Δ % inferior). */
  combinedNetSum: number
  changePctCombinedNet: number
}

export interface ExpenseChartModel {
  months: ExpenseChartMonthRow[]
  series: ExpenseSeriesMeta[]
  ambitoCount: number
}

/**
 * Una línea por ámbito; el punto del mes combina cobros + egresos en un solo número:
 * **neto = ingresos cobrados − gastos**. Si sumaran distinto modo, cambiar acá solo.
 */
export function buildFinanceScopeChartModel(
  expenseRows: DashboardExpenseRow[],
  incomeRows: DashboardIncomeScopeRow[],
): ExpenseChartModel | null {
  if (!expenseRows.length && !incomeRows.length) return null

  const now = new Date()
  const normExp = expenseRows.map((r) => ({
    datePrefix: r.expense_date.slice(0, 7),
    amount: r.amount,
    scope: (r.scope ?? 'business').trim() || 'business',
  }))
  const normInc = incomeRows.map((r) => ({
    datePrefix: r.income_date.slice(0, 7),
    amount: r.amount,
    scope: (r.scope ?? 'business').trim() || 'business',
  }))

  const totalsHint = new Map<string, number>()
  for (const r of normExp) totalsHint.set(r.scope, (totalsHint.get(r.scope) ?? 0) + r.amount)
  for (const r of normInc) totalsHint.set(r.scope, (totalsHint.get(r.scope) ?? 0) + r.amount)

  const predefinedScopeValues = FINANCE_SCOPES.map((s) => s.value)
  const predefinedSet = new Set<string>(predefinedScopeValues as string[])
  const unknownInData = [...totalsHint.keys()]
    .filter((k) => !predefinedSet.has(k))
    .sort((a, b) => (totalsHint.get(b) ?? 0) - (totalsHint.get(a) ?? 0))

  const scopeOrder = [...predefinedScopeValues, ...unknownInData]

  const series: ExpenseSeriesMeta[] = []
  let keyNum = 0
  const scopeToKey = new Map(scopeOrder.map((sv) => [sv, `s${keyNum++}`]))

  for (let si = 0; si < scopeOrder.length; si++) {
    const sv = scopeOrder[si]
    series.push({
      key: scopeToKey.get(sv)!,
      label: expenseScopeDisplayLabel(sv),
      color: expenseChartStroke(si),
    })
  }

  const months: ExpenseChartMonthRow[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = MONTH_LABELS[d.getMonth()]

    const detail: Record<string, ScopeMonthDetail> = {}
    const values: Record<string, number> = {}
    for (const s of series) {
      detail[s.key] = { cobrados: 0, gastos: 0 }
      values[s.key] = 0
    }

    for (const r of normExp) {
      if (r.datePrefix !== monthKey) continue
      const k = scopeToKey.get(r.scope)
      if (!k) continue
      detail[k].gastos += r.amount
    }

    for (const r of normInc) {
      if (r.datePrefix !== monthKey) continue
      const k = scopeToKey.get(r.scope)
      if (!k) continue
      detail[k].cobrados += r.amount
    }

    let combinedNetSum = 0
    for (const s of series) {
      const { cobrados, gastos } = detail[s.key]
      const net = cobrados - gastos
      values[s.key] = net
      combinedNetSum += net
    }

    const prevComb = months.length > 0 ? months[months.length - 1].combinedNetSum : undefined
    let changePctCombinedNet = 0
    if (prevComb === undefined) {
      changePctCombinedNet = 0
    } else if (prevComb === 0) {
      changePctCombinedNet = combinedNetSum === 0 ? 0 : combinedNetSum > 0 ? 100 : -100
    } else {
      changePctCombinedNet = Math.round(((combinedNetSum - prevComb) / Math.abs(prevComb)) * 100)
    }

    months.push({
      label,
      values,
      detail,
      combinedNetSum,
      changePctCombinedNet,
    })
  }

  return { months, series, ambitoCount: scopeOrder.length }
}
