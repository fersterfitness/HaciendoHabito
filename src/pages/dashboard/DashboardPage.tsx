import { useEffect, useMemo, useState } from 'react'
import {} from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { useCountUp } from '@/hooks/useCountUp'
import {
  Calendar,
  BarChart3,
  Cake,
  ChevronRight,
  AlertTriangle,
  ClipboardCheck,
} from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip as RechartsTooltip, CartesianGrid,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { accessibleStudentsSelect } from '@/lib/students/studentAccess'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { PageSectionTitle } from '@/components/ui/PageSectionTitle'
import { Button } from '@/components/ui/Button'
import { StatCardSkeleton, ChartSkeleton, Skeleton } from '@/components/ui/Skeleton'
import { cn, daysUntil, formatCurrency, formatDate } from '@/lib/utils'
import { financeUi } from '@/lib/uiGlossary'
import { tableRowEnterStyle } from '@/lib/tableRowEnterAnimation'
import { FINANCE_SCOPES } from '@/lib/constants'
import { StudentAvatarThumb } from '@/lib/studentAvatar'
import { PaymentMethodBadge } from '@/components/ui/PaymentMethodIcon'
import { scheduleMatchesToday } from '@/lib/checkInSchedule'
import { DashboardTrainerOpsPanel } from '@/components/dashboard/DashboardTrainerOpsPanel'
import {
  loadDashboardQuickSends,
  loadStudentsMissingCheckIn,
  type DashboardCheckInQuickSend,
  type DashboardMissingCheckInStudent,
  type DashboardResourceQuickSend,
} from '@/lib/dashboard/dashboardTrainerOps'
import type { Routine, Notification, CheckInSendSchedule, TrainerResourceSendSchedule } from '@/types/database'

interface RecentIncomeRow {
  id: string
  student_name: string | null
  amount: number
  status: string
  payment_method: string
  income_date: string
}

type DueCheckInScheduleRow = CheckInSendSchedule & { form: { title: string } | null }
type DueResourceScheduleRow = TrainerResourceSendSchedule & {
  resource: { title: string; url: string; description: string | null } | null
  template: { title: string; body: string } | null
}

const LEVEL_META = [
  { key: 'inicial', label: 'Inicial' },
  { key: 'intermedio', label: 'Intermedio' },
  { key: 'avanzado', label: 'Avanzado' },
]

/** Ciclo secondary / tertiary para filas sin semántica fija de color. */
const BRAND_ROW_ACCENT_PAIR = [
  { dot: 'bg-brand-secondary', bar: 'bg-brand-secondary', text: 'text-brand-secondary' },
  { dot: 'bg-brand-tertiary', bar: 'bg-brand-tertiary', text: 'text-brand-tertiary' },
] as const

/** Tres niveles alumno: igual patrón S / T / S que antes. */
const LEVEL_BRAND_ACCENT = [
  BRAND_ROW_ACCENT_PAIR[0],
  BRAND_ROW_ACCENT_PAIR[1],
  BRAND_ROW_ACCENT_PAIR[0],
] satisfies typeof BRAND_ROW_ACCENT_PAIR[number][]

const GOAL_META: Record<string, { label: string }> = {
  healthy_life: { label: 'Vida saludable' },
  sport: { label: 'Deporte' },
  cut_lean: { label: 'Bajar / Definir' },
  bulk: { label: 'Ganar músculo' },
}

interface Stats {
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

interface ExpiringRoutine extends Omit<Routine, 'student'> {
  student: { full_name: string } | null
}

interface ExpiringPlan {
  id: string
  full_name: string
  plan_end_date: string
  status: string
}

type MergedExpiringItem = {
  kind: 'routine' | 'plan'
  id: string
  sortDate: string
  title: string
  subtitle: string
  href: string
  days: number
}

const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

/** Límites del mes calendario actual y del anterior (local) para filtros ISO en Supabase. */
function monthBoundsISO() {
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
const KNOWN_FINANCE_SCOPE_LABEL: Record<string, string> = Object.fromEntries(
  FINANCE_SCOPES.map((s) => [s.value, s.label]),
)

function expenseScopeDisplayLabel(scopeKey: string): string {
  const k = scopeKey.trim()
  if (!k) return KNOWN_FINANCE_SCOPE_LABEL.business ?? 'Haciéndolo hábito'
  if (KNOWN_FINANCE_SCOPE_LABEL[k]) return KNOWN_FINANCE_SCOPE_LABEL[k]
  return k.replace(/_/g, ' ')
}

/** Filas de gastos para la serie temporal del dashboard (últimos 6 meses). */
interface DashboardExpenseRow {
  expense_date: string
  amount: number
  /** `business` = HH, `personal` = vida personal; otros valores aparecen como líneas extra si existieran en BD. */
  scope: string | null
}

/** Ingresos cobrados con ámbito (misma fecha `sinceStr` que el dashboard). */
interface DashboardIncomeScopeRow {
  income_date: string
  amount: number
  scope: string | null
}

/** Paleta derivada de brand.secondary ↔ brand.tertiary (violetero → magenta). */
function expenseChartStroke(index: number): string {
  const PALETTE = [
    'rgba(169, 121, 255, 0.94)',
    'rgba(255, 79, 234, 0.92)',
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

interface ExpenseSeriesMeta {
  key: string
  label: string
  color: string
}

interface ScopeMonthDetail {
  cobrados: number
  gastos: number
}

interface ExpenseChartMonthRow {
  label: string
  /** Una serie de datos por línea: neto mensual (= cobrados − gastos por ámbito). */
  values: Record<string, number>
  /** Desglose por línea para el tooltip. */
  detail: Record<string, ScopeMonthDetail>
  /** Σ netos todos los ámbitos (único numero para Δ % inferior). */
  combinedNetSum: number
  changePctCombinedNet: number
}

interface ExpenseChartModel {
  months: ExpenseChartMonthRow[]
  series: ExpenseSeriesMeta[]
  ambitoCount: number
}

/**
 * Una línea por ámbito; el punto del mes combina cobros + egresos en un solo número:
 * **neto = ingresos cobrados − gastos**. Si sumaran distinto modo, cambiar acá solo.
 */
function buildFinanceScopeChartModel(
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ExpenseScopesTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const raw = payload[0].payload as Record<string, unknown>
  const series = (raw.__series as ExpenseSeriesMeta[]) ?? []
  const detail = (raw.__detail as Record<string, ScopeMonthDetail>) ?? {}

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-xs shadow-lg max-w-[260px]">
      <p className="font-semibold text-ink-primary">{label}</p>
      <div className="mt-1.5 space-y-2">
        {series.map((s) => {
          const d = detail[s.key] ?? { cobrados: 0, gastos: 0 }
          const net = Number(raw[s.key] ?? 0)
          return (
            <div key={s.key} className="border-b border-surface-border/50 pb-2 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="truncate font-medium text-ink-secondary">{s.label}</span>
                </span>
                <span className={cn(
                  'shrink-0 text-[12px] font-bold tabular-nums',
                  net >= 0 ? 'text-status-generated' : 'text-status-expired',
                )}
                >
                  {formatCurrency(net)}
                </span>
              </div>
              <p className="mt-1 pl-3 text-[10px] leading-snug text-ink-muted tabular-nums">
                {financeUi.cobrado} ${d.cobrados.toLocaleString('es-AR')} · {financeUi.gastos} ${d.gastos.toLocaleString('es-AR')}
              </p>
            </div>
          )
        })}
      </div>
      <p className="mt-2 border-t border-surface-border pt-2 text-[11px] font-semibold tabular-nums text-ink-primary">
        {financeUi.netosSum}: {formatCurrency(Number(raw.combinedNetSum ?? 0))}
      </p>
      {(() => {
        const idx = Number(raw.__monthIndex ?? 0)
        const pct = Number(raw.changePctCombinedNet ?? 0)
        if (idx === 0) {
          return (
            <p className="mt-1.5 text-[10px] leading-snug text-ink-muted">
              Primer mes del rango: sin comparación vs mes anterior.
            </p>
          )
        }
        return (
          <p
            className={cn(
              'mt-1.5 border-t border-surface-border pt-1.5 text-[10px] font-medium tabular-nums',
              pct > 0 && 'text-status-generated',
              pct < 0 && 'text-status-expired',
              pct === 0 && 'text-ink-muted',
            )}
          >
            Σ netos vs mes anterior: {pct > 0 ? '+' : ''}
            {pct === 0 ? '0%' : `${pct}%`}
          </p>
        )
      })()}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomXTick({ x, y, payload }: any) {
  const d = payload.value as string
  return (
    <text x={x} y={y + 12} textAnchor="middle" fontSize={10} fill="rgba(148,163,184,0.9)" fontWeight={600}>
      {d}
    </text>
  )
}

function expenseChartRechartsData(model: ExpenseChartModel) {
  return model.months.map((m, i) => {
    const row: Record<string, unknown> = {
      label: m.label,
      combinedNetSum: m.combinedNetSum,
      changePctCombinedNet: m.changePctCombinedNet,
      __monthIndex: i,
      __series: model.series,
      __detail: m.detail,
    }
    for (const { key } of model.series) row[key] = m.values[key] ?? 0
    return row
  })
}

function ExpenseScopesLineChart({ model }: { model: ExpenseChartModel }) {
  const data = expenseChartRechartsData(model)
  return (
    <div className="w-full px-1 pb-2">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid
            vertical={false}
            stroke="rgba(113,113,122,0.14)"
            strokeDasharray="4 4"
          />

          <XAxis
            dataKey="label"
            tick={<CustomXTick />}
            axisLine={false}
            tickLine={false}
            height={24}
          />

          <YAxis
            tickFormatter={(v) => {
              if (v === 0) return ''
              const sign = v < 0 ? '−' : ''
              const abs = Math.abs(v)
              if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(0)}k`
              return `${sign}$${Math.round(abs)}`
            }}
            tick={{ fontSize: 9, fill: 'rgba(148,163,184,0.75)' }}
            axisLine={false}
            tickLine={false}
            width={36}
          />

          <RechartsTooltip
            content={<ExpenseScopesTooltip />}
            cursor={{ stroke: 'rgba(148,163,184,0.28)', strokeWidth: 1, strokeDasharray: '4 3', strokeOpacity: 0.55 }}
          />

          {model.series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={1.35}
              dot={false}
              activeDot={{ r: 4, fill: s.color, stroke: 'rgba(255,255,255,0.55)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DashboardPage() {
  const { user, profile } = useAuthStore()
  const navigate = useAppNavigate()
  const role = profile?.role
  const activePeopleLabel = role === 'nutritionist' ? 'Pacientes activos' : 'Alumnos activos'
  const canSeeTraining = role === 'admin' || role === 'trainer' || !role
  const canSeeNutrition = role === 'admin' || role === 'nutritionist'
  const canSeeFinances = role === 'admin' || role === 'trainer' || role === 'nutritionist' || !role
  const peopleHubPath = role === 'nutritionist' ? '/nutrition' : '/students'
  const peopleDetailPath = (studentId: string) =>
    role === 'nutritionist' ? `/nutrition/${studentId}` : `/students/${studentId}`
  const [stats, setStats] = useState<Stats>({
    activeStudents: 0,
    activeRoutines: 0,
    activeMealPlans: 0,
    pendingAppointments: 0,
    activeNutritionPlans: 0,
    nutritionDocuments: 0,
    currentMonthIncome: 0,
    prevMonthIncome: 0,
    momStudentsThis: 0,
    momStudentsPrev: 0,
    momRoutinesThis: 0,
    momRoutinesPrev: 0,
    momMealPlansThis: 0,
    momMealPlansPrev: 0,
    momAppointmentsThis: 0,
    momAppointmentsPrev: 0,
    momNutPlansThis: 0,
    momNutPlansPrev: 0,
    momNutDocsThis: 0,
    momNutDocsPrev: 0,
  })
  const [expiring, setExpiring] = useState<ExpiringRoutine[]>([])
  const [expiringPlans, setExpiringPlans] = useState<ExpiringPlan[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [expenseChartModel, setExpenseChartModel] = useState<ExpenseChartModel | null>(null)
  const [retention, setRetention] = useState({ m3: 0, m6: 0, m12: 0 })
  const [birthdays, setBirthdays] = useState<{ id: string; full_name: string; daysUntil: number }[]>([])
  const [todayApps, setTodayApps] = useState<{ id: string; title: string; starts_at: string; student_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [dataUpdatedAt, setDataUpdatedAt] = useState<Date | null>(null)
  const [recentIncome, setRecentIncome] = useState<RecentIncomeRow[]>([])
  const [levelDist, setLevelDist] = useState<{ key: string; label: string; count: number; pct: number }[]>([])
  const [pendingIncomeTotal, setPendingIncomeTotal] = useState(0)
  const [studentsWithoutRoutine, setStudentsWithoutRoutine] = useState<{ id: string; full_name: string; avatar_path: string | null }[]>([])
  const [goalDist, setGoalDist] = useState<{ key: string; label: string; count: number; pct: number }[]>([])
  const [habitAvg, setHabitAvg] = useState(0)
  const [habitTop5, setHabitTop5] = useState<{ id: string; name: string; pct: number }[]>([])
  /**
   * Check-ins recibidos en los últimos 30 días que el trainer todavía no marcó
   * como respondidos (vía WhatsApp/manual). Se prioriza en Inicio para no
   * olvidarse de contestar.
   */
  const [checkInRecentCount, setCheckInRecentCount] = useState(0)
  const [dueCheckInSchedules, setDueCheckInSchedules] = useState<DueCheckInScheduleRow[]>([])
  const [dueResourceSchedules, setDueResourceSchedules] = useState<DueResourceScheduleRow[]>([])
  const [checkInQuickSends, setCheckInQuickSends] = useState<DashboardCheckInQuickSend[]>([])
  const [resourceQuickSends, setResourceQuickSends] = useState<DashboardResourceQuickSend[]>([])
  const [missingCheckInStudents, setMissingCheckInStudents] = useState<DashboardMissingCheckInStudent[]>([])

  const animatedIncome = useCountUp(stats.currentMonthIncome, {
    duration: 2600,
    enabled: !loading,
  })

  const mergedExpiring = useMemo((): MergedExpiringItem[] => {
    const items: MergedExpiringItem[] = []
    for (const r of expiring) {
      items.push({
        kind: 'routine',
        id: r.id,
        sortDate: r.end_date,
        title: r.student?.full_name ?? '—',
        subtitle: r.name,
        href: `/routines/${r.id}`,
        days: daysUntil(r.end_date),
      })
    }
    for (const s of expiringPlans) {
      items.push({
        kind: 'plan',
        id: s.id,
        sortDate: s.plan_end_date,
        title: s.full_name,
        subtitle: 'Plan del alumno',
        href: peopleDetailPath(s.id),
        days: daysUntil(s.plan_end_date),
      })
    }
    return items.sort((a, b) => a.sortDate.localeCompare(b.sortDate))
  }, [expiring, expiringPlans, role])

  const showUnifiedExpiringCard = canSeeTraining || expiringPlans.length > 0

  useEffect(() => {
    if (!user) return
    void loadDashboard()
  }, [user])

  async function loadDashboard() {
    setLoading(true)
    try {
      // Fecha de inicio: primer día de hace 5 meses
      const since = new Date()
      since.setMonth(since.getMonth() - 5)
      since.setDate(1)
      const sinceStr = since.toISOString().split('T')[0]
      const mb = monthBoundsISO()
      /** Inicio del día local: turnos de “hoy” cuentan aunque la hora de inicio ya pasó (aún scheduled/confirmed). */
      const startOfLocalDay = new Date()
      startOfLocalDay.setHours(0, 0, 0, 0)
      const appointmentsPendingFromISO = startOfLocalDay.toISOString()

      const momPromises: PromiseLike<{ count: number | null }>[] = []
      momPromises.push(
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', user!.id)
          .eq('status', 'activo')
          .gte('created_at', mb.startThis)
          .lt('created_at', mb.startNext),
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', user!.id)
          .eq('status', 'activo')
          .gte('created_at', mb.startPrev)
          .lt('created_at', mb.startThis),
      )
      if (canSeeTraining) {
        momPromises.push(
          supabase
            .from('routines')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', user!.id)
            .in('status', ['activa', 'por_vencer'])
            .gte('created_at', mb.startThis)
            .lt('created_at', mb.startNext),
          supabase
            .from('routines')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', user!.id)
            .in('status', ['activa', 'por_vencer'])
            .gte('created_at', mb.startPrev)
            .lt('created_at', mb.startThis),
          supabase
            .from('trainer_student_meal_plans')
            .select('id, students!inner(status)', { count: 'exact', head: true })
            .eq('owner_id', user!.id)
            .eq('students.status', 'activo')
            .gte('created_at', mb.startThis)
            .lt('created_at', mb.startNext),
          supabase
            .from('trainer_student_meal_plans')
            .select('id, students!inner(status)', { count: 'exact', head: true })
            .eq('owner_id', user!.id)
            .eq('students.status', 'activo')
            .gte('created_at', mb.startPrev)
            .lt('created_at', mb.startThis),
          supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', user!.id)
            .eq('profile_type', 'trainer')
            .in('status', ['scheduled', 'confirmed'])
            .gte('created_at', mb.startThis)
            .lt('created_at', mb.startNext),
          supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', user!.id)
            .eq('profile_type', 'trainer')
            .in('status', ['scheduled', 'confirmed'])
            .gte('created_at', mb.startPrev)
            .lt('created_at', mb.startThis),
        )
      } else if (canSeeNutrition) {
        momPromises.push(
          supabase
            .from('nutrition_plan_library')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', user!.id)
            .gte('created_at', mb.startThis)
            .lt('created_at', mb.startNext),
          supabase
            .from('nutrition_plan_library')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', user!.id)
            .gte('created_at', mb.startPrev)
            .lt('created_at', mb.startThis),
          supabase
            .from('nutrition_patient_documents')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', user!.id)
            .gte('uploaded_at', mb.startThis)
            .lt('uploaded_at', mb.startNext),
          supabase
            .from('nutrition_patient_documents')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', user!.id)
            .gte('uploaded_at', mb.startPrev)
            .lt('uploaded_at', mb.startThis),
        )
      }

      /** Una sola ronda de red: KPIs + finanzas + alumnos (incl. level) + MoM + cola que no depende de IDs para hábitos. */
      const DASHBOARD_BASE_QUERIES = 13
      const momLen = momPromises.length

      const r = await Promise.all([
        accessibleStudentsSelect('id', { count: 'exact', head: true }).eq('status', 'activo'),
        canSeeTraining
          ? supabase.from('routines').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id).in('status', ['activa', 'por_vencer'])
          : Promise.resolve({ count: 0 } as { count: number | null }),
        canSeeTraining
          ? supabase
              .from('trainer_student_meal_plans')
              .select('id, students!inner(status)', { count: 'exact', head: true })
              .eq('owner_id', user!.id)
              .eq('students.status', 'activo')
          : Promise.resolve({ count: 0 } as { count: number | null }),
        canSeeTraining
          ? supabase
              .from('appointments')
              .select('id', { count: 'exact', head: true })
              .eq('owner_id', user!.id)
              .eq('profile_type', 'trainer')
              .in('status', ['scheduled', 'confirmed'])
              .gte('starts_at', appointmentsPendingFromISO)
          : Promise.resolve({ count: 0 } as { count: number | null }),
        canSeeNutrition
          ? supabase.from('nutrition_plan_library').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id)
          : Promise.resolve({ count: 0 } as { count: number | null }),
        canSeeNutrition
          ? supabase.from('nutrition_patient_documents').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id)
          : Promise.resolve({ count: 0 } as { count: number | null }),
        canSeeTraining
          ? supabase.from('routines').select('*, student:students(full_name)').eq('owner_id', user!.id).in('status', ['activa', 'por_vencer']).lte('end_date', new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]).order('end_date', { ascending: true }).limit(5)
          : Promise.resolve({ data: [] } as { data: unknown[] }),
        supabase.from('notifications').select('*').eq('user_id', user!.id).eq('is_read', false).order('created_at', { ascending: false }).limit(5),
        canSeeFinances
          ? supabase.from('income').select('income_date, amount, scope').eq('owner_id', user!.id).eq('status', 'cobrado').gte('income_date', sinceStr)
          : Promise.resolve({ data: [] } as { data: { income_date: string; amount: number; scope?: string | null }[] }),
        canSeeFinances
          ? supabase
              .from('expenses')
              .select('expense_date, amount, scope')
              .eq('owner_id', user!.id)
              .gte('expense_date', sinceStr)
          : Promise.resolve({ data: [] } as { data: DashboardExpenseRow[] }),
        accessibleStudentsSelect('id, full_name, plan_end_date, status')
          .eq('status', 'activo')
          .not('plan_end_date', 'is', null)
          .lte('plan_end_date', new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0])
          .order('plan_end_date', { ascending: true })
          .limit(5),
        accessibleStudentsSelect('id, full_name, birth_date, created_at, avatar_path, level').eq('status', 'activo'),
        supabase
          .from('appointments')
          .select('id, title, starts_at, student:students(full_name)')
          .eq('owner_id', user!.id)
          .in('status', ['scheduled', 'confirmed'])
          .gte('starts_at', `${new Date().toISOString().split('T')[0]}T00:00:00`)
          .lte('starts_at', `${new Date().toISOString().split('T')[0]}T23:59:59`)
          .order('starts_at'),
        ...momPromises,
        canSeeFinances
          ? supabase
              .from('income')
              .select('id, amount, income_date, status, payment_method, student:students(full_name)')
              .eq('owner_id', user!.id)
              .order('income_date', { ascending: false })
              .limit(7)
          : Promise.resolve({ data: [] }),
        canSeeFinances
          ? supabase.from('income').select('amount').eq('owner_id', user!.id).neq('status', 'cobrado')
          : Promise.resolve({ data: [] as { amount: number }[] }),
        canSeeTraining
          ? supabase.from('routines').select('student_id').eq('owner_id', user!.id).in('status', ['activa', 'por_vencer'])
          : Promise.resolve({ data: [] as { student_id: string }[] }),
        accessibleStudentsSelect('intake_ferster').eq('status', 'activo').not('intake_ferster', 'is', null),
      ])

      const { count: activeStudents } = r[0]
      const { count: activeRoutines } = r[1]
      const { count: activeMealPlans } = r[2]
      const { count: pendingAppointments } = r[3]
      const { count: activeNutritionPlans } = r[4]
      const { count: nutritionDocuments } = r[5]
      const { data: expiringData } = r[6] as { data: unknown[] }
      const { data: notifData } = r[7]
      const { data: incomeRows } = r[8]
      const { data: expenseRowsRaw } = r[9]
      const { data: expiringPlansData } = r[10]
      const { data: studentDates } = r[11]
      const { data: todayAppsData } = r[12]

      const momRes = r.slice(DASHBOARD_BASE_QUERIES, DASHBOARD_BASE_QUERIES + momLen) as { count: number | null }[]
      const tail = DASHBOARD_BASE_QUERIES + momLen
      type IncomeRecentRow = { id: string; amount: number; income_date: string; status: string; payment_method: string; student?: { full_name?: string } | null }
      type PendingAmountRow = { amount: number }
      type RoutineStudentRow = { student_id: string }
      type GoalRow = { intake_ferster: Record<string, unknown> | null }

      const recentRes = r[tail] as { data: IncomeRecentRow[] | null }
      const pendingRes = r[tail + 1] as { data: PendingAmountRow[] | null }
      const activeRoutineIdsRes = r[tail + 2] as { data: RoutineStudentRow[] | null }
      const goalsRes = r[tail + 3] as { data: GoalRow[] | null }
      let mi = 0
      const momStudentsThis = momRes[mi++]?.count ?? 0
      const momStudentsPrev = momRes[mi++]?.count ?? 0
      let momRoutinesThis = 0
      let momRoutinesPrev = 0
      let momMealPlansThis = 0
      let momMealPlansPrev = 0
      let momAppointmentsThis = 0
      let momAppointmentsPrev = 0
      let momNutPlansThis = 0
      let momNutPlansPrev = 0
      let momNutDocsThis = 0
      let momNutDocsPrev = 0
      if (canSeeTraining) {
        momRoutinesThis = momRes[mi++]?.count ?? 0
        momRoutinesPrev = momRes[mi++]?.count ?? 0
        momMealPlansThis = momRes[mi++]?.count ?? 0
        momMealPlansPrev = momRes[mi++]?.count ?? 0
        momAppointmentsThis = momRes[mi++]?.count ?? 0
        momAppointmentsPrev = momRes[mi++]?.count ?? 0
      } else if (canSeeNutrition) {
        momNutPlansThis = momRes[mi++]?.count ?? 0
        momNutPlansPrev = momRes[mi++]?.count ?? 0
        momNutDocsThis = momRes[mi++]?.count ?? 0
        momNutDocsPrev = momRes[mi++]?.count ?? 0
      }

      // Compute retention buckets
      const now = new Date()
      const c3m  = new Date(now.getFullYear(), now.getMonth() - 3,  now.getDate())
      const c6m  = new Date(now.getFullYear(), now.getMonth() - 6,  now.getDate())
      const c12m = new Date(now.getFullYear() - 1, now.getMonth(),  now.getDate())
      const dates = (studentDates ?? []) as { created_at: string }[]
      setRetention({
        m3:  dates.filter((d) => new Date(d.created_at) <= c3m).length,
        m6:  dates.filter((d) => new Date(d.created_at) <= c6m).length,
        m12: dates.filter((d) => new Date(d.created_at) <= c12m).length,
      })

      // Birthdays in next 7 days
      const bdayList = (dates as { id: string; full_name: string; birth_date: string | null; created_at: string }[])
        .filter((s) => s.birth_date)
        .map((s) => {
          const bd   = s.birth_date!.slice(5) // MM-DD
          const thisYear = new Date(`${now.getFullYear()}-${bd}`)
          let diff = Math.round((thisYear.getTime() - now.setHours(0,0,0,0)) / 86400000)
          if (diff < 0) diff += 365 // passed this year → next year
          return { id: s.id, full_name: s.full_name, daysUntil: diff }
        })
        .filter((s) => s.daysUntil <= 7)
        .sort((a, b) => a.daysUntil - b.daysUntil)
      setBirthdays(bdayList)

      // Today's appointments
      setTodayApps(
        ((todayAppsData ?? []) as { id: string; title: string; starts_at: string; student?: { full_name?: string } | null }[])
          .map((a) => ({
            id: a.id,
            title: a.title,
            starts_at: a.starts_at,
            student_name: a.student?.full_name ?? '—',
          }))
      )

      const mb2 = monthBoundsISO()
      const allIncomeRows = (incomeRows ?? []) as { income_date: string; amount: number; scope?: string | null }[]
      const currentMonthIncome = allIncomeRows
        .filter((r) => r.income_date >= mb2.startThis.slice(0, 10) && r.income_date < mb2.startNext.slice(0, 10))
        .reduce((s, r) => s + r.amount, 0)
      const prevMonthIncome = allIncomeRows
        .filter((r) => r.income_date >= mb2.startPrev.slice(0, 10) && r.income_date < mb2.startThis.slice(0, 10))
        .reduce((s, r) => s + r.amount, 0)

      setStats({
        activeStudents: activeStudents ?? 0,
        activeRoutines: activeRoutines ?? 0,
        activeMealPlans: activeMealPlans ?? 0,
        pendingAppointments: pendingAppointments ?? 0,
        activeNutritionPlans: activeNutritionPlans ?? 0,
        nutritionDocuments: nutritionDocuments ?? 0,
        currentMonthIncome,
        prevMonthIncome,
        momStudentsThis,
        momStudentsPrev,
        momRoutinesThis,
        momRoutinesPrev,
        momMealPlansThis,
        momMealPlansPrev,
        momAppointmentsThis,
        momAppointmentsPrev,
        momNutPlansThis,
        momNutPlansPrev,
        momNutDocsThis,
        momNutDocsPrev,
      })
      setExpiring((expiringData as unknown as ExpiringRoutine[]) ?? [])
      setExpiringPlans((expiringPlansData as unknown as ExpiringPlan[]) ?? [])
      setNotifications(notifData ?? [])
      setExpenseChartModel(
        canSeeFinances
          ? buildFinanceScopeChartModel(
              (expenseRowsRaw ?? []) as DashboardExpenseRow[],
              (incomeRows ?? []) as DashboardIncomeScopeRow[],
            )
          : null,
      )

      const recentRows = ((recentRes.data ?? []) as IncomeRecentRow[]).map((row) => ({
        id: row.id,
        student_name: row.student?.full_name ?? null,
        amount: row.amount,
        status: row.status,
        payment_method: row.payment_method,
        income_date: row.income_date,
      }))
      setRecentIncome(recentRows)

      const levels = (studentDates ?? []) as { level: string }[]
      const totalLevels = levels.length
      const dist = LEVEL_META.map((m) => {
        const count = levels.filter((l) => l.level === m.key).length
        return { key: m.key, label: m.label, count, pct: totalLevels === 0 ? 0 : Math.round((count / totalLevels) * 100) }
      })
      setLevelDist(dist)

      const allStudents = ((studentDates ?? []) as { id: string; full_name: string; birth_date: string | null; created_at: string; avatar_path: string | null }[])
      const studentIds = allStudents.map((s) => s.id)
      const now3 = new Date()
      const monthStartStr = `${now3.getFullYear()}-${String(now3.getMonth() + 1).padStart(2, '0')}-01`
      const todayStr = now3.toISOString().split('T')[0]

      let habitLogsMonthRes: { data: { student_id: string; log_date: string; habit_id: string }[] | null }
      let habitSelectionsRes: { data: { student_id: string; habit_id: string }[] | null }
      if (studentIds.length > 0) {
        ;[habitLogsMonthRes, habitSelectionsRes] = await Promise.all([
          supabase.from('habit_logs').select('student_id, log_date, habit_id').in('student_id', studentIds).gte('log_date', monthStartStr).lte('log_date', todayStr),
          supabase.from('student_habit_selections').select('student_id, habit_id').in('student_id', studentIds),
        ])
      } else {
        habitLogsMonthRes = { data: [] }
        habitSelectionsRes = { data: [] }
      }

      // 1. Cobros pendientes
      const pendingRows = (pendingRes.data ?? []) as { amount: number }[]
      setPendingIncomeTotal(pendingRows.reduce((s, r) => s + r.amount, 0))

      // 2. Alumnos sin rutina activa
      const withRoutine = new Set(((activeRoutineIdsRes.data ?? []) as { student_id: string }[]).map((r) => r.student_id))
      setStudentsWithoutRoutine(allStudents.filter((s) => !withRoutine.has(s.id)).slice(0, 5))

      // 3. Distribución de objetivos
      const goalCounts: Record<string, number> = {}
      for (const row of (goalsRes.data ?? []) as { intake_ferster: Record<string, unknown> | null }[]) {
        const g = row.intake_ferster?.main_goal as string | undefined
        if (g) goalCounts[g] = (goalCounts[g] ?? 0) + 1
      }
      const goalTotal = Object.values(goalCounts).reduce((s, c) => s + c, 0)
      setGoalDist(
        Object.entries(goalCounts)
          .map(([k, count]) => ({
            key: k,
            label: GOAL_META[k]?.label ?? k,
            count,
            pct: goalTotal === 0 ? 0 : Math.round((count / goalTotal) * 100),
          }))
          .sort((a, b) => b.count - a.count)
      )

      // 4 & 5. Adherencia de hábitos
      const daysElapsed = Math.max(now3.getDate(), 1)
      const selsByStudent: Record<string, number> = {}
      for (const sel of (habitSelectionsRes.data ?? []) as { student_id: string }[]) {
        selsByStudent[sel.student_id] = (selsByStudent[sel.student_id] ?? 0) + 1
      }
      const logsByStudent: Record<string, number> = {}
      for (const log of (habitLogsMonthRes.data ?? []) as { student_id: string }[]) {
        logsByStudent[log.student_id] = (logsByStudent[log.student_id] ?? 0) + 1
      }
      const perStudentHabit = allStudents
        .filter((s) => (selsByStudent[s.id] ?? 0) > 0)
        .map((s) => {
          const sels = selsByStudent[s.id] ?? 0
          const logs = logsByStudent[s.id] ?? 0
          const expected = sels * daysElapsed
          return { id: s.id, name: s.full_name, pct: Math.min(100, expected === 0 ? 0 : Math.round((logs / expected) * 100)) }
        })
      const avgHabit = perStudentHabit.length === 0 ? 0 : Math.round(perStudentHabit.reduce((s, x) => s + x.pct, 0) / perStudentHabit.length)
      setHabitAvg(avgHabit)
      setHabitTop5([...perStudentHabit].sort((a, b) => b.pct - a.pct).slice(0, 5))

      if (canSeeTraining) {
        const sinceCi = new Date()
        sinceCi.setDate(sinceCi.getDate() - 30)
        // Mostramos pendientes de respuesta (no el total) — es la métrica
        // accionable: "todavía no le contesté a X alumnos esta semana".
        const ciRes = await supabase
          .from('check_in_responses')
          .select('id', { count: 'exact', head: true })
          .gte('submitted_at', sinceCi.toISOString())
          .is('trainer_replied_at', null)
        setCheckInRecentCount(ciRes.count ?? 0)
        const schRes = await supabase
          .from('check_in_send_schedules')
          .select(
            'id, owner_id, form_id, is_enabled, day_of_week, timezone, prefer_group_whatsapp, created_at, updated_at, form:check_in_forms(title)',
          )
          .eq('owner_id', user!.id)
          .eq('is_enabled', true)
        const srows = (schRes.data ?? []) as DueCheckInScheduleRow[]
        const dueCheckIns = srows.filter((s) => scheduleMatchesToday(s))
        setDueCheckInSchedules(dueCheckIns)
        let dueResources: DueResourceScheduleRow[] = []
        try {
          const resSchRes = await supabase
            .from('trainer_resource_send_schedules')
            .select(
              'id, owner_id, resource_id, template_id, is_enabled, day_of_week, timezone, prefer_group_whatsapp, created_at, updated_at, resource:trainer_resources(title, url, description), template:trainer_message_templates(title, body)',
            )
            .eq('owner_id', user!.id)
            .eq('is_enabled', true)
          if (!resSchRes.error) {
            dueResources = (resSchRes.data ?? []) as DueResourceScheduleRow[]
            dueResources = dueResources.filter((s) => scheduleMatchesToday(s))
            setDueResourceSchedules(dueResources)
          } else {
            setDueResourceSchedules([])
          }
        } catch {
          setDueResourceSchedules([])
        }

        const [quickSends, missing] = await Promise.all([
          loadDashboardQuickSends(user!.id, dueCheckIns, dueResources),
          loadStudentsMissingCheckIn(user!.id, 7),
        ])
        setCheckInQuickSends(quickSends.checkInSends)
        setResourceQuickSends(quickSends.resourceSends)
        setMissingCheckInStudents(missing)
      } else {
        setCheckInRecentCount(0)
        setDueCheckInSchedules([])
        setDueResourceSchedules([])
        setCheckInQuickSends([])
        setResourceQuickSends([])
        setMissingCheckInStudents([])
      }

      setDataUpdatedAt(new Date())

    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div>
        <Header title="Inicio" />
        <div className="px-4 lg:px-6 py-8 space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
          <Skeleton className="h-11 rounded-xl border border-transparent" />
          <ChartSkeleton />
        </div>
      </div>
    )
  }

  // Income MoM delta
  const incomeDelta = stats.prevMonthIncome === 0
    ? 0
    : Math.round(((stats.currentMonthIncome - stats.prevMonthIncome) / stats.prevMonthIncome) * 100)

  // Today label
  const todayLabel = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
      <Header title="Inicio" />
      {dataUpdatedAt && !loading && (
        <p className="px-4 pt-1 text-[10px] text-ink-muted tabular-nums lg:px-6" aria-live="polite">
          Datos del tablero actualizados · {formatDate(dataUpdatedAt, 'dd/MM/yyyy HH:mm')}
        </p>
      )}

      <div className="page-shell-x page-shell-y space-y-6">

        {canSeeTraining ? (
          <DashboardTrainerOpsPanel
            dueCheckInSchedules={dueCheckInSchedules}
            dueResourceSchedules={dueResourceSchedules}
            checkInQuickSends={checkInQuickSends}
            resourceQuickSends={resourceQuickSends}
            missingCheckInStudents={missingCheckInStudents}
          />
        ) : null}

        <section className="space-y-2">
          <PageSectionTitle title="Resumen del mes" />

          {/* pt mínimo: los avatares sobresalen con overflow-visible, sin hueco grande bajo el título */}
          <div className="grid grid-cols-2 lg:grid-cols-4 items-stretch gap-3 gap-y-5 lg:gap-4 lg:gap-y-6 overflow-visible pt-2 sm:pt-3 [&>*]:h-full">
          <StatCard
            title={activePeopleLabel}
            value={stats.activeStudents}
            countUp
            surface="gradient"
            kpiFigmaIcon="patients"
            iconVariant="3d"
            heroAvatarSrc="/avatars/gorilla.png?v=1"
            monthOverMonth={{ thisMonth: stats.momStudentsThis, prevMonth: stats.momStudentsPrev, scopeLabel: 'Altas' }}
            onClick={() => navigate(peopleHubPath)}
          />
          {canSeeTraining ? (
            <>
              <StatCard
                title="Rutinas vigentes"
                value={stats.activeRoutines}
                countUp
                surface="gradient"
                kpiFigmaIcon="routines"
                iconVariant="3d"
                heroAvatarSrc="/avatars/dashboard-students-routine.png?v=8"
                monthOverMonth={{ thisMonth: stats.momRoutinesThis, prevMonth: stats.momRoutinesPrev, scopeLabel: 'Nuevas rutinas' }}
                onClick={() => navigate('/routines')}
              />
              <StatCard
                title="Planes alimentación"
                value={stats.activeMealPlans}
                countUp
                surface="gradient"
                kpiFigmaIcon="meal-plans"
                iconVariant="3d"
                heroAvatarSrc="/avatars/dashboard-students-nutrition.png?v=6"
                monthOverMonth={{ thisMonth: stats.momMealPlansThis, prevMonth: stats.momMealPlansPrev, scopeLabel: 'Planes nuevos' }}
                onClick={() => navigate('/meal-plans')}
              />
              <StatCard
                title="Ingresos · este mes"
                value={formatCurrency(animatedIncome)}
                surface="gradient"
                kpiFigmaIcon="income"
                iconVariant="3d"
                featured
                heroAvatarSrc="/avatars/dashboard-students-money.png?v=5"
                comparisonPercent={incomeDelta}
                onClick={() => navigate('/finances')}
              />
            </>
          ) : (
            <>
              <StatCard
                title="Planes base"
                value={stats.activeNutritionPlans}
                countUp
                surface="gradient"
                kpiFigmaIcon="nutrition-plans"
                iconVariant="3d"
                heroAvatarSrc="/avatars/dashboard-students-nutrition.png?v=6"
                subtitle="Biblioteca reusable"
                monthOverMonth={{
                  thisMonth: stats.momNutPlansThis,
                  prevMonth: stats.momNutPlansPrev,
                  scopeLabel: 'Nuevos en biblioteca',
                }}
                onClick={() => navigate('/nutrition/plans')}
              />
              <StatCard
                title="PDFs antropometría"
                value={stats.nutritionDocuments}
                countUp
                surface="gradient"
                kpiFigmaIcon="anthropometry-pdf"
                iconVariant="3d"
                heroAvatarSrc="/avatars/dashboard-students-antro.png?v=1"
                monthOverMonth={{ thisMonth: stats.momNutDocsThis, prevMonth: stats.momNutDocsPrev, scopeLabel: 'PDFs subidos' }}
                onClick={() => navigate('/nutrition')}
              />
              <StatCard
                title="Ingresos · este mes"
                value={formatCurrency(animatedIncome)}
                surface="gradient"
                kpiFigmaIcon="income"
                iconVariant="3d"
                featured
                heroAvatarSrc="/avatars/dashboard-students-money.png?v=5"
                comparisonPercent={incomeDelta}
                onClick={() => navigate('/finances')}
              />
            </>
          )}
          </div>
        </section>



        {canSeeTraining && checkInRecentCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[11px]">
            <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <span className="text-amber-900 dark:text-amber-200">
              {checkInRecentCount === 1
                ? '1 check-in pendiente de respuesta'
                : `${checkInRecentCount} check-ins pendientes de respuesta`}{' '}
              <span className="text-ink-muted">(30 días)</span>
            </span>
            <button
              type="button"
              onClick={() => navigate('/feedback?tab=checkins')}
              className="ml-auto font-medium text-amber-700 hover:underline dark:text-amber-300"
            >
              Responder
            </button>
          </div>
        ) : null}

        {/* ── Strip "Hoy" ──────────────────────────────────────────── */}
        {(todayApps.length > 0 || birthdays.length > 0 || mergedExpiring.some(r => r.days <= 3) || pendingIncomeTotal > 0) && (
          <div className="rounded-2xl border border-surface-border bg-surface-elevated/30 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted mb-2.5 capitalize">{todayLabel}</p>
            <div className="flex flex-wrap gap-2">
              {todayApps.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => navigate('/appointments')}
                  className="inline-flex items-center gap-2 rounded-xl border border-brand-secondary/25 bg-brand-secondary/8 px-3 py-1.5 text-xs font-medium text-ink-primary hover:bg-brand-secondary/15 transition-colors"
                >
                  <Calendar className="h-3.5 w-3.5 text-brand-secondary shrink-0" />
                  <span>{new Date(a.starts_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · {a.student_name}</span>
                </button>
              ))}
              {birthdays.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => navigate(peopleDetailPath(b.id))}
                  className="inline-flex items-center gap-2 rounded-xl border border-brand-secondary/25 bg-brand-secondary/8 px-3 py-1.5 text-xs font-medium text-ink-primary hover:bg-brand-secondary/15 transition-colors"
                >
                  <Cake className="h-3.5 w-3.5 text-brand-secondary shrink-0" />
                  <span>{b.full_name} · {b.daysUntil === 0 ? 'Hoy' : b.daysUntil === 1 ? 'Mañana' : `en ${b.daysUntil}d`}</span>
                </button>
              ))}
              {mergedExpiring.filter(r => r.days <= 3).map((row) => (
                <button
                  key={`exp-${row.id}`}
                  type="button"
                  onClick={() => navigate(row.href)}
                  className="inline-flex items-center gap-2 rounded-xl border border-status-expired/25 bg-status-expired/8 px-3 py-1.5 text-xs font-medium text-ink-primary hover:bg-status-expired/15 transition-colors"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-status-expired shrink-0" />
                  <span>{row.title} · {row.days < 0 ? 'Vencido' : row.days === 0 ? 'Vence hoy' : `${row.days}d`}</span>
                </button>
              ))}
              {pendingIncomeTotal > 0 && (
                <button
                  type="button"
                  onClick={() => navigate('/finances')}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 px-3 py-1.5 text-xs font-medium text-ink-primary hover:bg-amber-500/15 transition-colors"
                >
                  <Wallet className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>{formatCurrency(pendingIncomeTotal)} pendiente de cobro</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Por ámbito · 6 meses (un neto por línea; sin punteados) ─────────── */}
        {canSeeFinances && (
          <Card className="overflow-hidden p-0">
            <CardHeader className="px-5 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-ink-muted" />
                <CardTitle className="font-medium">Por ámbito · 6 meses</CardTitle>
              </div>
            </CardHeader>
            <div className="pt-3 pb-2">
              {expenseChartModel ? (
                <ExpenseScopesLineChart model={expenseChartModel} />
              ) : (
                <p className="text-center text-sm text-ink-muted py-12 px-4">
                  Sin datos en los últimos 6 meses · registrá ingresos o gastos desde Finanzas
                </p>
              )}
            </div>
          </Card>
        )}

        {/* ── Últimos cobros + Distribución ───────────────────────── */}
        {canSeeFinances && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

            {/* Últimos cobros */}
            <Card className="overflow-hidden p-0">
              <CardHeader className="px-5 pt-4 pb-3">
                <div className="flex flex-col gap-0.5">
                  <CardTitle className="font-medium">Últimos cobros</CardTitle>
                  <p className="text-xs text-ink-muted">Ingresos recientes registrados</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/finances')}>Ver todos</Button>
              </CardHeader>
              {recentIncome.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-muted">Sin ingresos registrados aún</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-surface-border/60 bg-surface-elevated/30">
                        <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Alumno</th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Monto</th>
                        <th className="hidden px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:table-cell">Método</th>
                        <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border/40">
                      {recentIncome.map((row, rowIndex) => (
                        <tr
                          key={row.id}
                          style={tableRowEnterStyle(rowIndex)}
                          className="hover:bg-surface-elevated/30 transition-colors cursor-pointer"
                          onClick={() => navigate('/finances')}
                        >
                          <td className="hh-row-drop-in px-4 py-2.5">
                            <p className="font-medium text-ink-primary truncate max-w-[130px]">{row.student_name ?? '—'}</p>
                            <p className="text-[10px] text-ink-muted tabular-nums">{new Date(row.income_date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</p>
                          </td>
                          <td className="hh-row-drop-in px-3 py-2.5 text-right font-semibold tabular-nums text-ink-primary whitespace-nowrap">
                            {formatCurrency(row.amount)}
                          </td>
                          <td className="hh-row-drop-in hidden px-3 py-2.5 sm:table-cell">
                            <PaymentMethodBadge method={row.payment_method} className="text-[10px]" />
                          </td>
                          <td className="hh-row-drop-in px-3 py-2.5 text-center">
                            <span className={cn(
                              'inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                              row.status === 'cobrado' && 'border-brand-secondary/40 bg-brand-secondary/15 text-brand-secondary',
                              row.status === 'pendiente' && 'border-brand-tertiary/40 bg-brand-tertiary/12 text-brand-tertiary',
                              row.status !== 'cobrado' && row.status !== 'pendiente' && 'border-surface-border/50 bg-surface-elevated/50 text-ink-muted',
                            )}>
                              {row.status === 'cobrado' ? 'Cobrado' : row.status === 'pendiente' ? 'Pendiente' : 'Cancelado'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Distribución por nivel */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-0.5">
                  <CardTitle className="font-medium">{role === 'nutritionist' ? 'Pacientes por nivel' : 'Alumnos por nivel'}</CardTitle>
                  <p className="text-xs text-ink-muted">Distribución de {stats.activeStudents} {role === 'nutritionist' ? 'pacientes activos' : 'alumnos activos'}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate(peopleHubPath)}>{role === 'nutritionist' ? 'Ver pacientes' : 'Ver alumnos'}</Button>
              </CardHeader>
              <div className="space-y-4">
                {levelDist.map((lvl, i) => {
                  const accent = LEVEL_BRAND_ACCENT[i] ?? LEVEL_BRAND_ACCENT[0]
                  return (
                    <div key={lvl.key}>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={cn('h-2 w-2 shrink-0 rounded-full ring-2 ring-black/10 dark:ring-white/10', accent.dot)} />
                          <span className="font-medium text-ink-primary">{lvl.label}</span>
                        </div>
                        <div className="flex items-center gap-2 tabular-nums">
                          <span className="text-ink-muted">{lvl.count}</span>
                          <span className="w-9 text-right font-semibold tabular-nums text-ink-primary">{lvl.pct}%</span>
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-elevated">
                        <div
                          className={cn('h-full rounded-full transition-all duration-700', accent.bar)}
                          style={{ width: `${lvl.pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                {stats.activeStudents === 0 && (
                  <p className="py-4 text-center text-sm text-ink-muted">Sin alumnos activos</p>
                )}
              </div>
            </Card>

          </div>
        )}

        {/* ── Adherencia + Objetivos ───────────────────────────────── */}
        {canSeeTraining && habitTop5.length > 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

            {/* Adherencia promedio + Top 5 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-0.5">
                  <CardTitle className="font-medium">Adherencia · este mes</CardTitle>
                  <p className="text-xs text-ink-muted">Cumplimiento de hábitos por alumno</p>
                </div>
              </CardHeader>
              {/* KPI grande */}
              <div className="flex items-end gap-3 mb-4">
                <p className={cn(
                  'text-5xl font-bold tabular-nums leading-none',
                  habitAvg >= 70
                    ? 'text-brand-secondary'
                    : habitAvg >= 40
                      ? 'text-brand-tertiary'
                      : 'text-brand-secondary/55 dark:text-brand-tertiary/55',
                )}>
                  {habitAvg}<span className="text-2xl font-semibold">%</span>
                </p>
                <p className="text-xs text-ink-muted pb-1">promedio entre alumnos con hábitos</p>
              </div>
              {/* Top 5 ranking */}
              <div className="space-y-2.5">
                {habitTop5.map((s, i) => {
                  const accent = BRAND_ROW_ACCENT_PAIR[i % BRAND_ROW_ACCENT_PAIR.length]
                  return (
                    <div key={s.id} className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate(peopleDetailPath(s.id))}>
                      <span className="w-4 text-[11px] font-bold text-ink-muted tabular-nums shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={cn('h-2 w-2 shrink-0 rounded-full ring-2 ring-black/10 dark:ring-white/10', accent.dot)} />
                            <p className="truncate text-xs font-medium text-ink-primary group-hover:text-brand-secondary transition-colors">{s.name}</p>
                          </div>
                          <span className={cn('text-[11px] font-semibold tabular-nums shrink-0', accent.text)}>{s.pct}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                          <div
                            className={cn('h-full rounded-full transition-all duration-500', accent.bar)}
                            style={{ width: `${s.pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Distribución de objetivos */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-0.5">
                  <CardTitle className="font-medium">Objetivos de alumnos</CardTitle>
                  <p className="text-xs text-ink-muted">Meta principal declarada al inscribirse</p>
                </div>
              </CardHeader>
              {goalDist.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-muted">Sin datos de objetivos aún</p>
              ) : (
                <div className="space-y-4">
                  {goalDist.map((g, i) => {
                    const accent = BRAND_ROW_ACCENT_PAIR[i % BRAND_ROW_ACCENT_PAIR.length]
                    return (
                      <div key={g.key}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className={cn('h-2 w-2 shrink-0 rounded-full ring-2 ring-black/10 dark:ring-white/10', accent.dot)} />
                            <span className="font-medium text-ink-primary">{g.label}</span>
                          </div>
                          <div className="flex items-center gap-2 tabular-nums">
                            <span className="text-ink-muted">{g.count}</span>
                            <span className="w-9 text-right font-semibold tabular-nums text-ink-primary">{g.pct}%</span>
                          </div>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-surface-elevated">
                          <div
                            className={cn('h-full rounded-full transition-all duration-700', accent.bar)}
                            style={{ width: `${g.pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

          </div>
        )}

        {/* ── Alumnos sin rutina activa ─────────────────────────────── */}
        {canSeeTraining && studentsWithoutRoutine.length > 0 && (
          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-surface-border/40 px-3 py-2 sm:px-3.5">
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[13px] font-semibold text-ink-primary">Sin rutina activa</p>
                <p className="truncate text-[10px] text-ink-muted">
                  {studentsWithoutRoutine.length === 1
                    ? '1 alumno activo sin rutina vigente'
                    : `${studentsWithoutRoutine.length} alumnos activos sin rutina vigente`}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 shrink-0 px-2 text-xs" onClick={() => navigate(peopleHubPath)}>
                Ver alumnos
              </Button>
            </div>
            <div className="divide-y divide-surface-border/35">
              {studentsWithoutRoutine.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => navigate(peopleDetailPath(s.id))}
                  className="group flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left transition-colors hover:bg-surface-elevated/50 sm:px-3.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <StudentAvatarThumb storagePath={s.avatar_path} name={s.full_name} />
                    <p className="truncate text-[13px] font-medium text-ink-primary group-hover:text-brand-secondary transition-colors">{s.full_name}</p>
                  </div>
                  <ChevronRight className="h-3 w-3 shrink-0 text-ink-muted opacity-45 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* ── Vencimientos próximos ────────────────────────────────── */}
        {showUnifiedExpiringCard && (
          <Card padding="sm">
            <CardHeader className="mb-2 items-start gap-x-3 gap-y-1 sm:items-center">
              <div className="min-w-0 leading-tight">
                <CardTitle className="text-[13px] font-semibold leading-snug">Próximos vencimientos</CardTitle>
                <p className="text-[10px] text-ink-muted">Rutinas y planes · 14 días</p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-0.5 sm:ml-auto">
                {canSeeTraining && (
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => navigate('/routines')}>
                    Rutinas
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => navigate(peopleHubPath)}>
                  {role === 'nutritionist' ? 'Pacientes' : 'Alumnos'}
                </Button>
              </div>
            </CardHeader>
            {mergedExpiring.length === 0 ? (
              <p className="py-3 text-center text-xs text-ink-muted">Nada próximo en esta ventana</p>
            ) : (
              <div className="space-y-1">
                {mergedExpiring.map((row) => (
                  <button
                    key={`${row.kind}-${row.id}`}
                    type="button"
                    onClick={() => navigate(row.href)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-surface-border/70 bg-surface-elevated/30 px-2.5 py-1.5 text-left transition-colors hover:bg-surface-elevated/55"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="w-[4rem] shrink-0 pt-[1px] text-[9px] font-semibold uppercase tracking-wide text-ink-muted">
                        {row.kind === 'routine' ? 'Rutina' : 'Plan'}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink-primary">{row.title}</p>
                        <p className="truncate text-[11px] text-ink-muted">{row.subtitle}</p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded px-1.5 py-[1px] text-[10px] font-semibold tabular-nums',
                        row.days < 0 && 'border border-status-expired/30 text-status-expired',
                        row.days >= 0 && row.days <= 3 && 'border border-status-expiring/30 text-status-expiring',
                        row.days > 3 && 'border border-surface-border/80 text-ink-secondary',
                      )}
                    >
                      {row.days < 0 ? 'Vencido' : row.days === 0 ? 'Hoy' : `${row.days}d`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ── Retención ───────────────────────────────────────────── */}
        {stats.activeStudents > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-0.5">
                <CardTitle className="text-base font-medium">Retención</CardTitle>
                <p className="text-xs text-ink-muted">Alumnos activos por antigüedad</p>
              </div>
            </CardHeader>
            <div className="rounded-xl border border-surface-border overflow-hidden bg-surface-elevated/20">
              <div className="grid grid-cols-3 divide-x divide-surface-border">
                {[{ label: '+3 meses', value: retention.m3 }, { label: '+6 meses', value: retention.m6 }, { label: '+12 meses', value: retention.m12 }]
                  .map(({ label, value }) => (
                    <div key={label} className="px-3 py-4 text-center">
                      <p className="text-2xl font-semibold tabular-nums text-ink-primary">{value}</p>
                      <p className="text-[11px] text-ink-muted mt-1">{label}</p>
                    </div>
                  ))}
              </div>
            </div>
          </Card>
        )}

        {/* ── Notificaciones ──────────────────────────────────────── */}
        {notifications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-medium">Notificaciones</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/notifications')}>Ver todas</Button>
            </CardHeader>
            <div className="space-y-1.5">
              {notifications.map((n) => (
                <div key={n.id} className="flex gap-3 px-3 py-2.5 rounded-xl border border-surface-border/70 bg-surface-elevated/25">
                  <div className="w-1.5 h-1.5 rounded-full bg-ink-muted mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-primary">{n.title}</p>
                    <p className="text-xs text-ink-secondary leading-snug">{n.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

      </div>
    </div>
  )
}
