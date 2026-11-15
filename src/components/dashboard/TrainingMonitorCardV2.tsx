import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AvatarV2, TONE_TINT } from '@/components/v2/ui'
import { buildTrainingMonitor, loadMonitorLogs, loadMonitorRoutines, type MonitorRow, type MonitorState } from '@/lib/routine/trainingMonitor'
import { cn } from '@/lib/utils'

/** Cada cuánto se vuelve a preguntar qué anotaron los alumnos. */
const REFRESH_MS = 30_000

const LABEL: Record<MonitorState, string> = {
  live: 'Entrenando ahora',
  deviated: 'Con desvíos',
  missed: 'No entrenó',
  done: 'Entrenó',
  idle: 'Sin registro hoy',
}
const CHIP: Record<MonitorState, string> = {
  live: 'bg-status-ok/15 text-status-ok-ink',
  deviated: TONE_TINT.butter,
  missed: TONE_TINT.rose,
  done: 'bg-surface-elevated text-ink-secondary',
  idle: 'text-ink-muted',
}

function Row({ row, onOpen }: { row: MonitorRow; onOpen: () => void }) {
  return (
    <li>
      <Button type="button" variant="ghost" onClick={onOpen} className="h-auto w-full whitespace-normal rounded-none px-4 py-2.5 text-left font-normal sm:px-5 [&>span]:w-full [&>span]:min-w-0">
        {/* El botón envuelve su contenido en un span que no se estira: `[&>span]:w-full` lo lleva de borde a borde. */}
        <span className="flex w-full min-w-0 items-center gap-3">
          <AvatarV2 name={row.studentName} path={row.avatarPath} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink-primary">{row.studentName}</span>
            <span className="block text-xs text-ink-muted sm:truncate">{[row.dayLabel, row.detail].filter(Boolean).join(' · ')}</span>
          </span>
          <span className={cn('inline-flex shrink-0 items-center gap-1.5 self-start rounded-md px-2 py-0.5 text-xs font-medium sm:self-center', CHIP[row.state])}>
            {row.state === 'live' ? (
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full rounded-full bg-status-ok opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-status-ok" />
              </span>
            ) : null}
            {LABEL[row.state]}
          </span>
        </span>
      </Button>
    </li>
  )
}

/**
 * v2 · Inicio del entrenador: monitor de entrenamiento. Quién está entrenando ahora, quién ya entrenó
 * (y si se desvió del plan) y quién avisó que no entrena, según lo que cada alumno anota desde su link.
 * Se actualiza solo cada 30 segundos. Sin rutinas activas no se muestra.
 */
export function TrainingMonitorCardV2({ ownerId, onOpenRoutine }: { ownerId: string; onOpenRoutine: (routineId: string) => void }) {
  const [showIdle, setShowIdle] = useState(false)
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

  const rows = useMemo(
    () => buildTrainingMonitor({ routines: routinesQ.data ?? [], setLogs: logsQ.data?.setLogs ?? [], dayLogs: logsQ.data?.dayLogs ?? [], now }),
    [routinesQ.data, logsQ.data, now],
  )

  if (routinesQ.isPending || (routinesQ.data ?? []).length === 0 || logsQ.isPending) return null

  const today = rows.filter((r) => r.state !== 'idle')
  const idle = rows.filter((r) => r.state === 'idle')
  const live = today.filter((r) => r.state === 'live').length

  return (
    <section aria-labelledby="monitor-entrenamiento" className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
        <h2 id="monitor-entrenamiento" className="text-sm font-semibold text-ink-primary">
          Hoy · alumnos
        </h2>
        <p className="text-xs text-ink-muted" aria-live="polite">
          {live > 0 ? `${live} entrenando ahora · ` : ''}
          Actualizado {format(new Date(logsQ.dataUpdatedAt || now.getTime()), 'HH:mm')}
        </p>
      </div>

      {today.length === 0 ? (
        <p className="border-t border-surface-border/70 px-4 py-4 text-sm text-ink-muted sm:px-5">
          Todavía nadie registró entrenamiento hoy. Aparecen acá a medida que anotan sus series.
        </p>
      ) : (
        <ul className="divide-y divide-surface-border/60 border-t border-surface-border/70">
          {today.map((row) => (
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
