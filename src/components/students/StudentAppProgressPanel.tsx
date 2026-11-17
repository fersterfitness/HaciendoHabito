import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, CalendarCheck, Flame, HeartPulse, MessageSquareText, TriangleAlert } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ChartLegend, ChartTooltip, chartAxis, chartBarCursor, chartBarRadius, chartCursor, chartGrid } from '@/components/charts/chartKit'
import { DAILY_SCALES, type ScaleKey } from '@/lib/routine/dailyCheckin'
import {
  loadStudentAppProgress,
  periodStart,
  progressBuckets,
  type ProgressNote,
  type ProgressPeriod,
  type StudentAppProgress,
} from '@/lib/checkIn/studentAppProgress'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

/**
 * Ficha del alumno → Progreso (feedback nov3): lo que responde en su link, en gráficos y con sus
 * aclaraciones, por día, semana, mes o año. Reemplaza al Progreso y los Hábitos de antes.
 */

const PERIODS: { id: ProgressPeriod; label: string; hint: string }[] = [
  { id: 'day', label: 'Día', hint: 'últimos 30 días' },
  { id: 'week', label: 'Semana', hint: 'últimas 16 semanas' },
  { id: 'month', label: 'Mes', hint: 'últimos 12 meses' },
  { id: 'year', label: 'Año', hint: 'todo' },
]

const SCALE_COLOR: Record<ScaleKey, string> = {
  energy: '#f59e0b',
  sleep: '#6366f1',
  stress: '#ef4444',
  soreness: '#a855f7',
  hydration: '#0ea5e9',
  motivation: '#10b981',
  recovery: '#14b8a6',
  nutrition: '#84cc16',
}

const NOTE_LABEL: Record<ProgressNote['kind'], string> = {
  pain: 'Dolor',
  missed: 'No entrenó',
  nutrition: 'Alimentación',
  checkin: 'Chequeo',
  exercise: 'Ejercicio',
  notice: 'Aviso',
}

const nf = (n: number | null) => (n == null ? '—' : n.toLocaleString('es-AR', { maximumFractionDigits: 1 }))

function Card({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-surface-border/90 bg-surface-card p-4 shadow-card">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-primary [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-brand-primary">
        {icon}
        {title}
      </h3>
      {subtitle ? <p className="mb-3 mt-0.5 text-2xs leading-snug text-ink-muted">{subtitle}</p> : <div className="mb-3" />}
      {children}
    </section>
  )
}

function Kpi({ label, value, hint, tone }: { label: string; value: ReactNode; hint: string; tone?: 'ok' | 'bad' }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-surface-border/80 bg-surface-card p-3.5 shadow-xs">
      <span className="truncate text-2xs font-semibold text-ink-muted">{label}</span>
      <p
        className={cn(
          'text-2xl font-semibold tabular-nums tracking-tight',
          tone === 'ok' ? 'text-status-active' : tone === 'bad' ? 'text-status-expired' : 'text-ink-primary',
        )}
      >
        {value}
      </p>
      <span className="text-3xs text-ink-muted">{hint}</span>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-surface-border px-3 py-6 text-center text-2xs leading-relaxed text-ink-muted">{children}</p>
}

export function StudentAppProgressPanel({ studentId }: { studentId: string }) {
  const ownerId = useAuthStore((s) => s.user?.id)
  const [data, setData] = useState<StudentAppProgress | null>(null)
  const [error, setError] = useState(false)
  const [period, setPeriod] = useState<ProgressPeriod>('week')
  const [shown, setShown] = useState<ScaleKey[]>(['energy', 'sleep', 'stress', 'soreness'])

  useEffect(() => {
    if (!ownerId) return
    let alive = true
    setData(null)
    setError(false)
    loadStudentAppProgress(ownerId, studentId)
      .then((d) => alive && setData(d))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [ownerId, studentId])

  const from = useMemo(() => periodStart(period, new Date()), [period])
  const buckets = useMemo(() => (data ? progressBuckets(data.days, period, from) : []), [data, period, from])
  const notes = useMemo(() => (data ? data.notes.filter((n) => !from || n.date >= from) : []), [data, from])

  if (error) return <Empty>No se pudo cargar el progreso. Probá de nuevo en un rato.</Empty>
  if (!data)
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    )

  const done = buckets.reduce((n, b) => n + b.done, 0)
  const missed = buckets.reduce((n, b) => n + b.missed, 0)
  const pains = buckets.reduce((n, b) => n + b.unusualPain, 0)
  const efforts = buckets.map((b) => b.effort).filter((v): v is number => v != null)
  const effort = efforts.length ? Math.round((efforts.reduce((a, b) => a + b, 0) / efforts.length) * 10) / 10 : null
  const rows = buckets.map((b) => ({ label: b.label, Entrenó: b.done, 'No entrenó': b.missed, Esfuerzo: b.effort, ...Object.fromEntries(DAILY_SCALES.map((s) => [s.short, b.averages[s.key]])) }))
  const withScales = DAILY_SCALES.filter((s) => buckets.some((b) => b.averages[s.key] != null))
  const hint = PERIODS.find((p) => p.id === period)!.hint

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          ariaLabel="Período"
          size="sm"
          value={period}
          onChange={(id) => setPeriod(id as ProgressPeriod)}
          items={PERIODS.map((p) => ({ id: p.id, label: p.label }))}
        />
        <span className="text-3xs text-ink-muted">Por {PERIODS.find((p) => p.id === period)!.label.toLowerCase()} · {hint}</span>
      </div>

      {data.days.length === 0 && data.notes.length === 0 ? (
        <Empty>Todavía no respondió nada en su link. Acá vas a ver su chequeo diario, los días entrenados y lo que te deje escrito.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Días entrenados" value={done} hint={hint} tone={done ? 'ok' : undefined} />
            <Kpi label="Días sin entrenar" value={missed} hint={hint} tone={missed ? 'bad' : undefined} />
            <Kpi label="Esfuerzo promedio" value={effort != null ? `${nf(effort)}/10` : '—'} hint="al cerrar el día" />
            <Kpi label="Dolores no habituales" value={pains} hint="marcados en el chequeo" tone={pains ? 'bad' : undefined} />
          </div>

          <Card icon={<HeartPulse />} title="Cómo llega a entrenar" subtitle="Promedio del chequeo diario (1 a 5). Tocá cada escala para mostrarla u ocultarla.">
            {withScales.length ? (
              <>
                <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Escalas">
                  {withScales.map((s) => {
                    const on = shown.includes(s.key)
                    return (
                      <label
                        key={s.key}
                        className={cn(
                          'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-3xs font-semibold',
                          on ? 'border-transparent bg-surface-elevated text-ink-primary' : 'border-surface-border text-ink-muted',
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          onChange={() => setShown((prev) => (on ? prev.filter((k) => k !== s.key) : [...prev, s.key]))}
                        />
                        <span className="h-2 w-2 rounded-full" style={{ background: on ? SCALE_COLOR[s.key] : 'transparent', border: `1.5px solid ${SCALE_COLOR[s.key]}` }} />
                        {s.short}
                        {s.good === 'low' ? <span className="font-normal text-ink-muted">(mejor bajo)</span> : null}
                      </label>
                    )
                  })}
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid {...chartGrid} />
                    <XAxis dataKey="label" {...chartAxis} interval="preserveStartEnd" />
                    <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...chartAxis} width={28} />
                    <Tooltip cursor={chartCursor} content={<ChartTooltip formatValue={(v) => nf(Number(v))} />} />
                    {withScales
                      .filter((s) => shown.includes(s.key))
                      .map((s) => (
                        <Line key={s.key} type="monotone" dataKey={s.short} stroke={SCALE_COLOR[s.key]} strokeWidth={2} dot={rows.length < 20} connectNulls />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              </>
            ) : (
              <Empty>Sin chequeos en este período.</Empty>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card icon={<CalendarCheck />} title="Asistencia" subtitle="Días que cerró como entrenados o no entrenados.">
              {done + missed ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid {...chartGrid} />
                      <XAxis dataKey="label" {...chartAxis} interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} {...chartAxis} width={28} />
                      <Tooltip cursor={chartBarCursor} content={<ChartTooltip />} />
                      <Bar dataKey="Entrenó" stackId="d" fill="rgb(var(--chart-ok))" radius={chartBarRadius} />
                      <Bar dataKey="No entrenó" stackId="d" fill="rgb(var(--chart-bad))" radius={chartBarRadius} />
                    </BarChart>
                  </ResponsiveContainer>
                  <ChartLegend
                    className="mt-2"
                    items={[
                      { label: 'Entrenó', color: 'rgb(var(--chart-ok))' },
                      { label: 'No entrenó', color: 'rgb(var(--chart-bad))' },
                    ]}
                  />
                </>
              ) : (
                <Empty>Sin días cerrados en este período.</Empty>
              )}
            </Card>

            <Card icon={<Flame />} title="Esfuerzo de la sesión" subtitle="Promedio de lo que marcó al terminar (1 a 10).">
              {efforts.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid {...chartGrid} />
                    <XAxis dataKey="label" {...chartAxis} interval="preserveStartEnd" />
                    <YAxis domain={[0, 10]} {...chartAxis} width={28} />
                    <Tooltip cursor={chartBarCursor} content={<ChartTooltip formatValue={(v) => `${nf(Number(v))}/10`} />} />
                    <Bar dataKey="Esfuerzo" fill="rgb(var(--chart-1))" radius={chartBarRadius} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty>Sin esfuerzo cargado en este período.</Empty>
              )}
            </Card>
          </div>

          <Card icon={<MessageSquareText />} title="Aclaraciones" subtitle="Lo que te dejó escrito o marcó: dolores, días sin entrenar, alimentación, notas por ejercicio y avisos.">
            {notes.length ? (
              <ul className="divide-y divide-surface-border/60">
                {notes.slice(0, 120).map((n, i) => (
                  <li key={i} className="flex gap-3 py-2.5">
                    <span className="w-14 shrink-0 pt-0.5 text-3xs font-semibold uppercase text-ink-muted tabular-nums">
                      {format(new Date(`${n.date}T12:00:00`), 'd MMM', { locale: es })}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-primary">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-3xs font-semibold',
                            n.kind === 'pain' || n.kind === 'missed' ? 'bg-status-expired/10 text-status-expired' : 'bg-surface-elevated text-ink-secondary',
                          )}
                        >
                          {n.kind === 'pain' ? <TriangleAlert className="h-3 w-3" aria-hidden /> : n.kind === 'exercise' ? <Activity className="h-3 w-3" aria-hidden /> : null}
                          {NOTE_LABEL[n.kind]}
                        </span>
                        {n.kind === 'exercise' || n.kind === 'notice' ? <span className="truncate">{n.title}</span> : null}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-xs leading-snug text-ink-secondary">{n.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Sin aclaraciones en este período.</Empty>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
