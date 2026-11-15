import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AvatarV2 } from '@/components/v2/ui'
import { LiveDot, MONITOR_FAST_REFRESH_MS, firstName, useTrainingMonitor } from '@/components/dashboard/TrainingMonitorCardV2'
import type { MonitorEvent, MonitorRow, MonitorState, MonitorSummary, WeekCell, WeekMatrixRow } from '@/lib/routine/trainingMonitor'
import { cn, formatNumber } from '@/lib/utils'

const LABEL: Record<MonitorState, string> = {
  live: 'Entrenando ahora',
  done: 'Entrenó',
  deviated: 'Con desvíos',
  missed: 'No entrenó',
  due: 'Le toca hoy',
  idle: 'Sin registro',
}
const ORDER: MonitorState[] = ['live', 'done', 'deviated', 'missed', 'due', 'idle']
/** Color de cada estado, como relleno y como trazo. Siempre va con su nombre al lado, nunca solo. */
const FILL: Record<MonitorState, string> = {
  live: 'bg-status-ok',
  done: 'bg-ink-primary',
  deviated: 'bg-pastel-butter-accent',
  missed: 'bg-status-expired',
  due: 'bg-pastel-lavender-accent',
  idle: 'bg-surface-inputBorder',
}
const INK: Record<MonitorState, string> = {
  live: 'text-status-ok-ink',
  done: 'text-ink-primary',
  deviated: 'text-pastel-butter-accent',
  missed: 'text-status-expired',
  due: 'text-pastel-lavender-accent',
  idle: 'text-ink-muted',
}

/** «hace 2 min», «hace 1 h 10». */
function agoText(iso: string | null, now: Date): string {
  if (!iso) return ''
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'recién'
  if (mins < 60) return `hace ${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `hace ${h} h ${m}` : `hace ${h} h`
}

/** Número que sube o baja hasta su valor en vez de saltar. */
function Counter({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (reduce || from.current === value) {
      from.current = value
      setShown(value)
      return
    }
    const start = from.current
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 700)
      const eased = 1 - Math.pow(1 - k, 3)
      setShown(Math.round(start + (value - start) * eased))
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, reduce])
  return <span className={cn('tabular-nums', className)}>{formatNumber(shown)}</span>
}

/** Reloj con segundos: es lo que deja claro que la pantalla está viva. */
function Clock() {
  const [t, setT] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setT(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return <span className="tabular-nums">{format(t, 'HH:mm:ss')}</span>
}

/** Ángulo fijo por alumno (0–360), para que su punto no salte de lugar entre refrescos. */
function angleOf(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return h
}

/**
 * Radar: cada alumno que está entrenando es un punto. Cuanto más cerca del centro, más cerca de
 * terminar el día. El barrido gira para que se lea como algo en vivo.
 */
function Radar({ live }: { live: MonitorRow[] }) {
  const size = 220
  const c = size / 2
  const rMax = 96
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[220px]">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full" role="img" aria-label={`${live.length} entrenando ahora`}>
        {[1, 0.66, 0.33].map((k) => (
          <circle key={k} cx={c} cy={c} r={rMax * k} fill="none" stroke="currentColor" strokeWidth="1" className="text-surface-border" />
        ))}
        <line x1={c - rMax} y1={c} x2={c + rMax} y2={c} stroke="currentColor" strokeWidth="1" className="text-surface-border" />
        <line x1={c} y1={c - rMax} x2={c} y2={c + rMax} stroke="currentColor" strokeWidth="1" className="text-surface-border" />
        {/* Barrido */}
        <g className="origin-center text-status-ok motion-safe:animate-[spin_5s_linear_infinite]" style={{ transformOrigin: `${c}px ${c}px` }}>
          <defs>
            <linearGradient id="hh-radar-sweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="currentColor" stopOpacity="0" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0.45" />
            </linearGradient>
          </defs>
          <path d={`M ${c} ${c} L ${c + rMax} ${c} A ${rMax} ${rMax} 0 0 0 ${c + rMax * Math.cos(-Math.PI / 3)} ${c + rMax * Math.sin(-Math.PI / 3)} Z`} fill="url(#hh-radar-sweep)" className="text-status-ok" />
          <line x1={c} y1={c} x2={c + rMax} y2={c} stroke="currentColor" strokeWidth="1.5" className="text-status-ok" />
        </g>
        {live.map((r) => {
          const a = (angleOf(r.routineId) * Math.PI) / 180
          const dist = rMax * (0.25 + 0.7 * (1 - (r.pct ?? 0) / 100))
          const x = c + dist * Math.cos(a)
          const y = c + dist * Math.sin(a)
          return (
            <g key={r.routineId} className="text-status-ok">
              <circle cx={x} cy={y} r="9" fill="currentColor" opacity="0.25" className="motion-safe:animate-ping" style={{ transformOrigin: `${x}px ${y}px` }} />
              <circle cx={x} cy={y} r="4.5" fill="currentColor">
                <title>{`${r.studentName} · ${r.detail}`}</title>
              </circle>
            </g>
          )
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <Counter value={live.length} className="text-5xl font-semibold leading-none tracking-tight text-ink-primary" />
        <span className="mt-1 text-xs text-ink-muted">en vivo</span>
      </div>
    </div>
  )
}

/** Medidor de media luna: cuántos de tus alumnos entrenaron hoy. */
function Gauge({ pct, trained, total }: { pct: number; trained: number; total: number }) {
  const r = 84
  const len = Math.PI * r
  return (
    <div className="relative mx-auto w-full max-w-[240px]">
      <svg viewBox="0 0 200 116" className="w-full" role="img" aria-label={`${pct} % de tus alumnos entrenaron hoy`}>
        <path d={`M ${100 - r} 104 A ${r} ${r} 0 0 1 ${100 + r} 104`} fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round" className="text-surface-elevated" />
        <motion.path
          d={`M ${100 - r} 104 A ${r} ${r} 0 0 1 ${100 + r} 104`}
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
          strokeLinecap="round"
          className="text-status-ok"
          strokeDasharray={len}
          initial={{ strokeDashoffset: len }}
          animate={{ strokeDashoffset: len * (1 - Math.max(0, Math.min(100, pct)) / 100) }}
          transition={{ type: 'spring', stiffness: 60, damping: 18 }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <p className="text-4xl font-semibold leading-none tracking-tight text-ink-primary">
          <Counter value={pct} />
          <span className="ml-0.5 text-xl font-medium text-ink-muted">%</span>
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          {trained} de {total} entrenaron hoy
        </p>
      </div>
    </div>
  )
}

/** Ritmo del día: una barra por hora, con la hora actual encendida. */
function Pulse({ summary, nowHour }: { summary: MonitorSummary; nowHour: number }) {
  const first = Math.min(6, nowHour)
  const hours = Array.from({ length: 24 - first }, (_, i) => first + i)
  const max = Math.max(1, ...summary.hourly)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium text-ink-secondary">Ritmo de hoy</p>
        <p className="text-xs text-ink-muted">
          {summary.peakHour != null ? `Pico a las ${String(summary.peakHour).padStart(2, '0')} h · ` : ''}
          {summary.setsToday} {summary.setsToday === 1 ? 'serie' : 'series'}
        </p>
      </div>
      <ol className="mt-2 flex h-20 items-end gap-1" aria-label="Series anotadas por hora">
        {hours.map((h) => {
          const n = summary.hourly[h] ?? 0
          const isNow = h === nowHour
          return (
            <li key={h} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${String(h).padStart(2, '0')} h · ${n} ${n === 1 ? 'serie' : 'series'}`}>
              <motion.span
                className={cn('block w-full rounded-sm', h > nowHour ? 'bg-surface-elevated/60' : isNow ? 'bg-status-ok' : n > 0 ? 'bg-ink-secondary' : 'bg-surface-elevated')}
                initial={false}
                animate={{ height: `${Math.max(4, Math.round((n / max) * 100))}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
            </li>
          )
        })}
      </ol>
      <div className="mt-1 flex gap-1 text-3xs text-ink-muted" aria-hidden>
        {hours.map((h) => (
          <span key={h} className={cn('min-w-0 flex-1 text-center', h === nowHour && 'font-semibold text-status-ok-ink')}>
            {h % 3 === 0 || h === nowHour ? h : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Avance del día en segmentos: uno por serie planificada. */
function SetTrack({ row }: { row: MonitorRow }) {
  const planned = Math.min(row.plannedSets ?? 0, 48)
  if (planned === 0) return null
  const done = Math.min(planned, row.doneSets ?? 0)
  return (
    <span className="flex h-2 w-full gap-0.5" role="img" aria-label={`${row.doneSets ?? 0} de ${row.plannedSets ?? 0} series`}>
      {Array.from({ length: planned }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-full min-w-0 flex-1 rounded-full',
            i < done ? FILL[row.state] : 'bg-surface-elevated',
            row.state === 'live' && i === done - 1 && 'motion-safe:animate-pulse',
          )}
        />
      ))}
    </span>
  )
}

function Lane({ row, now, onOpen }: { row: MonitorRow; now: Date; onOpen: () => void }) {
  const hasTrack = (row.plannedSets ?? 0) > 0 && row.state !== 'missed' && row.state !== 'due'
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <Button
        type="button"
        variant="ghost"
        onClick={onOpen}
        className="h-auto w-full whitespace-normal rounded-none px-4 py-3 text-left font-normal sm:px-5 [&>span]:w-full [&>span]:min-w-0"
      >
        <span className="flex w-full min-w-0 items-center gap-3">
          <span className="relative shrink-0">
            <AvatarV2 name={row.studentName} path={row.avatarPath} />
            {row.state === 'live' ? <LiveDot className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5" /> : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="truncate text-sm font-semibold text-ink-primary">{row.studentName}</span>
              <span className={cn('shrink-0 text-xs font-medium', INK[row.state])}>{LABEL[row.state]}</span>
            </span>
            <span className="mt-0.5 block truncate text-xs text-ink-muted">{[row.dayLabel, row.detail].filter(Boolean).join(' · ')}</span>
            {hasTrack ? (
              <span className="mt-2 block">
                <SetTrack row={row} />
              </span>
            ) : null}
          </span>
          <span className="shrink-0 text-right">
            {row.pct != null && hasTrack ? (
              <span className="block text-xl font-semibold leading-none tabular-nums tracking-tight text-ink-primary">
                {row.pct}
                <span className="ml-0.5 text-xs font-normal text-ink-muted">%</span>
              </span>
            ) : null}
            {row.lastAt ? <span className="mt-1 block text-xs text-ink-muted">{agoText(row.lastAt, now)}</span> : null}
          </span>
        </span>
      </Button>
    </motion.li>
  )
}

const EVENT_DOT: Record<MonitorEvent['kind'], string> = { sets: 'bg-status-ok', done: 'bg-ink-primary', missed: 'bg-status-expired' }

function Feed({ events, onOpen }: { events: MonitorEvent[]; onOpen: (routineId: string) => void }) {
  if (events.length === 0) {
    return <p className="px-4 py-6 text-sm text-ink-muted sm:px-5">Todavía no pasó nada hoy. Cada serie que anoten va a ir apareciendo acá.</p>
  }
  return (
    <ol className="max-h-[26rem] overflow-y-auto">
      <AnimatePresence initial={false}>
        {events.map((e) => (
          <motion.li key={e.id} layout="position" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="relative">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpen(e.routineId)}
              className="h-auto w-full whitespace-normal rounded-none px-4 py-2.5 text-left font-normal sm:px-5 [&>span]:w-full [&>span]:min-w-0"
            >
              <span className="flex w-full min-w-0 gap-3">
                <span className="w-10 shrink-0 pt-0.5 text-xs tabular-nums text-ink-muted">{format(new Date(e.at), 'HH:mm')}</span>
                <span className="relative mt-1.5 flex shrink-0 flex-col items-center">
                  <span className={cn('h-2 w-2 rounded-full', EVENT_DOT[e.kind])} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink-primary">
                    <span className="font-semibold">{firstName(e.studentName)}</span> · {e.title}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">{e.detail}</span>
                </span>
              </span>
            </Button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  )
}

const CELL: Record<WeekCell, string> = {
  trained: 'bg-status-ok',
  missed: 'bg-status-expired',
  due: 'border-2 border-ink-primary',
  owed: 'border-2 border-dashed border-status-expired',
  none: 'bg-surface-elevated',
  future: 'bg-surface-elevated/40',
}
const CELL_TEXT: Record<WeekCell, string> = { trained: 'entrenó', missed: 'avisó que no entrenaba', due: 'le toca hoy', owed: 'le tocaba y no lo registró', none: 'sin registro', future: 'todavía no llegó' }
const WEEK_HEAD = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const WEEK_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

function WeekMatrix({ rows, todayIndex, onOpen }: { rows: WeekMatrixRow[]; todayIndex: number; onOpen: (routineId: string) => void }) {
  return (
    <div className="px-4 pb-4 sm:px-5">
      <table className="w-full max-w-3xl table-fixed border-separate border-spacing-y-1 text-left">
        <thead>
          <tr>
            <th className="pb-1 text-xs font-medium text-ink-muted">Alumno</th>
            {WEEK_HEAD.map((d, i) => (
              <th key={d} scope="col" className={cn('w-7 pb-1 text-center text-xs font-medium sm:w-9', i === todayIndex ? 'text-ink-primary' : 'text-ink-muted')}>
                <abbr title={WEEK_NAMES[i]} className="no-underline">
                  {d}
                </abbr>
              </th>
            ))}
            <th className="w-10 pb-1 text-right text-xs font-medium text-ink-muted sm:w-16">Días</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.routineId}>
              <th scope="row" className="pr-2 font-normal">
                <Button type="button" variant="ghost" onClick={() => onOpen(r.routineId)} className="h-auto w-full justify-start gap-2 px-1 py-1 text-left font-normal [&>span]:min-w-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <AvatarV2 name={r.studentName} path={r.avatarPath} size="sm" />
                    <span className="truncate text-sm text-ink-primary">{r.studentName}</span>
                  </span>
                </Button>
              </th>
              {r.cells.map((cell, i) => (
                <td key={i} className="text-center">
                  <span className={cn('mx-auto block h-5 w-5 rounded-md', CELL[cell], i === todayIndex && cell === 'none' && 'ring-1 ring-inset ring-surface-inputBorder')}>
                    <span className="sr-only">{`${WEEK_NAMES[i]}: ${CELL_TEXT[cell]}`}</span>
                  </span>
                </td>
              ))}
              <td className="text-right text-sm font-semibold tabular-nums text-ink-primary">{r.trainedDays}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        {(['trained', 'missed', 'due', 'owed'] as const).map((k) => (
          <li key={k} className="inline-flex items-center gap-1.5">
            <span className={cn('h-3 w-3 rounded', CELL[k])} aria-hidden />
            {CELL_TEXT[k].charAt(0).toUpperCase() + CELL_TEXT[k].slice(1)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Panel({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('overflow-hidden rounded-3xl border border-surface-border bg-surface-card', className)}>
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
        <h2 className="text-sm font-semibold text-ink-primary">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

/**
 * v2 · Monitor de entrenamiento: tablero en vivo del entrenador. Arriba, la consola (siempre oscura):
 * radar de quién entrena ahora, medidor de participación, números del día y ritmo por hora. Abajo, las
 * pistas (avance serie por serie de cada alumno), la actividad a medida que pasa y la asistencia de la semana.
 */
export function TrainingMonitorBoardV2({ ownerId, onOpenRoutine }: { ownerId: string; onOpenRoutine: (routineId: string) => void }) {
  const { rows, matrix, feed, summary, now, updatedAt, pushed, loading, empty } = useTrainingMonitor(ownerId, { refreshMs: MONITOR_FAST_REFRESH_MS, realtime: true })
  const [filter, setFilter] = useState<MonitorState | null>(null)
  const [showIdle, setShowIdle] = useState(false)

  if (loading) return <div className="hh-console h-80 animate-pulse rounded-3xl" aria-busy="true" aria-label="Cargando el monitor" />
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
  const participation = total ? Math.round((trainedToday / total) * 100) : 0
  const live = rows.filter((r) => r.state === 'live')
  const lanes = filter ? rows.filter((r) => r.state === filter) : rows.filter((r) => r.state !== 'idle')
  const idle = filter ? [] : rows.filter((r) => r.state === 'idle')
  const todayIndex = (now.getDay() + 6) % 7

  return (
    <div className="flex flex-col gap-4">
      {/* ── Consola ── */}
      <section aria-labelledby="monitor-consola" className="hh-console overflow-hidden rounded-3xl">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 pt-5 sm:px-6">
          <h2 id="monitor-consola" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-primary">
            <LiveDot className="h-2.5 w-2.5" />
            En vivo
          </h2>
          <p className="text-xs text-ink-muted" aria-live="off">
            <span className="text-ink-secondary">
              <Clock />
            </span>
            {' · '}
            {pushed ? 'tiempo real' : `actualizado ${format(new Date(updatedAt), 'HH:mm:ss')}`}
          </p>
        </div>

        <div className="grid gap-6 px-5 pb-5 pt-4 sm:px-6 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          <div>
            <Radar live={live} />
            <p className="mt-2 truncate text-center text-xs text-ink-muted">
              {live.length ? live.slice(0, 3).map((r) => firstName(r.studentName)).join(', ') + (live.length > 3 ? ` y ${live.length - 3} más` : '') : 'Nadie entrenando en este momento'}
            </p>
          </div>
          <Gauge pct={participation} trained={trainedToday} total={total} />
          <dl className="grid grid-cols-3 gap-3 md:col-span-2 lg:col-span-1 lg:grid-cols-1 lg:gap-0 lg:divide-y lg:divide-surface-border">
            {(
              [
                ['Cumplimiento de hoy', summary.avgPct, '%', summary.plannedToday ? `${summary.doneToday} de ${summary.plannedToday} series` : 'Sin series planificadas'],
                ['Kilos movidos', summary.volumeKg, 'kg', 'entre todos tus alumnos'],
                ['Series anotadas', summary.setsToday, '', summary.peakHour != null ? `pico a las ${String(summary.peakHour).padStart(2, '0')} h` : 'hoy'],
              ] as const
            ).map(([label, value, unit, hint]) => (
              <div key={label} className="min-w-0 lg:py-3 lg:first:pt-0 lg:last:pb-0">
                <dt className="truncate text-xs text-ink-muted">{label}</dt>
                <dd className="mt-0.5 text-2xl font-semibold leading-none tracking-tight text-ink-primary sm:text-3xl">
                  {value == null ? '—' : <Counter value={value} />}
                  {value != null && unit ? <span className="ml-1 text-sm font-normal text-ink-muted">{unit}</span> : null}
                </dd>
                <dd className="mt-1 truncate text-xs text-ink-muted">{hint}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="border-t border-surface-border px-5 py-4 sm:px-6">
          <Pulse summary={summary} nowHour={now.getHours()} />
        </div>

        {/* Reparto del día: cada tramo filtra las pistas. */}
        <div className="border-t border-surface-border px-5 py-4 sm:px-6">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-elevated" role="img" aria-label="Cómo se reparten hoy tus alumnos">
            {ORDER.filter((s) => counts[s] > 0).map((s) => (
              <motion.span key={s} className={cn('h-full', FILL[s])} initial={false} animate={{ width: `${(counts[s] / total) * 100}%` }} transition={{ type: 'spring', stiffness: 90, damping: 20 }} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ORDER.filter((s) => counts[s] > 0).map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={filter === s ? 'primary' : 'secondary'}
                aria-pressed={filter === s}
                onClick={() => setFilter(filter === s ? null : s)}
                className="gap-1.5"
              >
                <span className={cn('h-2 w-2 rounded-full', FILL[s])} aria-hidden />
                {LABEL[s]}
                <span className="tabular-nums opacity-70">{counts[s]}</span>
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pistas + actividad ── */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          title={filter ? LABEL[filter] : 'En pista'}
          aside={
            filter ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setFilter(null)}>
                Ver todos
              </Button>
            ) : (
              <span className="text-xs text-ink-muted">Una marca por serie planificada</span>
            )
          }
        >
          {lanes.length === 0 ? (
            <p className="px-4 pb-5 text-sm text-ink-muted sm:px-5">
              {filter ? 'Nadie en este estado ahora.' : 'Todavía nadie registró entrenamiento hoy. Aparecen acá a medida que anotan sus series.'}
            </p>
          ) : (
            <ul className="divide-y divide-surface-border/60 border-t border-surface-border/70">
              <AnimatePresence initial={false}>
                {lanes.map((row) => (
                  <Lane key={row.routineId} row={row} now={now} onOpen={() => onOpenRoutine(row.routineId)} />
                ))}
              </AnimatePresence>
            </ul>
          )}
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
                    <Lane key={row.routineId} row={row} now={now} onOpen={() => onOpenRoutine(row.routineId)} />
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </Panel>

        <Panel title="Actividad" aside={<span className="text-xs text-ink-muted">Lo último, arriba</span>}>
          <div className="border-t border-surface-border/70">
            <Feed events={feed} onOpen={onOpenRoutine} />
          </div>
        </Panel>
      </div>

      {/* ── Semana ── */}
      <Panel title="Esta semana, alumno por alumno" aside={<span className="text-xs text-ink-muted">{WEEK_NAMES[todayIndex]!.charAt(0).toUpperCase() + WEEK_NAMES[todayIndex]!.slice(1)}</span>}>
        <WeekMatrix rows={matrix} todayIndex={todayIndex} onOpen={onOpenRoutine} />
      </Panel>
    </div>
  )
}
