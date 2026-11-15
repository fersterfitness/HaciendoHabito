import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AvatarV2 } from '@/components/v2/ui'
import {
  buildTrainingMonitor,
  loadMonitorLogs,
  loadMonitorRoutines,
  weekActivity,
  type MonitorRow,
  type MonitorState,
  type WeekActivityDay,
} from '@/lib/routine/trainingMonitor'
import { cn } from '@/lib/utils'

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
 * Color de cada estado (relleno de la barra, punto de la leyenda y avance de la fila). Son estados,
 * no series: siempre van con su nombre y su cantidad escritos al lado, nunca solo con el color.
 */
const FILL: Record<MonitorState, string> = {
  live: 'bg-status-ok',
  done: 'bg-ink-primary',
  deviated: 'bg-pastel-butter-accent',
  missed: 'bg-status-expired',
  due: 'bg-pastel-lavender-accent',
  idle: 'bg-surface-inputBorder',
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2" aria-hidden>
      <span className="absolute inline-flex h-full w-full rounded-full bg-status-ok opacity-60 motion-safe:animate-ping" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-status-ok" />
    </span>
  )
}

/** Distribución de hoy: una barra partida por estado, con leyenda que también filtra la lista. */
function TodayBar({ counts, total, active, onPick }: { counts: Record<MonitorState, number>; total: number; active: MonitorState | null; onPick: (s: MonitorState | null) => void }) {
  const present = ORDER.filter((s) => counts[s] > 0)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={present.map((s) => `${LABEL[s]}: ${counts[s]}`).join(', ')}>
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

/** Actividad de la semana: una barra por día (alumnos que entrenaron), con el día de hoy resaltado. */
function WeekBars({ days, total }: { days: WeekActivityDay[]; total: number }) {
  const max = Math.max(1, ...days.map((d) => d.trained))
  const sum = days.reduce((n, d) => n + d.trained, 0)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-ink-muted">Esta semana</p>
        <p className="text-xs text-ink-muted">
          <span className="font-semibold tabular-nums text-ink-primary">{sum}</span> {sum === 1 ? 'entrenamiento' : 'entrenamientos'}
        </p>
      </div>
      <ol className="flex h-28 items-end gap-1.5" aria-label="Alumnos que entrenaron cada día de esta semana">
        {days.map((d) => {
          const h = d.trained > 0 ? Math.max(12, Math.round((d.trained / max) * 100)) : 0
          const tip = d.isFuture
            ? `${d.name}: todavía no llegó`
            : `${d.name}: ${d.trained} de ${total} ${d.trained === 1 ? 'entrenó' : 'entrenaron'}${d.missed ? ` · ${d.missed} ${d.missed === 1 ? 'avisó' : 'avisaron'} que no` : ''}`
          return (
            <li key={d.ymd} title={tip} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className={cn('text-2xs tabular-nums text-ink-primary transition-opacity', d.isToday && d.trained > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')} aria-hidden>
                {d.trained}
              </span>
              <span className="flex w-full flex-1 items-end rounded-md bg-surface-elevated/60">
                <span className={cn('block w-full rounded-md transition-[height] duration-500', d.isToday ? 'bg-ink-primary' : 'bg-ink-primary/35')} style={{ height: `${h}%` }} />
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

function Row({ row, onOpen }: { row: MonitorRow; onOpen: () => void }) {
  const hasBar = row.pct != null
  return (
    <li>
      <Button type="button" variant="ghost" onClick={onOpen} className="h-auto w-full whitespace-normal rounded-none px-4 py-2.5 text-left font-normal sm:px-5 [&>span]:w-full [&>span]:min-w-0">
        {/* El botón envuelve su contenido en un span que no se estira: `[&>span]:w-full` lo lleva de borde a borde. */}
        <span className="flex w-full min-w-0 items-center gap-3">
          <AvatarV2 name={row.studentName} path={row.avatarPath} />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="min-w-0 truncate text-sm font-medium text-ink-primary">{row.studentName}</span>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-ink-secondary">
                {row.state === 'live' ? <LiveDot /> : <span className={cn('h-2 w-2 rounded-full', FILL[row.state])} aria-hidden />}
                {LABEL[row.state]}
              </span>
            </span>
            <span className="block text-xs text-ink-muted sm:truncate">{[row.dayLabel, row.detail].filter(Boolean).join(' · ')}</span>
            {hasBar ? (
              <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated" aria-hidden>
                <span className={cn('block h-full rounded-full transition-[width] duration-700', FILL[row.state])} style={{ width: `${Math.max(2, row.pct!)}%` }} />
              </span>
            ) : null}
          </span>
          {hasBar ? (
            <span className="w-11 shrink-0 text-right text-sm font-semibold tabular-nums text-ink-primary">
              {row.pct}
              <span className="ml-0.5 text-xs font-normal text-ink-muted">%</span>
            </span>
          ) : null}
        </span>
      </Button>
    </li>
  )
}

/**
 * v2 · Inicio del entrenador: monitor de entrenamiento. Arriba, el día en números y dos gráficos
 * (cómo se reparten hoy los alumnos y cuántos entrenaron cada día de la semana); abajo, alumno por
 * alumno con el avance de su entrenamiento de hoy. Sale de lo que cada alumno anota desde su link y
 * se actualiza solo cada 30 segundos. Sin rutinas activas no se muestra.
 */
export function TrainingMonitorCardV2({ ownerId, onOpenRoutine }: { ownerId: string; onOpenRoutine: (routineId: string) => void }) {
  const [showIdle, setShowIdle] = useState(false)
  const [filter, setFilter] = useState<MonitorState | null>(null)
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

  if (routinesQ.isPending || (routinesQ.data ?? []).length === 0 || logsQ.isPending) return null

  const counts = Object.fromEntries(ORDER.map((s) => [s, rows.filter((r) => r.state === s).length])) as Record<MonitorState, number>
  const total = rows.length
  const trainedToday = counts.live + counts.done + counts.deviated
  const shown = filter ? rows.filter((r) => r.state === filter) : rows.filter((r) => r.state !== 'idle')
  const idle = filter ? [] : rows.filter((r) => r.state === 'idle')

  return (
    <section aria-labelledby="monitor-entrenamiento" className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pt-3.5 sm:px-5">
        <h2 id="monitor-entrenamiento" className="text-sm font-semibold text-ink-primary">
          Hoy · alumnos
        </h2>
        <p className="flex items-center gap-2 text-xs text-ink-muted" aria-live="polite">
          {counts.live > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-ink-primary">
              <LiveDot />
              {counts.live} entrenando ahora
            </span>
          ) : null}
          <span>Actualizado {format(new Date(logsQ.dataUpdatedAt || now.getTime()), 'HH:mm')}</span>
        </p>
      </div>

      <div className="grid gap-x-8 gap-y-5 px-4 pb-4 pt-3 sm:px-5 md:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold leading-none tabular-nums tracking-tight text-ink-primary">{trainedToday}</span>
            <span className="text-sm text-ink-secondary">
              de {total} {trainedToday === 1 ? 'entrenó' : 'entrenaron'} hoy
            </span>
          </p>
          <TodayBar counts={counts} total={total} active={filter} onPick={setFilter} />
        </div>
        <WeekBars days={week} total={total} />
      </div>

      {shown.length === 0 ? (
        <p className="border-t border-surface-border/70 px-4 py-4 text-sm text-ink-muted sm:px-5">
          {filter ? 'Nadie en ese estado.' : 'Todavía nadie registró entrenamiento hoy. Aparecen acá a medida que anotan sus series.'}
        </p>
      ) : (
        <ul className="divide-y divide-surface-border/60 border-t border-surface-border/70">
          {shown.map((row) => (
            <Row key={row.routineId} row={row} onOpen={() => onOpenRoutine(row.routineId)} />
          ))}
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
                <Row key={row.routineId} row={row} onOpen={() => onOpenRoutine(row.routineId)} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
