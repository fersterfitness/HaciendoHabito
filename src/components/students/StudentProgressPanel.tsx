import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity, ArrowDownRight, ArrowUpRight, Dumbbell, Footprints, HeartPulse, Minus, Scale, Target } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import {
  ChartAreaGradient,
  ChartBarGradient,
  ChartLegend,
  ChartTooltip,
  chartActiveDot,
  chartAxis,
  chartBarCursor,
  chartBarRadius,
  chartCursor,
  chartGrid,
} from '@/components/charts/chartKit'
import { loadCheckInPoints } from '@/lib/checkIn/loadPoints'
import type { CheckInResponsePoint } from '@/lib/checkIn/habitCharts'
import { WELLBEING_KEYS } from '@/lib/checkIn/questions'
import {
  average,
  buildLiftProgress,
  buildProgressWeeks,
  buildWeightProgress,
  rangeStartYmd,
  recentVsPrevious,
  weekAdherence,
  WELLBEING_META,
  type LiftProgress,
  type ProgressRange,
} from '@/lib/progress/studentProgress'
import type { StudentRmRecord, StudentWeightLog } from '@/types/database'

const BRAND = '#ff5a0a'
const ADHERENCE_GOAL = 80
const STEPS_GOAL = 8000

const RANGES: { id: ProgressRange; label: string }[] = [
  { id: '3m', label: '3 meses' },
  { id: '6m', label: '6 meses' },
  { id: '12m', label: '1 año' },
  { id: 'all', label: 'Todo' },
]

const nf = (n: number, digits = 0) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

function fmtDate(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split('-')
  return `${d}/${m}/${y?.slice(2)}`
}

/** `goodWhenUp: null` = cambio neutro (sin verde/rojo), p. ej. el peso. */
function Delta({ value, suffix = '', goodWhenUp = true, digits = 0 }: { value: number | null; suffix?: string; goodWhenUp?: boolean | null; digits?: number }) {
  if (value == null) return <span className="text-3xs text-ink-muted">sin comparación</span>
  const flat = Math.abs(value) < (digits ? 0.05 : 0.5)
  const good = flat || goodWhenUp == null ? null : value > 0 === goodWhenUp
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-3xs font-semibold tabular-nums',
        good == null && 'bg-surface-elevated text-ink-muted',
        good === true && 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
        good === false && 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {value > 0 ? '+' : value < 0 ? '−' : ''}
      {nf(Math.abs(value), digits)}
      {suffix}
    </span>
  )
}

function Kpi({ icon, label, value, hint, delta }: { icon: ReactNode; label: string; value: ReactNode; hint: ReactNode; delta?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-surface-border/80 bg-surface-card p-3.5 shadow-xs">
      <div className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wider text-ink-muted">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary [&>svg]:h-3.5 [&>svg]:w-3.5">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <p className="text-2xl font-semibold tracking-tight text-ink-primary tabular-nums">{value}</p>
      <div className="flex flex-wrap items-center gap-1.5 text-3xs text-ink-muted">
        {delta}
        <span className="min-w-0">{hint}</span>
      </div>
    </div>
  )
}

function Card({ icon, title, subtitle, children, aside }: { icon: ReactNode; title: string; subtitle?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-surface-border/90 bg-surface-card p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-primary [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-brand-primary">
            {icon}
            {title}
          </h3>
          {subtitle ? <p className="mt-0.5 text-2xs leading-snug text-ink-muted">{subtitle}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-surface-border px-3 py-6 text-center text-2xs leading-relaxed text-ink-muted">
      {children}
    </p>
  )
}

function LiftRow({ lift, color }: { lift: LiftProgress; color: string }) {
  const data = lift.history.map((h) => ({ label: fmtDate(h.date), kg: h.kg }))
  return (
    <li className="flex items-center gap-3 border-t border-surface-border/60 py-2.5 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-ink-primary">{lift.name}</p>
        <p className="text-3xs text-ink-muted">
          {lift.history.length > 1
            ? `${nf(lift.first.kg, lift.first.kg % 1 ? 1 : 0)} kg (${fmtDate(lift.first.date)}) → ${fmtDate(lift.last.date)}`
            : `Un solo test · ${fmtDate(lift.last.date)}`}
        </p>
      </div>
      <div className="hidden h-9 w-24 sm:block">
        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
              <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
              <Line type="monotone" dataKey="kg" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : null}
      </div>
      <div className="w-24 shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-ink-primary">{nf(lift.last.kg, lift.last.kg % 1 ? 1 : 0)} kg</p>
        {lift.history.length > 1 ? <Delta value={lift.deltaPct} suffix="%" digits={1} /> : null}
      </div>
    </li>
  )
}

const LIFT_COLORS = ['#3b82f6', BRAND, '#10b981', '#a855f7', '#f59e0b', '#0ea5e9']

/**
 * Progreso del alumno para mostrar en videollamada: adherencia, fuerza, bienestar, NEAT y peso,
 * con datos reales de check-ins, tests de RM, hábitos y registros de peso.
 */
export function StudentProgressPanel({
  studentId,
  studentName,
  rmRecords,
}: {
  studentId: string
  studentName: string
  rmRecords: StudentRmRecord[]
}) {
  const [range, setRange] = useState<ProgressRange>('6m')
  const [loading, setLoading] = useState(true)
  const [points, setPoints] = useState<CheckInResponsePoint[]>([])
  const [habitDates, setHabitDates] = useState<string[]>([])
  const [weights, setWeights] = useState<StudentWeightLog[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [pts, habits, weightRes] = await Promise.all([
        loadCheckInPoints(studentId),
        supabase.from('habit_logs').select('log_date').eq('student_id', studentId),
        supabase.from('student_weight_logs').select('*').eq('student_id', studentId).order('logged_at'),
      ])
      if (cancelled) return
      setPoints(pts)
      setHabitDates(((habits.data ?? []) as { log_date: string }[]).map((h) => h.log_date))
      setWeights((weightRes.data ?? []) as StudentWeightLog[])
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [studentId])

  const since = rangeStartYmd(range)
  const inRange = (ymd: string) => !since || ymd.slice(0, 10) >= since

  const weeks = useMemo(
    () => buildProgressWeeks(points, habitDates).filter((w) => inRange(w.weekKey)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, habitDates, since],
  )
  const lifts = useMemo(
    () => buildLiftProgress(rmRecords.filter((r) => inRange(r.tested_at))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rmRecords, since],
  )
  const weightLogs = useMemo(
    () => weights.filter((w) => inRange(w.logged_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weights, since],
  )
  const weight = buildWeightProgress(weightLogs)

  const adherenceRows = weeks.map((w) => ({
    label: w.label,
    adherencia: weekAdherence(w),
    entrenamiento: w.training,
    comidas: w.meals,
    habitos: w.habitsPct,
  }))
  const adherence = recentVsPrevious(weeks, weekAdherence)
  const withAdherence = adherenceRows.filter((r) => r.adherencia != null)
  const weeksOnGoal = withAdherence.filter((r) => (r.adherencia ?? 0) >= ADHERENCE_GOAL).length

  const wellRows = weeks.filter((w) => WELLBEING_KEYS.some((k) => w[k] != null))
  const wellIndex = (w: (typeof weeks)[number]) =>
    average([w.sleep, w.energy, w.stress != null ? 6 - w.stress : null])
  const wellbeing = recentVsPrevious(weeks, wellIndex)

  const stepRows = weeks.filter((w) => w.steps != null).map((w) => ({ label: w.label, pasos: w.steps }))
  const steps = recentVsPrevious(weeks, (w) => w.steps)

  const bestLift = [...lifts].filter((l) => l.history.length > 1).sort((a, b) => b.deltaPct - a.deltaPct)[0]
  const firstName = studentName.trim().split(/\s+/)[0] ?? studentName

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-ink-primary">Progreso de {firstName}</h2>
          <p className="text-2xs text-ink-muted">
            Datos reales de sus check-ins, tests de fuerza, hábitos y peso. Ideal para repasar juntos en la videollamada.
          </p>
        </div>
        <SegmentedControl size="sm" items={RANGES} value={range} onChange={(v) => setRange(v as ProgressRange)} />
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi
          icon={<Target />}
          label="Adherencia"
          value={adherence.current != null ? `${nf(adherence.current)}%` : '—'}
          delta={<Delta value={adherence.delta} suffix=" pts" />}
          hint="últimas 4 semanas"
        />
        <Kpi
          icon={<Dumbbell />}
          label="Fuerza"
          value={bestLift ? `+${nf(bestLift.deltaPct, 1)}%` : '—'}
          hint={bestLift ? `${bestLift.name} (+${nf(bestLift.deltaKg, bestLift.deltaKg % 1 ? 1 : 0)} kg)` : 'necesita 2 tests de RM'}
        />
        <Kpi
          icon={<HeartPulse />}
          label="Bienestar"
          value={wellbeing.current != null ? `${nf(wellbeing.current, 1)}/5` : '—'}
          delta={<Delta value={wellbeing.delta} digits={1} />}
          hint="sueño, energía y estrés"
        />
        <Kpi
          icon={<Footprints />}
          label="Pasos / día"
          value={steps.current != null ? `≈ ${nf(Math.round(steps.current / 100) * 100)}` : '—'}
          delta={<Delta value={steps.delta != null ? Math.round(steps.delta / 100) * 100 : null} />}
          hint="estimado del check-in"
        />
      </div>

      <Card
        icon={<Target />}
        title="Adherencia semanal"
        subtitle="Promedio de entrenamientos cumplidos, comidas respetadas y días con hábitos registrados. Es la métrica que más explica el progreso."
        aside={
          withAdherence.length ? (
            <span className="rounded-full bg-surface-elevated px-2.5 py-1 text-3xs font-semibold text-ink-secondary">
              {weeksOnGoal} de {withAdherence.length} semanas ≥ {ADHERENCE_GOAL}%
            </span>
          ) : null
        }
      >
        {withAdherence.length ? (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={adherenceRows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <ChartAreaGradient id="progress-adherence" color={BRAND} opacity={0.28} />
                <CartesianGrid {...chartGrid} />
                <XAxis dataKey="label" {...chartAxis} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} {...chartAxis} width={36} tickFormatter={(v: number) => `${v}%`} />
                <ReferenceLine y={ADHERENCE_GOAL} stroke="#10b981" strokeDasharray="5 4" strokeOpacity={0.7} />
                <Tooltip cursor={chartCursor} content={<ChartTooltip formatValue={(v) => `${v}%`} />} />
                <Area type="monotone" dataKey="adherencia" name="Adherencia" stroke={BRAND} strokeWidth={2.5} fill="url(#progress-adherence)" activeDot={chartActiveDot(BRAND)} connectNulls />
                <Line type="monotone" dataKey="entrenamiento" name="Entrenamiento" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
                <Line type="monotone" dataKey="comidas" name="Comidas" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
                <Line type="monotone" dataKey="habitos" name="Hábitos" stroke="#a855f7" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
            <ChartLegend
              className="mt-2"
              items={[
                { label: 'Adherencia', color: BRAND },
                { label: 'Entrenamiento', color: '#3b82f6' },
                { label: 'Comidas', color: '#10b981' },
                { label: 'Hábitos', color: '#a855f7' },
                { label: `Objetivo ${ADHERENCE_GOAL}%`, color: '#10b981' },
              ]}
            />
          </>
        ) : (
          <Empty>Todavía no hay check-ins ni hábitos registrados en este período.</Empty>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          icon={<Dumbbell />}
          title="Rendimiento · levantamientos principales"
          subtitle="Evolución del 1RM de cada ejercicio testeado, del primer al último test del período."
        >
          {lifts.length ? (
            <ul>
              {lifts.slice(0, 6).map((l, i) => (
                <LiftRow key={l.key} lift={l} color={LIFT_COLORS[i % LIFT_COLORS.length]!} />
              ))}
            </ul>
          ) : (
            <Empty>Sin tests de RM en este período. Cargalos en Seguimiento › Fuerza.</Empty>
          )}
        </Card>

        <Card
          icon={<HeartPulse />}
          title="Salud y bienestar"
          subtitle="Escalas 1–5 del check-in semanal. Explican muchas mesetas: dormir mal o mucho estrés frenan el progreso."
        >
          {wellRows.length ? (
            <>
              <div className="mb-3 grid grid-cols-4 gap-1.5">
                {WELLBEING_KEYS.map((k) => {
                  const meta = WELLBEING_META[k]
                  const r = recentVsPrevious(weeks, (w) => w[k])
                  return (
                    <div key={k} className="rounded-xl bg-surface-elevated/60 px-2 py-2 text-center">
                      <p className="text-3xs font-semibold uppercase tracking-wide" style={{ color: meta.color }}>
                        {meta.label}
                      </p>
                      <p className="text-base font-semibold tabular-nums text-ink-primary">
                        {r.current != null ? nf(r.current, 1) : '—'}
                      </p>
                      <Delta value={r.delta} digits={1} goodWhenUp={meta.higherIsBetter} />
                    </div>
                  )
                })}
              </div>
              <ResponsiveContainer width="100%" height={170}>
                <LineChart data={wellRows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid {...chartGrid} />
                  <XAxis dataKey="label" {...chartAxis} interval="preserveStartEnd" />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...chartAxis} width={22} />
                  <Tooltip cursor={chartCursor} content={<ChartTooltip />} />
                  {WELLBEING_KEYS.map((k) => (
                    <Line
                      key={k}
                      type="monotone"
                      dataKey={k}
                      name={WELLBEING_META[k].label}
                      stroke={WELLBEING_META[k].color}
                      strokeWidth={2}
                      dot={{ r: 2.5, fill: WELLBEING_META[k].color }}
                      activeDot={chartActiveDot(WELLBEING_META[k].color)}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : (
            <Empty>
              Sin respuestas todavía. Las preguntas de sueño, energía, estrés y hambre se sumaron al check-in semanal: van a
              aparecer acá desde el próximo envío.
            </Empty>
          )}
        </Card>

        <Card
          icon={<Footprints />}
          title="NEAT · pasos diarios"
          subtitle="El gasto invisible: caminar y moverse en el día. Es lo más fácil de subir sin sumar fatiga."
        >
          {stepRows.length ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={stepRows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <ChartBarGradient id="progress-steps" color="#0ea5e9" />
                <CartesianGrid {...chartGrid} />
                <XAxis dataKey="label" {...chartAxis} interval="preserveStartEnd" />
                <YAxis {...chartAxis} width={40} tickFormatter={(v: number) => (v ? `${nf(v / 1000)}k` : '')} />
                <ReferenceLine y={STEPS_GOAL} stroke="#10b981" strokeDasharray="5 4" strokeOpacity={0.7} label={{ value: `${nf(STEPS_GOAL)}`, position: 'insideTopRight', fontSize: 10, fill: '#10b981' }} />
                <Tooltip cursor={chartBarCursor} content={<ChartTooltip formatValue={(v) => `≈ ${nf(v)} pasos`} />} />
                <Bar dataKey="pasos" name="Pasos/día" fill="url(#progress-steps)" radius={chartBarRadius} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty>Sin datos de pasos todavía. La pregunta se sumó al check-in semanal.</Empty>
          )}
        </Card>

        <Card
          icon={<Scale />}
          title="Peso corporal"
          subtitle="Registros de Seguimiento › Peso."
          aside={weight ? <Delta value={weight.deltaKg} suffix=" kg" digits={1} goodWhenUp={null} /> : null}
        >
          {weightLogs.length > 1 ? (
            <ResponsiveContainer width="100%" height={190}>
              <ComposedChart
                data={weightLogs.map((w) => ({ label: fmtDate(w.logged_at), peso: Number(w.weight_kg) }))}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <ChartAreaGradient id="progress-weight" color={BRAND} opacity={0.25} />
                <CartesianGrid {...chartGrid} />
                <XAxis dataKey="label" {...chartAxis} interval="preserveStartEnd" />
                <YAxis domain={['auto', 'auto']} {...chartAxis} width={36} />
                <Tooltip cursor={chartCursor} content={<ChartTooltip formatValue={(v) => `${nf(v, 1)} kg`} />} />
                <Area type="monotone" dataKey="peso" name="Peso" stroke={BRAND} strokeWidth={2.4} fill="url(#progress-weight)" activeDot={chartActiveDot(BRAND)} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <Empty>Hacen falta al menos 2 registros de peso en el período.</Empty>
          )}
        </Card>
      </div>

      <p className="flex items-center gap-1.5 text-3xs text-ink-muted">
        <Activity className="h-3 w-3" aria-hidden />
        Cada semana usa el último check-in enviado. Las comparaciones son contra las 4 semanas anteriores.
      </p>
    </div>
  )
}
