import { useEffect, useMemo, useState } from 'react'
import {} from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import {
  Users,
  Dumbbell,
  FileText,
  MessageSquare,
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Salad,
  UtensilsCrossed,
  Cake,
  ChevronRight,
  Wallet,
  AlertTriangle,
} from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatCardSkeleton, ChartSkeleton, Skeleton } from '@/components/ui/Skeleton'
import { cn, daysUntil } from '@/lib/utils'
import type { Routine, Notification } from '@/types/database'

interface Stats {
  activeStudents: number
  activeRoutines: number
  /** Planes de alimentación (HH) ligados a alumnos activos. */
  activeMealPlans: number
  /** Turnos futuros del perfil entrenamiento (scheduled / confirmed). */
  pendingAppointments: number
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

function buildChartData({
  incomeRows,
  studentRows,
}: {
  incomeRows: { income_date: string; amount: number }[]
  studentRows: { created_at: string }[]
}) {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const revenue = incomeRows
      .filter((r) => r.income_date.startsWith(key))
      .reduce((s, r) => s + r.amount, 0)
    const users = studentRows.filter((s) => (s.created_at ?? '').slice(0, 7) === key).length
    return { label: MONTH_LABELS[d.getMonth()], revenue, users, month: key }
  }).map((item, i, arr) => {
    const prev = arr[i - 1]?.revenue ?? 0
    const change = prev === 0 ? 0 : Math.round(((item.revenue - prev) / prev) * 100)
    return { ...item, change }
  })
}

// ─── MonthlyAreaChart (Recharts) ──────────────────────────────────────────────
interface ChartPoint {
  label: string
  revenue: number
  users: number
  change: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const { revenue, users, change } = payload[0].payload as ChartPoint
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-ink-primary">{label}</p>
      <div className="mt-1 space-y-0.5">
        <p className="text-ink-primary font-semibold text-sm tabular-nums">
          ${revenue.toLocaleString('es-AR')}
        </p>
        <p className="text-ink-secondary text-[11px] tabular-nums">
          {users} {users === 1 ? 'alta' : 'altas'}
        </p>
      </div>
      {change !== 0 && (
        <p className={`font-medium mt-0.5 ${change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-status-expired'}`}>
          {change > 0 ? '+' : ''}{change}% vs mes ant.
        </p>
      )}
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

const CHART_SECONDARY = 'rgba(169, 121, 255, 0.92)' // brand.secondary
const CHART_TERTIARY = 'rgba(255, 79, 234, 0.90)' // brand.tertiary

function MonthlyDualLineChart({ data }: { data: ChartPoint[] }) {
  return (
    <div className="w-full px-1 pb-2">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 10, right: 14, bottom: 0, left: 0 }}>
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
            yAxisId="left"
            tickFormatter={(v) => v === 0 ? '' : `$${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 9, fill: 'rgba(148,163,184,0.75)' }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v) => (v === 0 ? '' : String(v))}
            tick={{ fontSize: 9, fill: 'rgba(148,163,184,0.55)' }}
            axisLine={false}
            tickLine={false}
            width={24}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'rgba(148,163,184,0.28)', strokeWidth: 1, strokeDasharray: '4 3', strokeOpacity: 0.55 }}
          />

          <Line
            type="monotone"
            yAxisId="left"
            dataKey="revenue"
            stroke={CHART_SECONDARY}
            strokeWidth={1.35}
            dot={false}
            activeDot={{ r: 4, fill: CHART_SECONDARY, stroke: 'rgba(255,255,255,0.55)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            yAxisId="right"
            dataKey="users"
            stroke={CHART_TERTIARY}
            strokeWidth={1.35}
            dot={false}
            activeDot={{ r: 4, fill: CHART_TERTIARY, stroke: 'rgba(255,255,255,0.55)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex mt-1 px-9">
        {data.map((d) => (
          <div key={d.label} className="flex-1 flex justify-center">
            <span className={cn(
              'text-[9px] font-medium',
              d.change > 0 && 'text-emerald-600/90 dark:text-emerald-400/90',
              d.change < 0 && 'text-status-expired',
              d.change === 0 && 'text-ink-muted/50',
            )}>
              {d.change > 0 ? '+' : ''}{d.change !== 0 ? `${d.change}%` : '—'}
            </span>
          </div>
        ))}
      </div>
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
  const canSeeNutritionFoodsGuide =
    role === 'admin' || role === 'trainer' || role === 'nutritionist'
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
  const [growthData, setGrowthData] = useState<ChartPoint[]>([])
  const [retention, setRetention] = useState({ m3: 0, m6: 0, m12: 0 })
  const [birthdays, setBirthdays] = useState<{ id: string; full_name: string; daysUntil: number }[]>([])
  const [todayApps, setTodayApps] = useState<{ id: string; title: string; starts_at: string; student_name: string }[]>([])
  const [loading, setLoading] = useState(true)

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
        href: `/students/${s.id}`,
        days: daysUntil(s.plan_end_date),
      })
    }
    return items.sort((a, b) => a.sortDate.localeCompare(b.sortDate))
  }, [expiring, expiringPlans])

  const showUnifiedExpiringCard = canSeeTraining || expiringPlans.length > 0

  useEffect(() => {
    if (!user) return
    loadDashboard()
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

      const [
        { count: activeStudents },
        { count: activeRoutines },
        { count: activeMealPlans },
        { count: pendingAppointments },
        { count: activeNutritionPlans },
        { count: nutritionDocuments },
        { data: expiringData },
        { data: notifData },
        { data: incomeRows },
        { data: expiringPlansData },
        { data: studentDates },
        { data: todayAppsData },
      ] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id).eq('status', 'activo'),
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
          ? supabase.from('nutrition_plans').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id).in('status', ['activa', 'por_vencer'])
          : Promise.resolve({ count: 0 } as { count: number | null }),
        canSeeNutrition
          ? supabase.from('nutrition_patient_documents').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id)
          : Promise.resolve({ count: 0 } as { count: number | null }),
        canSeeTraining
          ? supabase.from('routines').select('*, student:students(full_name)').eq('owner_id', user!.id).in('status', ['activa', 'por_vencer']).lte('end_date', new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]).order('end_date', { ascending: true }).limit(5)
          : Promise.resolve({ data: [] } as { data: unknown[] }),
        supabase.from('notifications').select('*').eq('user_id', user!.id).eq('is_read', false).order('created_at', { ascending: false }).limit(5),
        canSeeTraining
          ? supabase.from('income').select('income_date, amount').eq('owner_id', user!.id).eq('status', 'cobrado').gte('income_date', sinceStr)
          : Promise.resolve({ data: [] } as { data: { income_date: string; amount: number }[] }),
        // Alumnos con plan por vencer (próximos 14 días) o ya vencido
        supabase.from('students')
          .select('id, full_name, plan_end_date, status')
          .eq('owner_id', user!.id)
          .eq('status', 'activo')
          .not('plan_end_date', 'is', null)
          .lte('plan_end_date', new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0])
          .order('plan_end_date', { ascending: true })
          .limit(5),
        supabase.from('students').select('id, full_name, birth_date, created_at').eq('owner_id', user!.id).eq('status', 'activo'),
        supabase
          .from('appointments')
          .select('id, title, starts_at, student:students(full_name)')
          .eq('owner_id', user!.id)
          .in('status', ['scheduled', 'confirmed'])
          .gte('starts_at', `${new Date().toISOString().split('T')[0]}T00:00:00`)
          .lte('starts_at', `${new Date().toISOString().split('T')[0]}T23:59:59`)
          .order('starts_at'),
      ])

      const momPromises: Promise<{ count: number | null }>[] = [
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
      ]
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
            .lt('created_at', mb.startThis)
        )
      } else if (canSeeNutrition) {
        momPromises.push(
          supabase
            .from('nutrition_plans')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', user!.id)
            .in('status', ['activa', 'por_vencer'])
            .gte('created_at', mb.startThis)
            .lt('created_at', mb.startNext),
          supabase
            .from('nutrition_plans')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', user!.id)
            .in('status', ['activa', 'por_vencer'])
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
            .lt('uploaded_at', mb.startThis)
        )
      }

      const momRes = await Promise.all(momPromises)
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
      const todayMD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
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
      const allIncomeRows = (incomeRows ?? []) as { income_date: string; amount: number }[]
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
      setGrowthData(
        canSeeTraining
          ? buildChartData({
              incomeRows: (incomeRows ?? []) as { income_date: string; amount: number }[],
              studentRows: ((studentDates ?? []) as { created_at: string }[]),
            })
          : []
      )
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

      <div className="px-4 lg:px-6 py-6 space-y-6">

        {/* ── Strip "Hoy" ──────────────────────────────────────────── */}
        {(todayApps.length > 0 || birthdays.length > 0 || mergedExpiring.some(r => r.days <= 3)) && (
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
                  onClick={() => navigate(`/students/${b.id}`)}
                  className="inline-flex items-center gap-2 rounded-xl border border-status-expiring/25 bg-status-expiring/8 px-3 py-1.5 text-xs font-medium text-ink-primary hover:bg-status-expiring/15 transition-colors"
                >
                  <Cake className="h-3.5 w-3.5 text-status-expiring shrink-0" />
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
            </div>
          </div>
        )}

        {/* ── KPIs ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <StatCard
            title={activePeopleLabel}
            value={stats.activeStudents}
            icon={<Users className="h-5 w-5" />}
            monthOverMonth={{ thisMonth: stats.momStudentsThis, prevMonth: stats.momStudentsPrev, scopeLabel: 'Altas' }}
            onClick={() => navigate('/students')}
          />
          {canSeeTraining ? (
            <>
              <StatCard
                title="Rutinas vigentes"
                value={stats.activeRoutines}
                icon={<Dumbbell className="h-5 w-5" />}
                monthOverMonth={{ thisMonth: stats.momRoutinesThis, prevMonth: stats.momRoutinesPrev, scopeLabel: 'Nuevas rutinas' }}
                onClick={() => navigate('/routines')}
              />
              <StatCard
                title="Planes alimentación"
                value={stats.activeMealPlans}
                icon={<UtensilsCrossed className="h-5 w-5" />}
                monthOverMonth={{ thisMonth: stats.momMealPlansThis, prevMonth: stats.momMealPlansPrev, scopeLabel: 'Planes nuevos' }}
                onClick={() => navigate('/meal-plans')}
              />
              {/* Income KPI */}
              <div
                className="relative overflow-hidden rounded-2xl border border-surface-border bg-surface-card p-4 cursor-pointer hover:border-brand-secondary/40 transition-colors group"
                onClick={() => navigate('/finances')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate('/finances')}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-xs font-medium text-ink-muted leading-snug">Ingresos · este mes</p>
                  <Wallet className="h-4 w-4 shrink-0 text-ink-muted group-hover:text-brand-secondary transition-colors" />
                </div>
                <p className="text-2xl font-bold tabular-nums text-ink-primary">
                  ${stats.currentMonthIncome.toLocaleString('es-AR')}
                </p>
                {incomeDelta !== 0 && (
                  <div className={cn(
                    'mt-1.5 inline-flex items-center gap-1 text-xs font-medium',
                    incomeDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-status-expired',
                  )}>
                    {incomeDelta > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {incomeDelta > 0 ? '+' : ''}{incomeDelta}% vs mes ant.
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <StatCard title="Planes nutrición" value={stats.activeNutritionPlans} icon={<Salad className="h-5 w-5" />}
                monthOverMonth={{ thisMonth: stats.momNutPlansThis, prevMonth: stats.momNutPlansPrev, scopeLabel: 'Planes nuevos' }}
                onClick={() => navigate('/nutrition')} />
              <StatCard title="PDFs antropometría" value={stats.nutritionDocuments} icon={<FileText className="h-5 w-5" />}
                monthOverMonth={{ thisMonth: stats.momNutDocsThis, prevMonth: stats.momNutDocsPrev, scopeLabel: 'PDFs subidos' }}
                onClick={() => navigate('/nutrition')} />
              <StatCard title="Diagnósticos" value={stats.nutritionDocuments} icon={<MessageSquare className="h-5 w-5" />}
                monthOverMonth={{ thisMonth: stats.momNutDocsThis, prevMonth: stats.momNutDocsPrev, scopeLabel: 'PDFs subidos' }}
                onClick={() => navigate('/nutrition-pdfs')} />
            </>
          )}
        </div>


        {/* ── Gráfico ingresos ─────────────────────────────────────── */}
        {canSeeTraining && (
          <Card className="overflow-hidden p-0">
            <CardHeader className="px-5 pt-4 pb-0">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-ink-muted" />
                <CardTitle className="font-medium">Ingresos cobrados · 6 meses</CardTitle>
              </div>
              {growthData.length > 0 && (() => {
                const last = growthData[growthData.length - 1]
                return (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-2">
                    <span className="font-semibold text-ink-primary tabular-nums">${last.revenue.toLocaleString('es-AR')}</span>
                    <span className="text-ink-muted tabular-nums">{last.users} {last.users === 1 ? 'alta' : 'altas'}</span>
                    {last.change !== 0 && (
                      <span className={cn('inline-flex items-center gap-1 font-medium tabular-nums', last.change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-status-expired')}>
                        {last.change > 0 ? <TrendingUp className="h-3.5 w-3.5 opacity-70" /> : <TrendingDown className="h-3.5 w-3.5 opacity-70" />}
                        {last.change > 0 ? '+' : ''}{last.change}% vs mes anterior
                      </span>
                    )}
                  </div>
                )
              })()}
            </CardHeader>
            <div className="pt-3 pb-2">
              {growthData.length > 0 ? <MonthlyDualLineChart data={growthData} /> : (
                <p className="text-center text-sm text-ink-muted py-12 px-4">Sin ingresos cobrados en los últimos 6 meses</p>
              )}
            </div>
          </Card>
        )}

        {/* ── Vencimientos próximos ────────────────────────────────── */}
        {showUnifiedExpiringCard && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-0.5 min-w-0">
                <CardTitle className="font-medium">Próximos vencimientos</CardTitle>
                <p className="text-xs text-ink-muted">Rutinas y planes · próximos 14 días</p>
              </div>
              <div className="flex flex-wrap justify-end gap-1 shrink-0">
                {canSeeTraining && <Button variant="ghost" size="sm" onClick={() => navigate('/routines')}>Rutinas</Button>}
                <Button variant="ghost" size="sm" onClick={() => navigate('/students')}>Alumnos</Button>
              </div>
            </CardHeader>
            {mergedExpiring.length === 0 ? (
              <p className="text-sm text-ink-muted py-6 text-center">Nada próximo en esta ventana</p>
            ) : (
              <div className="space-y-1.5">
                {mergedExpiring.map((row) => (
                  <button
                    key={`${row.kind}-${row.id}`}
                    type="button"
                    onClick={() => navigate(row.href)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-surface-border/80 bg-surface-elevated/35 hover:bg-surface-elevated transition-colors text-left"
                  >
                    <div className="min-w-0 flex gap-3 items-start">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted w-[4.75rem] shrink-0 pt-0.5">
                        {row.kind === 'routine' ? 'Rutina' : 'Plan'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-primary truncate">{row.title}</p>
                        <p className="text-xs text-ink-muted truncate">{row.subtitle}</p>
                      </div>
                    </div>
                    <span className={cn(
                      'text-xs font-semibold tabular-nums px-2 py-0.5 rounded-md border border-surface-border shrink-0',
                      row.days < 0 && 'border-status-expired/35 text-status-expired',
                      row.days >= 0 && row.days <= 3 && 'border-status-expiring/35 text-status-expiring',
                    )}>
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
