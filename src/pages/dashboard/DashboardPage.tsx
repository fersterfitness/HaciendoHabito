import { useEffect, useState, useId } from 'react'
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
} from 'lucide-react'
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

// ─── MonthlyAreaChart (setto-toolkit style) ────────────────────────────────
interface ChartPoint { label: string; value: number; change: number }

function MonthlyAreaChart({ data }: { data: ChartPoint[] }) {
  const rawId = useId()
  const gid = rawId.replace(/:/g, '')
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const values = data.map((d) => d.value)
  const maxVal = Math.max(...values, 1)
  const W = 1000, H = 220, padTop = 24, padBot = 0
  const chartH = H - padTop - padBot

  const slotW = W / data.length
  const pts = data.map((d, i) => ({
    label: d.label,
    x: slotW * 0.5 + i * slotW,
    y: padTop + chartH - (d.value / maxVal) * chartH,
    pct: (slotW * 0.5 + i * slotW) / W,
    val: d.value,
    change: d.change,
  }))

  function smoothPath(points: { x: number; y: number }[]) {
    if (points.length < 2) return ''
    let d = `M ${points[0].x} ${points[0].y}`
    for (let i = 1; i < points.length; i++) {
      const cp = (points[i - 1].x + points[i].x) / 2
      d += ` C ${cp} ${points[i - 1].y} ${cp} ${points[i].y} ${points[i].x} ${points[i].y}`
    }
    return d
  }

  const line = smoothPath(pts)
  const first = pts[0], last = pts[pts.length - 1]
  const lineFull = `M 0 ${first.y} L ${first.x} ${first.y} ${line.slice(line.indexOf(' '))} L ${W} ${last.y}`
  const area = `${lineFull} L ${W} ${H} L 0 ${H} Z`

  const active   = hovered ?? selected
  const activePt = pts.find((p) => p.label === active)

  // Maps a y-coordinate in SVG viewBox space to a CSS top % of the container div
  const svgYtoCss = (svgY: number) => `${(svgY / H) * 100}%`

  return (
    <div className="flex w-full flex-col">
      <div className="relative w-full" style={{ height: 160 }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id={`stroke-${gid}`} x1="0" y1="0" x2="1" y2="0"
              gradientUnits="objectBoundingBox">
              <stop offset="0%"   stopColor="#FF8C00" />
              <stop offset="50%"  stopColor="#FF5500" />
              <stop offset="100%" stopColor="#FF8C00" stopOpacity="0.7" />
            </linearGradient>
            <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#FF8C00" stopOpacity={0.35} />
              <stop offset="70%"  stopColor="#FF8C00" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#FF8C00" stopOpacity={0}    />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.33, 0.66].map((t) => {
            const y = padTop + chartH * (1 - t)
            return (
              <line key={t} x1={0} y1={y} x2={W} y2={y}
                stroke="currentColor" strokeOpacity={0.06}
                strokeWidth={1} strokeDasharray="8 6"
                vectorEffect="non-scaling-stroke" className="text-ink-muted" />
            )
          })}

          {/* Active band */}
          {activePt && (
            <rect x={activePt.x - slotW / 2} y={0}
              width={slotW} height={H}
              fill="white" fillOpacity={0.03} />
          )}

          <path d={area} fill={`url(#area-${gid})`} />
          <path d={lineFull} fill="none" stroke={`url(#stroke-${gid})`}
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            vectorEffect="non-scaling-stroke" />

          {/* Click zones */}
          {data.map((d, i) => (
            <rect key={d.label} x={i * slotW} y={0} width={slotW} height={H}
              fill="transparent" style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(d.label)}
              onMouseLeave={() => setHovered(null)}
              onClick={(e) => { e.stopPropagation(); setSelected((s) => s === d.label ? null : d.label) }} />
          ))}
        </svg>

        {/* Hover/active dot */}
        {activePt && activePt.val > 0 && (
          <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-150"
            style={{ left: `${activePt.pct * 100}%`, top: svgYtoCss(activePt.y) }}>
            <div className="absolute -inset-2 rounded-full border border-brand-primary/30" />
            <div className="h-2.5 w-2.5 rounded-full bg-brand-primary shadow shadow-brand-primary/50" />
          </div>
        )}

        {/* Tooltip */}
        {activePt && activePt.val > 0 && (
          <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
            style={{
              left: `${Math.max(6, Math.min(94, activePt.pct * 100))}%`,
              top: svgYtoCss(activePt.y),
            }}>
            <div className="mb-2 rounded-lg border border-white/10 bg-[#1a1c28] px-3 py-1.5 text-[12px] font-bold text-white shadow-xl whitespace-nowrap">
              {activePt.val}
              <span className={`ml-2 text-[10px] font-semibold ${activePt.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {activePt.change >= 0 ? '+' : ''}{activePt.change}%
              </span>
              <span className="ml-1.5 text-[9px] font-normal text-white/40">{activePt.label}</span>
            </div>
          </div>
        )}
      </div>

      {/* Month labels */}
      <div className="flex shrink-0 pb-2 pt-1">
        {data.map((d) => {
          const isAct = d.label === active
          return (
            <button key={d.label} type="button"
              onClick={() => setSelected((s) => s === d.label ? null : d.label)}
              className={[
                'flex-1 flex flex-col items-center gap-0.5 py-1 transition-all duration-150',
                isAct ? 'text-brand-primary' : 'text-ink-muted/60 hover:text-ink-muted',
              ].join(' ')}>
              <span className="text-[9px] font-bold uppercase tracking-widest">{d.label}</span>
              <span className={`text-[9px] font-semibold ${d.change >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                {d.change >= 0 ? '+' : ''}{d.change}%
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({ activeStudents: 0, activeRoutines: 0, pendingPdfs: 0, openQuestions: 0 })
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
        { data: expiringData },
        { data: notifData },
        { data: incomeRows },
      ] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id).eq('status', 'activo'),
        supabase.from('routines').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id).in('status', ['activa', 'por_vencer']),
        supabase.from('routine_pdfs').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id),
        supabase.from('routine_questions').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id).neq('status', 'cerrada'),
        supabase.from('routines').select('*, student:students(full_name)').eq('owner_id', user!.id).in('status', ['activa', 'por_vencer']).lte('end_date', new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]).order('end_date', { ascending: true }).limit(5),
        supabase.from('notifications').select('*').eq('user_id', user!.id).eq('is_read', false).order('created_at', { ascending: false }).limit(5),
        supabase.from('income').select('income_date, amount').eq('owner_id', user!.id).eq('status', 'cobrado').gte('income_date', sinceStr),
      ])

      setStats({
        activeStudents: activeStudents ?? 0,
        activeRoutines: activeRoutines ?? 0,
        pendingPdfs: pendingPdfs ?? 0,
        openQuestions: openQuestions ?? 0,
      })
      setExpiring((expiringData as unknown as ExpiringRoutine[]) ?? [])
      setNotifications(notifData ?? [])
      setGrowthData(buildChartData((incomeRows ?? []) as { income_date: string; amount: number }[]))
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
        </div>

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

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Rutinas por vencer */}
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

          {/* Acciones rápidas */}
          <Card>
            <CardHeader>
              <CardTitle>Acciones rápidas</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Nuevo alumno', icon: Users, href: '/students/new' },
                { label: 'Nueva rutina', icon: Dumbbell, href: '/routines/new' },
                { label: 'Ver PDFs', icon: FileText, href: '/routine-pdfs' },
                { label: 'Ver dudas', icon: MessageSquare, href: '/feedback' },
              ].map(({ label, icon: Icon, href }) => (
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
