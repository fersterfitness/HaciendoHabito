import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Dumbbell,
  FileText,
  MessageSquare,
  AlertTriangle,
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Salad,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { daysUntil } from '@/lib/utils'
import type { Routine, Notification } from '@/types/database'

interface Stats {
  activeStudents: number
  activeRoutines: number
  pendingPdfs: number
  openQuestions: number
  activeNutritionPlans: number
  nutritionDocuments: number
}

interface ExpiringRoutine extends Omit<Routine, 'student'> {
  student: { full_name: string } | null
}

const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function buildChartData(rows: { income_date: string; amount: number }[]) {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const total = rows
      .filter((r) => r.income_date.startsWith(key) )
      .reduce((s, r) => s + r.amount, 0)
    return { label: MONTH_LABELS[d.getMonth()], value: total, month: key }
  }).map((item, i, arr) => {
    const prev = arr[i - 1]?.value ?? 0
    const change = prev === 0 ? 0 : Math.round(((item.value - prev) / prev) * 100)
    return { ...item, change }
  })
}

// ─── MonthlyAreaChart (Recharts) ──────────────────────────────────────────────
interface ChartPoint { label: string; value: number; change: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const { value, change } = payload[0].payload as ChartPoint
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="font-bold text-ink-primary">{label}</p>
      <p className="text-brand-primary font-semibold text-sm mt-0.5">
        ${value.toLocaleString('es-AR')}
      </p>
      {change !== 0 && (
        <p className={`font-semibold mt-0.5 ${change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
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
    <text x={x} y={y + 12} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.35)" fontWeight={600}>
      {d}
    </text>
  )
}

function MonthlyAreaChart({ data }: { data: ChartPoint[] }) {
  return (
    <div className="w-full px-1 pb-2">
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#FF8C00" stopOpacity={0.35} />
              <stop offset="75%"  stopColor="#FF8C00" stopOpacity={0.05} />
              <stop offset="100%" stopColor="#FF8C00" stopOpacity={0}    />
            </linearGradient>
          </defs>

          <CartesianGrid
            vertical={false}
            stroke="rgba(255,255,255,0.05)"
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
            tickFormatter={(v) => v === 0 ? '' : `$${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.25)' }}
            axisLine={false}
            tickLine={false}
            width={36}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#FF8C00', strokeWidth: 1, strokeDasharray: '4 3', strokeOpacity: 0.5 }} />

          <Area
            type="monotone"
            dataKey="value"
            stroke="#FF8C00"
            strokeWidth={2.5}
            fill="url(#incomeGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#FF8C00', stroke: '#FF8C00', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* % change row */}
      <div className="flex mt-1 px-9">
        {data.map((d) => (
          <div key={d.label} className="flex-1 flex justify-center">
            <span className={`text-[9px] font-semibold ${d.change > 0 ? 'text-emerald-500' : d.change < 0 ? 'text-red-400' : 'text-ink-muted/40'}`}>
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
  const navigate = useNavigate()
  const role = profile?.role
  const canSeeTraining = role === 'admin' || role === 'trainer' || !role
  const canSeeNutrition = role === 'admin' || role === 'nutritionist'
  const [stats, setStats] = useState<Stats>({
    activeStudents: 0,
    activeRoutines: 0,
    pendingPdfs: 0,
    openQuestions: 0,
    activeNutritionPlans: 0,
    nutritionDocuments: 0,
  })
  const [expiring, setExpiring] = useState<ExpiringRoutine[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [growthData, setGrowthData] = useState<{ label: string; value: number; change: number }[]>([])
  const [loading, setLoading] = useState(true)

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

      const [
        { count: activeStudents },
        { count: activeRoutines },
        { count: pendingPdfs },
        { count: openQuestions },
        { count: activeNutritionPlans },
        { count: nutritionDocuments },
        { data: expiringData },
        { data: notifData },
        { data: incomeRows },
      ] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id).eq('status', 'activo'),
        canSeeTraining
          ? supabase.from('routines').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id).in('status', ['activa', 'por_vencer'])
          : Promise.resolve({ count: 0 } as { count: number | null }),
        canSeeTraining
          ? supabase.from('routine_pdfs').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id)
          : Promise.resolve({ count: 0 } as { count: number | null }),
        canSeeTraining
          ? supabase.from('routine_questions').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id).neq('status', 'cerrada')
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
      ])

      setStats({
        activeStudents: activeStudents ?? 0,
        activeRoutines: activeRoutines ?? 0,
        pendingPdfs: pendingPdfs ?? 0,
        openQuestions: openQuestions ?? 0,
        activeNutritionPlans: activeNutritionPlans ?? 0,
        nutritionDocuments: nutritionDocuments ?? 0,
      })
      setExpiring((expiringData as unknown as ExpiringRoutine[]) ?? [])
      setNotifications(notifData ?? [])
      setGrowthData(canSeeTraining ? buildChartData((incomeRows ?? []) as { income_date: string; amount: number }[]) : [])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div>
        <Header title="Inicio" />
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="Inicio" />

      <div className="px-4 lg:px-6 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <StatCard
            title="Alumnos activos"
            value={stats.activeStudents}
            icon={<Users className="h-5 w-5" />}
            onClick={() => navigate('/students')}
          />
          {canSeeTraining ? (
            <>
              <StatCard
                title="Rutinas vigentes"
                value={stats.activeRoutines}
                icon={<Dumbbell className="h-5 w-5" />}
                onClick={() => navigate('/routines')}
              />
              <StatCard
                title="PDFs generados"
                value={stats.pendingPdfs}
                icon={<FileText className="h-5 w-5" />}
                onClick={() => navigate('/routine-pdfs')}
              />
              <StatCard
                title="Consultas abiertas"
                value={stats.openQuestions}
                icon={<MessageSquare className="h-5 w-5" />}
                iconColor={stats.openQuestions > 0 ? 'text-status-expiring' : 'text-brand-primary'}
                onClick={() => navigate('/feedback')}
              />
            </>
          ) : (
            <>
              <StatCard
                title="Planes nutrición"
                value={stats.activeNutritionPlans}
                icon={<Salad className="h-5 w-5" />}
                onClick={() => navigate('/nutrition')}
              />
              <StatCard
                title="PDFs antropometría"
                value={stats.nutritionDocuments}
                icon={<FileText className="h-5 w-5" />}
                onClick={() => navigate('/nutrition')}
              />
              <StatCard
                title="Diagnósticos"
                value={stats.nutritionDocuments}
                icon={<MessageSquare className="h-5 w-5" />}
                onClick={() => navigate('/nutrition-pdfs')}
              />
            </>
          )}
        </div>

        {canSeeTraining && (
        <Card className="overflow-hidden p-0">
          <CardHeader className="px-5 pt-4 pb-0">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-brand-primary" />
              <CardTitle>Ingresos cobrados</CardTitle>
            </div>
            {growthData.length > 0 && (() => {
              const last = growthData[growthData.length - 1]
              return (
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-semibold text-ink-primary">
                    ${last.value.toLocaleString('es-AR')}
                  </span>
                  {last.change !== 0 && (
                    <span className={`inline-flex items-center gap-1 font-semibold ${last.change > 0 ? 'text-status-generated' : 'text-status-expired'}`}>
                      {last.change > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      {last.change > 0 ? '+' : ''}{last.change}% vs mes anterior
                    </span>
                  )}
                </div>
              )
            })()}
          </CardHeader>
          <div className="pt-3 pb-0">
            {growthData.length > 0
              ? <MonthlyAreaChart data={growthData} />
              : <p className="text-center text-sm text-ink-muted py-12">Sin ingresos cobrados en los últimos 6 meses</p>
            }
          </div>
        </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Rutinas por vencer */}
          {canSeeTraining && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-status-expiring" />
                <CardTitle>Rutinas por vencer</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/routines')}
              >
                Ver todas
              </Button>
            </CardHeader>
            {expiring.length === 0 ? (
              <p className="text-sm text-ink-muted py-4 text-center">
                No hay rutinas próximas a vencer 🎉
              </p>
            ) : (
              <div className="space-y-2">
                {expiring.map((r) => {
                  const days = daysUntil(r.end_date)
                  return (
                    <button
                      key={r.id}
                      onClick={() => navigate(`/routines/${r.id}`)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-elevated hover:bg-surface-border/50 transition-colors text-left group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-primary truncate">
                          {r.student?.full_name ?? '—'}
                        </p>
                        <p className="text-xs text-ink-secondary truncate">{r.name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                            days <= 3
                              ? 'bg-status-expired/10 text-status-expired'
                              : days <= 7
                              ? 'bg-status-expiring/10 text-status-expiring'
                              : 'bg-brand-primary/10 text-brand-primary'
                          }`}
                        >
                          {days <= 0 ? 'Hoy' : `${days}d`}
                        </span>
                        <Calendar className="h-3.5 w-3.5 text-ink-muted" />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>
          )}

          {/* Acciones rápidas */}
          <Card>
            <CardHeader>
              <CardTitle>Acciones rápidas</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Nuevo alumno', icon: Users, href: '/students/new', show: true },
                { label: 'Nueva rutina', icon: Dumbbell, href: '/routines/new', show: canSeeTraining },
                { label: 'Nutrición', icon: Salad, href: '/nutrition', show: canSeeNutrition },
                { label: 'Diagnóstico PDF', icon: FileText, href: '/nutrition-pdfs', show: canSeeNutrition },
                { label: 'Ver PDFs', icon: FileText, href: '/routine-pdfs', show: canSeeTraining },
                { label: 'Ver dudas', icon: MessageSquare, href: '/feedback', show: canSeeTraining },
              ].filter((item) => item.show).map(({ label, icon: Icon, href }) => (
                <button
                  key={href}
                  onClick={() => navigate(href)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-elevated hover:bg-surface-border/50 hover:border-brand-primary/20 border border-transparent transition-all text-center group"
                >
                  <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center group-hover:bg-brand-primary/20 transition-colors">
                    <Icon className="h-4 w-4 text-brand-primary" />
                  </div>
                  <span className="text-xs font-medium text-ink-secondary group-hover:text-ink-primary transition-colors">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Notificaciones recientes */}
        {notifications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Notificaciones recientes</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/notifications')}>
                Ver todas
              </Button>
            </CardHeader>
            <div className="space-y-2">
              {notifications.map((n) => (
                <div key={n.id} className="flex gap-3 p-3 rounded-xl bg-surface-elevated">
                  <div className="w-2 h-2 rounded-full bg-brand-primary mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-primary">{n.title}</p>
                    <p className="text-xs text-ink-secondary truncate">{n.body}</p>
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
