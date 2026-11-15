import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Activity, ChevronDown, Dumbbell, Flame, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AvatarV2, TONE_TINT, type Tone } from '@/components/v2/ui'
import {
  buildTrainingMonitor,
  loadMonitorLogs,
  loadMonitorRoutines,
  monitorSummary,
  weekActivity,
  type MonitorRow,
  type MonitorState,
  type MonitorSummary,
  type WeekActivityDay,
} from '@/lib/routine/trainingMonitor'
import { cn, formatNumber } from '@/lib/utils'

/** Cada cuánto se vuelve a preguntar qué anotaron los alumnos. */
const REFRESH_MS = 30_000

const LABEL: Record<MonitorState, string> = {
  live: 'Entrenando ahora',
  deviated: 'Con desvíos',
  missed: 'No entrenó',
  done: 'Entrenó',
  due: 'Le toca hoy',
  idle: 'Sin registro',
}
/** Orden fijo de la barra y la leyenda (no cambia según cuántos haya de cada uno). */
const ORDER: MonitorState[] = ['live', 'done', 'deviated', 'missed', 'due', 'idle']
/**
 * Color de cada estado (barra, punto de la leyenda y avance). Son estados, no series: siempre van con
 * su nombre y su cantidad escritos al lado, nunca solo con el color.
 */
const FILL: Record<MonitorState, string> = {
  live: 'bg-status-ok',
  done: 'bg-ink-primary',
  deviated: 'bg-pastel-butter-accent',
  missed: 'bg-status-expired',
  due: 'bg-pastel-lavender-accent',
  idle: 'bg-surface-inputBorder',
}
const STROKE: Record<MonitorState, string> = {
  live: 'text-status-ok',
  done: 'text-ink-primary',
  deviated: 'text-pastel-butter-accent',
  missed: 'text-status-expired',
  due: 'text-pastel-lavender-accent',
  idle: 'text-surface-inputBorder',
}

const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? full

/** «hace 2 min», «hace 1 h 10». */
function agoText(iso: string | null, now: Date): string {
  if (!iso) return ''
  const min = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000))
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  return min % 60 ? `hace ${h} h ${min % 60}` : `hace ${h} h`
}

function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn('relative flex h-2 w-2', className)} aria-hidden>
      <span className="absolute inline-flex h-full w-full rounded-full bg-status-ok opacity-60 motion-safe:animate-ping" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-status-ok" />
    </span>
  )
}

/** Anillo de avance (0–100). El trazo usa `currentColor`; el número va adentro en tinta normal. */
function Ring({ pct, size = 56, stroke = 6, className, children }: { pct: number; size?: number; stroke?: number; className?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const value = Math.max(0, Math.min(100, pct))
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.16} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">{children}</span>
    </span>
  )
}

/** Casillero de una métrica del día, en el color de su tono. */
function Kpi({ tone, icon: Icon, label, value, unit, hint, aside }: { tone: Tone; icon: typeof Users; label: string; value: ReactNode; unit?: string; hint: ReactNode; aside?: ReactNode }) {
  return (
    <div className={cn('hh-pastel flex min-w-0 items-center gap-3 rounded-2xl px-4 py-3.5', TONE_TINT[tone])}>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-medium opacity-80">
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
        </p>
        <p className="mt-1.5 truncate text-3xl font-semibold leading-none tabular-nums tracking-tight">
          {value}
          {unit ? <span className="ml-1 text-sm font-medium opacity-80">{unit}</span> : null}
        </p>
        <p className="mt-1.5 truncate text-xs opacity-80">{hint}</p>
      </div>
      {aside}
    </div>
  )
}

/** Distribución de hoy: una barra partida por estado, con leyenda que también filtra la lista. */
function TodayBar({ counts, total, active, onPick }: { counts: Record<MonitorState, number>; total: number; active: MonitorState | null; onPick: (s: MonitorState | null) => void }) {
  const present = ORDER.filter((s) => counts[s] > 0)
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={present.map((s) => `${LABEL[s]}: ${counts[s]}`).join(', ')}>
        {present.map((s) => (
          <span
            key={s}
            title={`${LABEL[s]}: ${counts[s]} de ${total}`}
            className={cn('h-full min-w-1.5 rounded-sm transition-[flex-grow,opacity] duration-500', FILL[s], active && active !== s && 'opacity-25')}
            style={{ flexGrow: counts[s] }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-1">
        {present.map((s) => (
          <li key={s}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={active === s}
              onClick={() => onPick(active === s ? null : s)}
              className={cn('h-7 gap-1.5 px-2 text-xs font-normal text-ink-secondary', active === s && 'bg-surface-elevated text-ink-primary')}
            >
              <span className={cn('h-2 w-2 shrink-0 rounded-full', FILL[s])} aria-hidden />
              {LABEL[s]}
              <span className="font-semibold tabular-nums text-ink-primary">{counts[s]}</span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Título chico de cada gráfico, con su dato principal a la derecha. */
function ChartHead({ title, value }: { title: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-xs font-medium text-ink-secondary">{title}</p>
      <p className="text-xs text-ink-muted">{value}</p>
    </div>
  )
}

/** Actividad de la semana: una barra por día (alumnos que entrenaron), con el día de hoy resaltado. */
function WeekBars({ days, total }: { days: WeekActivityDay[]; total: number }) {
  const max = Math.max(1, ...days.map((d) => d.trained))
  const sum = days.reduce((n, d) => n + d.trained, 0)
  const past = days.filter((d) => !d.isFuture).length
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-surface-border/70 p-4">
      <ChartHead
        title="Esta semana"
        value={
          <>
            <span className="font-semibold tabular-nums text-ink-primary">{sum}</span> {sum === 1 ? 'entrenamiento' : 'entrenamientos'} · promedio{' '}
            <span className="font-semibold tabular-nums text-ink-primary">{formatNumber(Math.round((sum / Math.max(1, past)) * 10) / 10)}</span> por día
          </>
        }
      />
      <ol className="flex h-32 items-end gap-2" aria-label="Alumnos que entrenaron cada día de esta semana">
        {days.map((d) => {
          const h = d.trained > 0 ? Math.max(10, Math.round((d.trained / max) * 100)) : 0
          const tip = d.isFuture
            ? `${d.name}: todavía no llegó`
            : `${d.name}: ${d.trained} de ${total} ${d.trained === 1 ? 'entrenó' : 'entrenaron'}${d.missed ? ` · ${d.missed} ${d.missed === 1 ? 'avisó' : 'avisaron'} que no` : ''}`
          return (
            <li key={d.ymd} title={tip} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className={cn('text-2xs tabular-nums', d.isToday ? 'font-semibold text-ink-primary' : 'text-ink-muted', d.isFuture || d.trained === 0 ? 'opacity-0' : '')} aria-hidden>
                {d.trained}
              </span>
              <span className="flex w-full flex-1 items-end rounded-lg bg-surface-elevated/60">
                <span className={cn('block w-full rounded-lg transition-[height] duration-700', d.isToday ? 'bg-status-ok' : 'bg-ink-primary/45')} style={{ height: `${h}%` }} />
              </span>
              <span className={cn('text-2xs', d.isToday ? 'font-semibold text-ink-primary' : d.isFuture ? 'text-ink-muted/60' : 'text-ink-muted')}>
                {d.short}
                <span className="sr-only">: {tip}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Ritmo de hoy: series anotadas por hora, para ver en qué momento del día entrenan. */
function HourBars({ summary, nowHour }: { summary: MonitorSummary; nowHour: number }) {
  // De 6 a 23, o más ancho si hubo actividad fuera de ese rango.
  const active = summary.hourly.map((n, h) => (n > 0 ? h : -1)).filter((h) => h >= 0)
  const from = Math.min(6, ...active)
  const to = Math.max(23, ...active)
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  const max = Math.max(1, ...summary.hourly)
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-surface-border/70 p-4">
      <ChartHead
        title="Ritmo de hoy"
        value={
          summary.peakHour != null ? (
            <>
              pico a las <span className="font-semibold tabular-nums text-ink-primary">{summary.peakHour} h</span>
            </>
          ) : (
            'todavía sin series'
          )
        }
      />
      <ol className="flex h-32 items-end gap-1" aria-label="Series anotadas por hora de hoy">
        {hours.map((h) => {
          const n = summary.hourly[h] ?? 0
          const height = n > 0 ? Math.max(8, Math.round((n / max) * 100)) : 0
          const tip = `${h} h: ${n} ${n === 1 ? 'serie' : 'series'}`
          return (
            <li key={h} title={tip} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="flex w-full flex-1 items-end rounded-md bg-surface-elevated/60">
                <span className={cn('block w-full rounded-md transition-[height] duration-700', h === nowHour ? 'bg-status-ok' : 'bg-ink-primary/45')} style={{ height: `${height}%` }} />
              </span>
              <span className={cn('text-2xs tabular-nums', h === nowHour ? 'font-semibold text-ink-primary' : 'text-ink-muted', h % 3 === 0 || h === nowHour ? '' : 'opacity-0')} aria-hidden={h % 3 !== 0 && h !== nowHour}>
                {h}
              </span>
              <span className="sr-only">{tip}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Quien está entrenando en este momento: tarjeta con su avance en vivo. */
function LiveCard({ row, now, onOpen }: { row: MonitorRow; now: Date; onOpen: () => void }) {
  return (
    <li className="min-w-0">
      <Button
        type="button"
        variant="ghost"
        onClick={onOpen}
        className="h-auto w-full whitespace-normal rounded-2xl border border-status-ok/50 bg-status-ok/10 p-3.5 text-left font-normal hover:bg-status-ok/15 [&>span]:w-full [&>span]:min-w-0"
      >
        <span className="flex w-full min-w-0 items-center gap-3">
          <Ring pct={row.pct ?? 0} size={60} className="text-status-ok">
            <span className="text-sm font-semibold tabular-nums text-ink-primary">{row.pct ?? 0}%</span>
          </Ring>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <AvatarV2 name={row.studentName} path={row.avatarPath} size="sm" />
              <span className="min-w-0 truncate text-sm font-semibold text-ink-primary">{row.studentName}</span>
            </span>
            <span className="mt-1 block truncate text-xs text-ink-secondary">{row.dayLabel}</span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs tabular-nums text-ink-secondary">
              <span>
                Serie <span className="font-semibold text-ink-primary">{row.doneSets ?? 0}</span> de {row.plannedSets ?? 0}
              </span>
              {row.volumeKg ? (
                <span>
                  <span className="font-semibold text-ink-primary">{formatNumber(row.volumeKg)}</span> kg movidos
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <LiveDot />
                {agoText(row.lastAt, now)}
              </span>
            </span>
          </span>
        </span>
      </Button>
    </li>
  )
}

function Row({ row, now, onOpen }: { row: MonitorRow; now: Date; onOpen: () => void }) {
  const hasBar = row.pct != null
  return (
    <li>
      <Button type="button" variant="ghost" onClick={onOpen} className="h-auto w-full whitespace-normal rounded-none px-4 py-3 text-left font-normal sm:px-5 [&>span]:w-full [&>span]:min-w-0">
        {/* El botón envuelve su contenido en un span que no se estira: `[&>span]:w-full` lo lleva de borde a borde. */}
        <span className="flex w-full min-w-0 items-center gap-3">
          <AvatarV2 name={row.studentName} path={row.avatarPath} />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="min-w-0 truncate text-sm font-medium text-ink-primary">{row.studentName}</span>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-ink-secondary">
                <span className={cn('h-2 w-2 rounded-full', FILL[row.state])} aria-hidden />
                {LABEL[row.state]}
              </span>
            </span>
            <span className="block text-xs text-ink-muted sm:truncate">{[row.dayLabel, row.detail].filter(Boolean).join(' · ')}</span>
            {hasBar ? (
              <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs tabular-nums text-ink-muted">
                <span>
                  {row.doneSets ?? 0} de {row.plannedSets ?? 0} series
                </span>
                {row.volumeKg ? <span>{formatNumber(row.volumeKg)} kg movidos</span> : null}
                {row.lastAt ? <span>última serie {agoText(row.lastAt, now)}</span> : null}
              </span>
            ) : null}
          </span>
          {hasBar ? (
            <Ring pct={row.pct!} size={44} stroke={5} className={STROKE[row.state]}>
              <span className="text-2xs font-semibold tabular-nums text-ink-primary">{row.pct}%</span>
            </Ring>
          ) : null}
        </span>
      </Button>
    </li>
  )
}

/**
 * v2 · Inicio del entrenador: monitor de entrenamiento. Las métricas del día en casilleros de color
 * (quién entrena ahora, cuántos entrenaron, cumplimiento y kilos movidos), dos gráficos (actividad de
 * la semana y ritmo de hoy por hora), los que están entrenando en vivo y, abajo, alumno por alumno.
 * Sale de lo que cada alumno anota desde su link y se actualiza solo cada 30 segundos.
 * Sin rutinas activas no se muestra.
 */
export function TrainingMonitorCardV2({ ownerId, onOpenRoutine }: { ownerId: string; onOpenRoutine: (routineId: string) => void }) {
  const [showIdle, setShowIdle] = useState(false)
  const [filter, setFilter] = useState<MonitorState | null>(null)
  const { rows, week, summary, now, updatedAt, loading, empty } = useTrainingMonitor(ownerId)

  if (loading) {
    return <div className="h-72 animate-pulse rounded-3xl border border-surface-border bg-surface-card" aria-busy="true" aria-label="Cargando el monitor" />
  }
  if (empty) {
    return (
      <p className="rounded-3xl border border-dashed border-surface-inputBorder p-8 text-center text-sm text-ink-muted">
        Todavía no hay rutinas activas. Cuando le armes una rutina a un alumno, acá vas a ver cómo entrena.
      </p>
    )
  }

  const counts = Object.fromEntries(ORDER.map((s) => [s, rows.filter((r) => r.state === s).length])) as Record<MonitorState, number>
  const total = rows.length
  const trainedToday = counts.live + counts.done + counts.deviated
  const live = rows.filter((r) => r.state === 'live')
  const shown = filter ? rows.filter((r) => r.state === filter) : rows.filter((r) => r.state !== 'idle' && r.state !== 'live')
  const idle = filter ? [] : rows.filter((r) => r.state === 'idle')
  const participation = total ? Math.round((trainedToday / total) * 100) : 0

  return (
    <MonitorBody
      {...{ rows, week, summary, now, updatedAt, counts, total, trainedToday, live, shown, idle, participation, filter, setFilter, showIdle, setShowIdle, onOpenRoutine }}
    />
  )
}

/** Datos del monitor (rutinas activas + lo anotado), compartidos por la pantalla y la tarjeta del Inicio. */
export function useTrainingMonitor(ownerId: string) {
  // El reloj avanza con cada refresco: así «entrenando ahora» caduca aunque no lleguen datos nuevos.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), REFRESH_MS)
    return () => window.clearInterval(id)
  }, [])

  const routinesQ = useQuery({
    queryKey: ['v2', 'training-monitor-routines', ownerId],
    staleTime: 5 * 60_000,
    queryFn: () => loadMonitorRoutines(ownerId),
  })
  const routineIds = useMemo(() => (routinesQ.data ?? []).map((r) => r.id).sort(), [routinesQ.data])
  const logsQ = useQuery({
    queryKey: ['v2', 'training-monitor-logs', ownerId, routineIds.join(',')],
    enabled: routineIds.length > 0,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
    queryFn: () => loadMonitorLogs(routineIds),
  })

  const input = useMemo(
    () => ({ routines: routinesQ.data ?? [], setLogs: logsQ.data?.setLogs ?? [], dayLogs: logsQ.data?.dayLogs ?? [], now }),
    [routinesQ.data, logsQ.data, now],
  )
  const rows = useMemo(() => buildTrainingMonitor(input), [input])
  const week = useMemo(() => weekActivity(input), [input])
  const summary = useMemo(() => monitorSummary({ rows, setLogs: input.setLogs, now: input.now }), [rows, input])
  const empty = !routinesQ.isPending && (routinesQ.data ?? []).length === 0
  return {
    rows,
    week,
    summary,
    now,
    updatedAt: logsQ.dataUpdatedAt || now.getTime(),
    loading: routinesQ.isPending || (!empty && logsQ.isPending),
    empty,
  }
}

function MonitorBody({
  week,
  summary,
  now,
  updatedAt,
  counts,
  total,
  trainedToday,
  live,
  shown,
  idle,
  participation,
  filter,
  setFilter,
  showIdle,
  setShowIdle,
  onOpenRoutine,
}: {
  rows: MonitorRow[]
  week: WeekActivityDay[]
  summary: MonitorSummary
  now: Date
  updatedAt: number
  counts: Record<MonitorState, number>
  total: number
  trainedToday: number
  live: MonitorRow[]
  shown: MonitorRow[]
  idle: MonitorRow[]
  participation: number
  filter: MonitorState | null
  setFilter: (s: MonitorState | null) => void
  showIdle: boolean
  setShowIdle: (fn: (v: boolean) => boolean) => void
  onOpenRoutine: (routineId: string) => void
}) {
  return (
    <section aria-labelledby="monitor-entrenamiento" className="overflow-hidden rounded-3xl border border-surface-border bg-surface-card">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pt-4 sm:px-5">
        <div>
          <h2 id="monitor-entrenamiento" className="text-lg font-semibold tracking-tight text-ink-primary">
            Hoy
          </h2>
          <p className="text-xs text-ink-muted">Lo que tus alumnos registran desde su link.</p>
        </div>
        <p className="inline-flex items-center gap-2 rounded-full bg-surface-elevated px-3 py-1.5 text-xs text-ink-secondary" aria-live="polite">
          <LiveDot />
          En vivo · actualizado {format(new Date(updatedAt), 'HH:mm')}
        </p>
      </div>

      {/* Métricas del día */}
      <div className="grid grid-cols-2 gap-2.5 px-4 pt-4 sm:px-5 lg:grid-cols-4">
        <Kpi
          tone="mint"
          icon={Activity}
          label="Entrenando ahora"
          value={counts.live}
          hint={live.length ? live.slice(0, 2).map((r) => firstName(r.studentName)).join(', ') + (live.length > 2 ? ` y ${live.length - 2} más` : '') : 'Nadie en este momento'}
          aside={counts.live > 0 ? <LiveDot className="h-3 w-3 self-start" /> : undefined}
        />
        <Kpi
          tone="lavender"
          icon={Users}
          label="Entrenaron hoy"
          value={trainedToday}
          unit={`de ${total}`}
          hint={`${participation} % de tus alumnos`}
          aside={
            <Ring pct={participation} size={52} stroke={6}>
              <span className="text-2xs font-semibold tabular-nums">{participation}%</span>
            </Ring>
          }
        />
        <Kpi
          tone="butter"
          icon={Dumbbell}
          label="Cumplimiento de hoy"
          value={summary.avgPct ?? '—'}
          unit={summary.avgPct != null ? '%' : undefined}
          hint={summary.plannedToday ? `${summary.doneToday} de ${summary.plannedToday} series` : 'Sin series planificadas'}
          aside={
            summary.avgPct != null ? (
              <Ring pct={summary.avgPct} size={52} stroke={6}>
                <span className="sr-only">{summary.avgPct} %</span>
              </Ring>
            ) : undefined
          }
        />
        <Kpi
          tone="rose"
          icon={Flame}
          label={summary.volumeKg > 0 ? 'Kilos movidos hoy' : 'Series de hoy'}
          value={summary.volumeKg > 0 ? formatNumber(summary.volumeKg) : summary.setsToday}
          unit={summary.volumeKg > 0 ? 'kg' : undefined}
          hint={summary.volumeKg > 0 ? `en ${summary.setsToday} ${summary.setsToday === 1 ? 'serie' : 'series'}` : 'anotadas por tus alumnos'}
        />
      </div>

      {/* Gráficos */}
      <div className="grid gap-2.5 px-4 pt-2.5 sm:px-5 lg:grid-cols-2">
        <WeekBars days={week} total={total} />
        <HourBars summary={summary} nowHour={now.getHours()} />
      </div>

      {/* En vivo */}
      {live.length > 0 && (!filter || filter === 'live') ? (
        <div className="px-4 pt-4 sm:px-5">
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-secondary">
            <LiveDot /> Entrenando ahora
          </p>
          <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {live.map((row) => (
              <LiveCard key={row.routineId} row={row} now={now} onOpen={() => onOpenRoutine(row.routineId)} />
            ))}
          </ul>
        </div>
      ) : null}

      {/* Cómo se reparten hoy */}
      <div className="px-4 pb-3 pt-4 sm:px-5">
        <p className="mb-2 text-xs font-medium text-ink-secondary">Tus {total} alumnos hoy</p>
        <TodayBar counts={counts} total={total} active={filter} onPick={setFilter} />
      </div>

      {shown.length > 0 && filter !== 'live' ? (
        <ul className="divide-y divide-surface-border/60 border-t border-surface-border/70">
          {shown.map((row) => (
            <Row key={row.routineId} row={row} now={now} onOpen={() => onOpenRoutine(row.routineId)} />
          ))}
        </ul>
      ) : trainedToday === 0 && !filter ? (
        <p className="border-t border-surface-border/70 px-4 py-4 text-sm text-ink-muted sm:px-5">
          Todavía nadie registró entrenamiento hoy. Aparecen acá a medida que anotan sus series.
        </p>
      ) : null}

      {idle.length > 0 ? (
        <div className="border-t border-surface-border/70">
          <Button
            type="button"
            variant="ghost"
            aria-expanded={showIdle}
            onClick={() => setShowIdle((v) => !v)}
            className="h-auto w-full rounded-none px-4 py-2.5 text-xs font-medium text-ink-muted sm:px-5 [&>span]:w-full"
          >
            <span className="flex w-full items-center justify-between gap-3">
              {idle.length} sin registro hoy
              <ChevronDown className={cn('h-4 w-4 transition-transform', showIdle && 'rotate-180')} aria-hidden />
            </span>
          </Button>
          {showIdle ? (
            <ul className="divide-y divide-surface-border/60 border-t border-surface-border/70">
              {idle.map((row) => (
                <Row key={row.routineId} row={row} now={now} onOpen={() => onOpenRoutine(row.routineId)} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

/**
 * v2 · Inicio del entrenador: tarjetita con lo que pasa ahora (quién entrena y cuántos entrenaron hoy).
 * Lleva a la pantalla del monitor. Sin rutinas activas no se muestra.
 */
export function TrainingLiveTileV2({ ownerId, onOpen }: { ownerId: string; onOpen: () => void }) {
  const { rows, loading, empty } = useTrainingMonitor(ownerId)
  if (loading || empty) return null
  const live = rows.filter((r) => r.state === 'live')
  const trained = rows.filter((r) => r.state === 'live' || r.state === 'done' || r.state === 'deviated').length
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onOpen}
      className={cn('hh-pastel h-auto w-full whitespace-normal rounded-2xl px-3.5 py-3 text-left font-normal hover:opacity-90 [&>span]:w-full [&>span]:min-w-0', TONE_TINT.mint)}
    >
      <span className="flex w-full min-w-0 items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-xs opacity-80">
            {live.length > 0 ? <LiveDot /> : <Activity className="h-3.5 w-3.5" aria-hidden />}
            Entrenamientos en progreso
          </span>
          <span className="mt-1 block text-2xl font-semibold leading-tight tabular-nums tracking-tight">{live.length}</span>
          <span className="mt-0.5 block truncate text-xs opacity-80">
            {live.length ? `${live.slice(0, 2).map((r) => firstName(r.studentName)).join(', ')}${live.length > 2 ? ` y ${live.length - 2} más` : ''} · ` : ''}
            {trained} de {rows.length} entrenaron hoy
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 opacity-70" aria-hidden />
      </span>
    </Button>
  )
}
