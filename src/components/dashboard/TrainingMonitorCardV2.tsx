import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TONE_TINT } from '@/components/v2/ui'
import { supabase } from '@/lib/supabase'
import { buildTrainingMonitor, loadMonitorLogs, loadMonitorRoutines, monitorFeed, monitorSummary, weekActivity, weekMatrix } from '@/lib/routine/trainingMonitor'
import { cn } from '@/lib/utils'

/** Cada cuánto se vuelve a preguntar qué anotaron los alumnos (tarjeta del Inicio). */
const REFRESH_MS = 30_000
/** En la pantalla del monitor se pregunta más seguido, por si el aviso instantáneo no está habilitado. */
export const MONITOR_FAST_REFRESH_MS = 10_000

export const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? full

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn('relative flex h-2 w-2', className)} aria-hidden>
      <span className="absolute inline-flex h-full w-full rounded-full bg-status-ok opacity-60 motion-safe:animate-ping" />
      <span className="relative inline-flex h-full w-full rounded-full bg-status-ok" />
    </span>
  )
}

/**
 * Datos del monitor (rutinas activas + lo anotado), compartidos por la pantalla y la tarjeta del Inicio.
 *
 * Tiempo real: se suscribe a los cambios de `routine_exercise_logs` y `routine_day_logs`; cada aviso
 * vuelve a pedir los datos al instante. Si esas tablas no están publicadas para tiempo real (falta la
 * migración 20261118120000_training_monitor_realtime.sql) no llega ningún aviso y queda el refresco
 * periódico, que en la pantalla del monitor es cada 10 segundos.
 */
export function useTrainingMonitor(ownerId: string, opts: { refreshMs?: number; realtime?: boolean } = {}) {
  const refreshMs = opts.refreshMs ?? REFRESH_MS
  const queryClient = useQueryClient()
  // El reloj avanza solo: así «entrenando ahora» caduca aunque no lleguen datos nuevos.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), Math.min(refreshMs, 15_000))
    return () => window.clearInterval(id)
  }, [refreshMs])

  const routinesQ = useQuery({
    queryKey: ['v2', 'training-monitor-routines', ownerId],
    staleTime: 5 * 60_000,
    queryFn: () => loadMonitorRoutines(ownerId),
  })
  const routineIds = useMemo(() => (routinesQ.data ?? []).map((r) => r.id).sort(), [routinesQ.data])
  const logsKey = useMemo(() => ['v2', 'training-monitor-logs', ownerId, routineIds.join(',')], [ownerId, routineIds])
  const logsQ = useQuery({
    queryKey: logsKey,
    enabled: routineIds.length > 0,
    refetchInterval: refreshMs,
    refetchOnWindowFocus: true,
    queryFn: () => loadMonitorLogs(routineIds),
  })

  // Aviso instantáneo: cada serie o cierre que guarda un alumno dispara un pedido de datos.
  const [pushed, setPushed] = useState(false)
  useEffect(() => {
    if (!opts.realtime || routineIds.length === 0) return
    let timer: number | null = null
    const bump = () => {
      setPushed(true)
      // Varias series seguidas → un solo pedido.
      if (timer == null)
        timer = window.setTimeout(() => {
          timer = null
          void queryClient.invalidateQueries({ queryKey: logsKey })
        }, 400)
    }
    const channel = supabase
      .channel(`training-monitor-${ownerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'routine_exercise_logs' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'routine_day_logs' }, bump)
      .subscribe()
    return () => {
      if (timer != null) window.clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [opts.realtime, ownerId, routineIds.length, logsKey, queryClient])

  const input = useMemo(
    () => ({ routines: routinesQ.data ?? [], setLogs: logsQ.data?.setLogs ?? [], dayLogs: logsQ.data?.dayLogs ?? [], now }),
    [routinesQ.data, logsQ.data, now],
  )
  const rows = useMemo(() => buildTrainingMonitor(input), [input])
  const week = useMemo(() => weekActivity(input), [input])
  const matrix = useMemo(() => weekMatrix(input), [input])
  const feed = useMemo(() => monitorFeed(input), [input])
  const summary = useMemo(() => monitorSummary({ rows, setLogs: input.setLogs, now: input.now }), [rows, input])
  const empty = !routinesQ.isPending && (routinesQ.data ?? []).length === 0
  return {
    rows,
    week,
    matrix,
    feed,
    summary,
    now,
    updatedAt: logsQ.dataUpdatedAt || now.getTime(),
    /** true cuando ya llegó al menos un aviso instantáneo en esta visita. */
    pushed,
    loading: routinesQ.isPending || (!empty && logsQ.isPending),
    empty,
  }
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
