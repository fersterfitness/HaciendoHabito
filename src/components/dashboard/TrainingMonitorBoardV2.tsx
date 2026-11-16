import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AvatarV2, TONE_TINT } from '@/components/v2/ui'
import { LiveDot, MONITOR_FAST_REFRESH_MS, firstName, useTrainingMonitor } from '@/components/dashboard/TrainingMonitorCardV2'
import { WEEKDAY_LABELS, type MonitorEvent, type MonitorRow, type MonitorState, type MonitorSummary, type WeekCell, type WeekMatrixRow } from '@/lib/routine/trainingMonitor'
import { cn, formatNumber } from '@/lib/utils'

/** Color de cada estado (anillo del avatar y punto). Siempre va con su nombre al lado, nunca solo. */
const RING: Record<MonitorState, string> = {
  live: 'stroke-status-ok',
  done: 'stroke-ink-primary',
  deviated: 'stroke-pastel-butter-accent',
  missed: 'stroke-status-expired',
  due: 'stroke-pastel-lavender-accent',
  idle: 'stroke-surface-inputBorder',
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

const kg = (n: number) => `${formatNumber(Number(n.toFixed(1)))} kg`

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

/** Reloj con segundos: deja claro que la pantalla está viva. */
function Clock() {
  const [t, setT] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setT(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return <span className="tabular-nums">{format(t, 'HH:mm:ss')}</span>
}

/** Avatar con un anillo de avance alrededor, del color del estado. */
function RingAvatar({ row, size = 52 }: { row: MonitorRow; size?: number }) {
  const r = size / 2 - 3
  const c = 2 * Math.PI * r
  const ratio = row.state === 'missed' || row.state === 'due' || row.state === 'idle' ? 1 : Math.max(0, Math.min(1, (row.pct ?? 0) / 100))
  const faint = row.state === 'idle' || row.state === 'due'
  return (
    <span className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3" className="stroke-surface-elevated" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          className={cn(RING[row.state], faint && 'opacity-60')}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - ratio) }}
          transition={{ type: 'spring', stiffness: 70, damping: 18 }}
        />
      </svg>
      <AvatarV2 name={row.studentName} path={row.avatarPath} size={size >= 48 ? 'lg' : 'md'} />
      {row.state === 'live' ? <LiveDot className="absolute right-0.5 top-0.5 h-2.5 w-2.5" /> : null}
    </span>
  )
}

/** Un indicador de la franja de arriba. */
function Kpi({ label, children, foot }: { label: string; children: React.ReactNode; foot: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-surface-border bg-surface-card px-4 pb-3.5 pt-3">
      <p className="truncate text-xs text-ink-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold leading-none tracking-[-0.03em] text-ink-primary">{children}</p>
      <div className="mt-2.5 min-h-[18px] text-xs text-ink-muted">{foot}</div>
    </div>
  )
}

function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
      <motion.span className={cn('block h-full rounded-full', className)} initial={false} animate={{ width: `${Math.max(0, Math.min(100, value))}%` }} transition={{ type: 'spring', stiffness: 80, damping: 20 }} />
    </span>
  )
}

/** Mini curva de series por hora, de las 6 hasta ahora. */
function Sparkline({ hourly, nowHour }: { hourly: number[]; nowHour: number }) {
  const first = Math.min(6, nowHour)
  const pts = hourly.slice(first, nowHour + 1)
  if (pts.length < 2 || pts.every((n) => n === 0)) return <span>Sin series todavía</span>
  const max = Math.max(1, ...pts)
  const w = 100
  const h = 18
  const step = w / (pts.length - 1)
  const d = pts.map((n, i) => `${i ? 'L' : 'M'} ${(i * step).toFixed(1)} ${(h - 2 - (n / max) * (h - 4)).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block h-[18px] w-full overflow-visible" role="img" aria-label="Series por hora en el día">
      <path d={d} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="stroke-status-ok" />
    </svg>
  )
}

function KpiStrip({ rows, summary, nowHour, weekday }: { rows: MonitorRow[]; summary: MonitorSummary; nowHour: number; weekday: number }) {
  const live = rows.filter((r) => r.state === 'live').length
  const trained = rows.filter((r) => r.state === 'live' || r.state === 'done' || r.state === 'deviated').length
  const total = rows.length
  const prev = summary.volumePrevKg
  const delta = prev && prev > 0 ? Math.round(((summary.volumeKg - prev) / prev) * 100) : null
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <Kpi label="Entrenando ahora" foot={<Sparkline hourly={summary.hourly} nowHour={nowHour} />}>
        <Counter value={live} />
      </Kpi>
      <Kpi label="Entrenaron hoy" foot={<Bar value={total ? (trained / total) * 100 : 0} className="bg-ink-primary" />}>
        <Counter value={trained} />
        <span className="ml-1 text-sm font-medium tracking-normal text-ink-muted">de {total}</span>
      </Kpi>
      <Kpi label="Cumplimiento" foot={summary.plannedToday ? `${summary.doneToday} de ${summary.plannedToday} series` : 'Sin series planificadas'}>
        {summary.avgPct == null ? '—' : <Counter value={summary.avgPct} />}
        {summary.avgPct != null ? <span className="ml-0.5 text-sm font-medium tracking-normal text-ink-muted">%</span> : null}
      </Kpi>
      <Kpi
        label="Kilos movidos"
        foot={
          delta == null ? (
            `${summary.setsToday} ${summary.setsToday === 1 ? 'serie' : 'series'} hoy`
          ) : (
            <span>
              <span className={cn('font-medium', delta >= 0 ? 'text-status-ok-ink' : 'text-status-expired')}>
                {delta >= 0 ? '+' : ''}
                {delta} %
              </span>{' '}
              vs. el {WEEKDAY_LABELS[weekday]} pasado
            </span>
          )
        }
      >
        <Counter value={summary.volumeKg} />
        <span className="ml-1 text-sm font-medium tracking-normal text-ink-muted">kg</span>
      </Kpi>
    </div>
  )
}

/** Tarjeta grande de quien está entrenando: avance del día y el ejercicio en el que va. */
function LiveCard({ row, now, onOpen }: { row: MonitorRow; now: Date; onOpen: () => void }) {
  const cur = row.current
  const planned = Math.min(cur?.setsPlanned ?? 0, 12)
  const below = cur?.plannedKg != null && cur.weightKg != null && cur.weightKg < cur.plannedKg
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.25 }}>
      <Button
        type="button"
        variant="ghost"
        onClick={onOpen}
        className="h-auto w-full flex-col items-stretch whitespace-normal rounded-2xl border border-status-ok/50 bg-surface-card p-0 text-left font-normal hover:bg-surface-panel [&>span]:w-full [&>span]:min-w-0"
      >
        <span className="block w-full">
          <span className="flex items-center gap-3 px-4 pb-3 pt-4">
            <RingAvatar row={row} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink-primary">{row.studentName}</span>
              <span className="block truncate text-xs text-ink-secondary">{row.dayLabel}</span>
              <span className="block truncate text-xs text-ink-muted">Última serie {agoText(row.lastAt, now)}</span>
            </span>
            {row.pct != null ? (
              <span className="shrink-0 text-right">
                <span className="block text-2xl font-semibold leading-none tabular-nums tracking-tight text-ink-primary">
                  {row.pct}
                  <span className="ml-0.5 text-xs font-normal text-ink-muted">%</span>
                </span>
                <span className="mt-1 block text-xs text-ink-muted">del día</span>
              </span>
            ) : null}
          </span>
          {cur ? (
            <span className="block border-t border-surface-border px-4 pb-4 pt-3">
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-medium text-ink-primary">{cur.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-ink-secondary">
                  {cur.setsPlanned ? `Serie ${Math.min(cur.setsDone, cur.setsPlanned)} de ${cur.setsPlanned}` : `${cur.setsDone} ${cur.setsDone === 1 ? 'serie' : 'series'}`}
                </span>
              </span>
              {planned > 0 ? (
                <span className="mt-2 flex h-1.5 gap-1" aria-hidden>
                  {Array.from({ length: planned }, (_, i) => (
                    <span
                      key={i}
                      className={cn('min-w-0 flex-1 rounded-full', i < cur.setsDone ? 'bg-status-ok' : 'bg-surface-elevated', i === cur.setsDone - 1 && 'motion-safe:animate-pulse')}
                    />
                  ))}
                </span>
              ) : null}
              {cur.weightKg != null || cur.reps != null ? (
                <span className="mt-2 block truncate text-xs tabular-nums text-ink-muted">
                  <span className={cn(below && 'font-medium text-pastel-butter-accent')}>
                    {cur.weightKg != null ? kg(cur.weightKg) : ''}
                    {cur.weightKg != null && cur.reps != null ? ' × ' : ''}
                    {cur.reps != null ? `${cur.reps}${cur.weightKg == null ? ' repeticiones' : ''}` : ''}
                  </span>
                  {cur.plannedKg != null ? ` · planificado ${kg(cur.plannedKg)}` : ''}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
      </Button>
    </motion.li>
  )
}

/** Persona de una fila de «El resto del día»: avatar con anillo, nombre y, si hay, el motivo. */
function Person({ row, onOpen, note }: { row: MonitorRow; onOpen: () => void; note?: { text: string; tone: 'butter' | 'rose' | null } }) {
  return (
    <li>
      <Button type="button" variant="ghost" onClick={onOpen} className="h-auto gap-2.5 whitespace-normal rounded-xl px-2 py-1.5 text-left font-normal [&>span]:min-w-0" title={`${row.studentName} · ${row.detail}`}>
        <span className="flex min-w-0 items-center gap-2.5">
          <RingAvatar row={row} size={40} />
          <span className="min-w-0">
            <span className="block truncate text-sm text-ink-primary">
              {firstName(row.studentName)}
              {row.pct != null && (row.state === 'done' || row.state === 'deviated') ? <span className="ml-1.5 text-xs tabular-nums text-ink-muted">{row.pct} %</span> : null}
            </span>
            {note ? (
              <span className={cn('mt-0.5 inline-block max-w-xs rounded-md px-1.5 py-0.5 text-xs', note.tone ? TONE_TINT[note.tone] : 'text-ink-muted')}>{note.text}</span>
            ) : null}
          </span>
        </span>
      </Button>
    </li>
  )
}

const GROUPS: { state: Exclude<MonitorState, 'live'>; label: string }[] = [
  { state: 'deviated', label: 'Con desvíos' },
  { state: 'missed', label: 'No entrenó' },
  { state: 'done', label: 'Terminaron' },
  { state: 'due', label: 'Le toca hoy' },
  { state: 'idle', label: 'Sin registro' },
]

function RestOfDay({ rows, onOpen }: { rows: MonitorRow[]; onOpen: (routineId: string) => void }) {
  const [showIdle, setShowIdle] = useState(false)
  const groups = GROUPS.map((g) => ({ ...g, rows: rows.filter((r) => r.state === g.state) })).filter((g) => g.rows.length > 0)
  if (groups.length === 0) return null
  return (
    <section>
      <h2 className="mb-2.5 text-sm font-semibold text-ink-primary">El resto del día</h2>
      <div className="divide-y divide-surface-border overflow-hidden rounded-2xl border border-surface-border bg-surface-card">
        {groups.map((g) => {
          const collapsed = g.state === 'idle' && !showIdle
          return (
            <div key={g.state} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
              <p className="shrink-0 px-2 text-xs text-ink-muted sm:w-28 sm:px-0">
                {g.label} <span className="ml-0.5 font-semibold tabular-nums text-ink-primary">{g.rows.length}</span>
              </p>
              {collapsed ? (
                <Button type="button" variant="ghost" aria-expanded={false} onClick={() => setShowIdle(true)} className="h-auto justify-start gap-3 rounded-xl px-2 py-1.5 font-normal">
                  <span className="flex items-center">
                    {g.rows.slice(0, 5).map((r, i) => (
                      <span key={r.routineId} className={cn('rounded-full', i > 0 && '-ml-1')}>
                        <AvatarV2 name={r.studentName} path={r.avatarPath} />
                      </span>
                    ))}
                    {g.rows.length > 5 ? <span className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-surface-elevated text-xs font-semibold text-ink-secondary ring-2 ring-surface-card">+{g.rows.length - 5}</span> : null}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                    Ver quiénes
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </Button>
              ) : (
                <ul className="flex min-w-0 flex-1 flex-wrap gap-x-2 gap-y-1">
                  {g.rows.map((r) => (
                    <Person
                      key={r.routineId}
                      row={r}
                      onOpen={() => onOpen(r.routineId)}
                      note={
                        g.state === 'deviated'
                          ? { text: r.detail, tone: 'butter' }
                          : g.state === 'missed'
                            ? { text: r.detail, tone: 'rose' }
                            : g.state === 'due' || g.state === 'idle'
                              ? { text: r.dayLabel || r.detail, tone: null }
                              : undefined
                      }
                    />
                  ))}
                  {g.state === 'idle' ? (
                    <li className="self-center">
                      <Button type="button" size="sm" variant="ghost" aria-expanded onClick={() => setShowIdle(false)}>
                        Ocultar
                      </Button>
                    </li>
                  ) : null}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Ritmo del día como una tira fina: un trazo por hora, de 6 a 22 h, con la hora actual marcada. */
function HourStrip({ hourly, nowHour }: { hourly: number[]; nowHour: number }) {
  const first = Math.min(6, nowHour)
  const last = Math.max(22, nowHour)
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i)
  const max = Math.max(1, ...hourly)
  return (
    <div>
      <ol className="flex h-8 items-end gap-[3px]" aria-label="Series anotadas por hora">
        {hours.map((h) => {
          const n = hourly[h] ?? 0
          return (
            <li key={h} className="flex h-full min-w-0 flex-1 items-end" title={`${String(h).padStart(2, '0')} h · ${n} ${n === 1 ? 'serie' : 'series'}`}>
              <motion.span
                className={cn('block w-full rounded-[3px]', h === nowHour ? 'bg-status-ok' : n > 0 ? 'bg-ink-secondary' : h > nowHour ? 'bg-surface-elevated/50' : 'bg-surface-elevated')}
                initial={false}
                animate={{ height: n > 0 ? `${Math.max(18, Math.round((n / max) * 100))}%` : '12%' }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
            </li>
          )
        })}
      </ol>
      <div className="mt-1 flex justify-between text-3xs text-ink-muted" aria-hidden>
        <span>{first} h</span>
        <span>{last} h</span>
      </div>
    </div>
  )
}

const EVENT_DOT: Record<MonitorEvent['kind'], string> = { sets: 'bg-status-ok', done: 'bg-ink-primary', missed: 'bg-status-expired' }

function Feed({ events, onOpen }: { events: MonitorEvent[]; onOpen: (routineId: string) => void }) {
  if (events.length === 0) return <p className="py-4 text-sm text-ink-muted">Todavía no pasó nada hoy. Cada serie que anoten aparece acá.</p>
  return (
    <ol className="-mx-2 max-h-[20rem] overflow-y-auto">
      <AnimatePresence initial={false}>
        {events.map((e) => (
          <motion.li key={e.id} layout="position" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
            <Button type="button" variant="ghost" onClick={() => onOpen(e.routineId)} className="h-auto w-full whitespace-normal rounded-lg px-2 py-1.5 text-left font-normal [&>span]:w-full [&>span]:min-w-0">
              <span className="flex w-full min-w-0 items-baseline gap-2.5">
                <span className="w-10 shrink-0 text-xs tabular-nums text-ink-muted">{format(new Date(e.at), 'HH:mm')}</span>
                <span className={cn('h-1.5 w-1.5 shrink-0 translate-y-[-2px] rounded-full', EVENT_DOT[e.kind])} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm text-ink-primary">
                  <span className="font-semibold">{firstName(e.studentName)}</span> · {e.title}
                  <span className="text-ink-muted"> · {e.detail}</span>
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
  const avg = rows.length ? rows.reduce((n, r) => n + r.trainedDays, 0) / rows.length : 0
  return (
    <div>
      <table className="w-full table-fixed border-separate border-spacing-y-1 text-left">
        <thead>
          <tr>
            <th className="text-xs font-medium text-ink-muted">
              <span className="sr-only">Alumno</span>
            </th>
            {WEEK_HEAD.map((d, i) => (
              <th key={d} scope="col" className={cn('w-6 text-center text-xs font-medium sm:w-7', i === todayIndex ? 'text-ink-primary' : 'text-ink-muted')}>
                <abbr title={WEEK_NAMES[i]} className="no-underline">
                  {d}
                </abbr>
              </th>
            ))}
            <th className="w-8 text-right text-xs font-medium text-ink-muted">Días</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.routineId}>
              <th scope="row" className="pr-2 font-normal">
                <Button type="button" variant="ghost" onClick={() => onOpen(r.routineId)} className="h-auto w-full justify-start px-1 py-0.5 text-left font-normal [&>span]:min-w-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <AvatarV2 name={r.studentName} path={r.avatarPath} size="sm" />
                    <span className="truncate text-sm text-ink-primary">{firstName(r.studentName)}</span>
                  </span>
                </Button>
              </th>
              {r.cells.map((cell, i) => (
                <td key={i} className="text-center">
                  <span className={cn('mx-auto block h-4 w-4 rounded', CELL[cell], i === todayIndex && cell === 'none' && 'ring-1 ring-inset ring-surface-inputBorder')}>
                    <span className="sr-only">{`${WEEK_NAMES[i]}: ${CELL_TEXT[cell]}`}</span>
                  </span>
                </td>
              ))}
              <td className="text-right text-sm font-semibold tabular-nums text-ink-primary">{r.trainedDays}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-ink-muted">
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {(['trained', 'missed', 'due', 'owed'] as const).map((k) => (
            <li key={k} className="inline-flex items-center gap-1.5">
              <span className={cn('h-2.5 w-2.5 rounded-sm', CELL[k])} aria-hidden />
              {CELL_TEXT[k].charAt(0).toUpperCase() + CELL_TEXT[k].slice(1)}
            </li>
          ))}
        </ul>
        <span>Promedio {formatNumber(Number(avg.toFixed(1)))} días por alumno</span>
      </div>
    </div>
  )
}

function Panel({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-surface-border bg-surface-card px-4 pb-4 pt-3.5 sm:px-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink-primary">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

/**
 * v2 · Monitor de entrenamiento. Primero las personas: una franja con los números del día, la tarjeta
 * de cada alumno que está entrenando (en qué ejercicio va y con cuánto peso), el resto del día agrupado
 * por estado y, abajo, la actividad a medida que pasa y la asistencia de la semana.
 */
export function TrainingMonitorBoardV2({ ownerId, onOpenRoutine }: { ownerId: string; onOpenRoutine: (routineId: string) => void }) {
  const { rows, matrix, feed, summary, now, updatedAt, pushed, loading, empty } = useTrainingMonitor(ownerId, { refreshMs: MONITOR_FAST_REFRESH_MS, realtime: true })

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando el monitor">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-surface-elevated" />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-2xl bg-surface-elevated" />
      </div>
    )
  }
  if (empty) {
    return (
      <p className="rounded-2xl border border-dashed border-surface-inputBorder p-8 text-center text-sm text-ink-muted">
        Todavía no hay rutinas activas. Cuando le armes una rutina a un alumno, acá vas a ver cómo entrena.
      </p>
    )
  }

  const live = rows.filter((r) => r.state === 'live')
  const lastTrained = rows.filter((r) => r.lastAt && r.state !== 'live').sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''))[0]
  const todayIndex = (now.getDay() + 6) % 7

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink-primary">
          <LiveDot className="h-2.5 w-2.5" />
          En vivo
          <span className="font-normal text-ink-secondary">
            <Clock />
          </span>
        </span>
        <span>{pushed ? 'Tiempo real' : `Actualizado ${format(new Date(updatedAt), 'HH:mm:ss')}`}</span>
      </div>

      <KpiStrip rows={rows} summary={summary} nowHour={now.getHours()} weekday={now.getDay()} />

      <section>
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink-primary">Ahora mismo</h2>
          <span className="text-xs text-ink-muted">Se actualiza solo</span>
        </div>
        {live.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-surface-inputBorder px-4 py-5 text-sm text-ink-muted">
            Nadie está entrenando en este momento.
            {lastTrained ? ` El último fue ${firstName(lastTrained.studentName)}, ${agoText(lastTrained.lastAt, now)}.` : ''}
          </p>
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {live.map((r) => (
                <LiveCard key={r.routineId} row={r} now={now} onOpen={() => onOpenRoutine(r.routineId)} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <RestOfDay rows={rows} onOpen={onOpenRoutine} />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel title="Actividad" aside={<span className="text-xs text-ink-muted">{summary.peakHour != null ? `Pico a las ${String(summary.peakHour).padStart(2, '0')} h` : 'Lo último, arriba'}</span>}>
          <HourStrip hourly={summary.hourly} nowHour={now.getHours()} />
          <div className="mt-3 border-t border-surface-border pt-2">
            <Feed events={feed} onOpen={onOpenRoutine} />
          </div>
        </Panel>
        <Panel title="Semana" aside={<span className="text-xs text-ink-muted">{WEEK_NAMES[todayIndex]!.charAt(0).toUpperCase() + WEEK_NAMES[todayIndex]!.slice(1)}</span>}>
          <WeekMatrix rows={matrix} todayIndex={todayIndex} onOpen={onOpenRoutine} />
        </Panel>
      </div>
    </div>
  )
}
