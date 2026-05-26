import { useCallback, useEffect, useState } from 'react'
import { Archive, RotateCcw } from 'lucide-react'
import { fetchRoutineDeletionLog, restoreDeletedRoutine } from '@/lib/routines/routineAccess'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { useAuthStore } from '@/stores/authStore'
import { formatDate, cn } from '@/lib/utils'
import type { RoutineDeletionLogEntry } from '@/types/database'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import toast from 'react-hot-toast'

const LEVEL_LABELS: Record<string, string> = {
  inicial: 'Inicial',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

type Props = {
  onRestored?: () => void
}

export function RoutineDeletionHistoryPanel({ onRestored }: Props) {
  const navigate = useAppNavigate()
  const user = useAuthStore((s) => s.user)

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<RoutineDeletionLogEntry[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<RoutineDeletionLogEntry | null>(null)
  const [restoring, setRestoring] = useState(false)

  const loadRows = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setLoadError(null)
    const { data, error } = await fetchRoutineDeletionLog({ userId: user.id })
    if (error) {
      setLoadError(error)
      toast.error(error)
    }
    setRows(data)
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (!open) return
    void loadRows()
  }, [open, loadRows])

  async function handleRestore() {
    if (!restoreTarget) return
    setRestoring(true)
    const { routineId, error } = await restoreDeletedRoutine(restoreTarget.id)
    setRestoring(false)
    if (error || !routineId) {
      toast.error(error ?? 'No se pudo restaurar la rutina')
      return
    }
    toast.success('Rutina restaurada')
    setRestoreTarget(null)
    setRows((prev) => prev.filter((r) => r.id !== restoreTarget.id))
    onRestored?.()
    navigate(`/routines/${routineId}`)
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted hover:text-ink-primary transition-colors"
      >
        <Archive className="h-3.5 w-3.5 opacity-70" aria-hidden />
        {open ? 'Ocultar eliminadas' : 'Ver rutinas eliminadas'}
      </button>

      {open ? (
        <section className="overflow-hidden rounded-2xl border border-surface-border/80 bg-surface-card shadow-card">
          <div className="flex flex-col gap-2 border-b border-surface-border/70 bg-surface-elevated/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight text-ink-primary">Rutinas eliminadas</h2>
              <p className="text-[11px] text-ink-muted">
                Restaurar recupera la rutina con todos sus bloques, días y ejercicios. Solo si el alumno sigue activo.
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => void loadRows()} disabled={loading}>
              Actualizar
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : loadError ? (
            <p className="px-4 py-6 text-sm text-status-expired">{loadError}</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-muted">No hay rutinas eliminadas recientes.</p>
          ) : (
            <ul className="divide-y divide-surface-border/70">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink-primary truncate">{row.routine_name}</p>
                    <p className="text-xs text-ink-secondary truncate">
                      {row.student_name ?? 'Alumno'}
                      {row.level ? ` · ${LEVEL_LABELS[row.level] ?? row.level}` : ''}
                      {row.start_date && row.end_date
                        ? ` · ${formatDate(row.start_date)} – ${formatDate(row.end_date)}`
                        : ''}
                    </p>
                    <p className="text-[10px] text-ink-muted">
                      Eliminada {formatDate(row.deleted_at)}
                      {row.deleted_by_name ? ` · por ${row.deleted_by_name}` : ''}
                    </p>
                  </div>
                  {row.can_restore !== false ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}
                      onClick={() => setRestoreTarget(row)}
                      className={cn('shrink-0')}
                    >
                      Restaurar
                    </Button>
                  ) : (
                    <span className="text-[11px] text-ink-muted shrink-0">Alumno no disponible</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <ConfirmDialog
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => void handleRestore()}
        title="¿Restaurar rutina?"
        description={
          restoreTarget
            ? `Se restaurará "${restoreTarget.routine_name}" de ${restoreTarget.student_name ?? 'el alumno'} con todos sus ejercicios.`
            : ''
        }
        confirmLabel="Sí, restaurar"
        loading={restoring}
      />
    </div>
  )
}
