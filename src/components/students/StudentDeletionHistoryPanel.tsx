import { useCallback, useEffect, useState } from 'react'
import { Archive, RotateCcw } from 'lucide-react'
import { fetchStudentDeletionLog, restoreDeletedStudent } from '@/lib/students/studentAccess'
import { StudentAvatarThumb } from '@/lib/studentAvatar'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { useAuthStore } from '@/stores/authStore'
import { formatDate, cn } from '@/lib/utils'
import type { StudentDeletionLogEntry } from '@/types/database'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import toast from 'react-hot-toast'

const LEVEL_LABELS: Record<string, string> = {
  inicial: 'Inicial',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

function calcAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null
  const today = new Date()
  const bd = new Date(birthDate + 'T00:00:00')
  let age = today.getFullYear() - bd.getFullYear()
  const m = today.getMonth() - bd.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--
  return age >= 0 && age < 120 ? age : null
}

function statusPillClass(status: string | null) {
  if (status === 'activo') return 'border-status-generated/30 bg-status-generated/10 text-status-generated'
  if (status === 'inactivo' || status === 'baja') return 'border-surface-border/60 bg-surface-elevated text-ink-muted'
  if (status === 'pausado') return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return 'border-surface-border/60 bg-surface-elevated text-ink-secondary'
}

type Props = {
  entityLabel: string
  entityLabelSingular: string
  entityLabelColumn?: string
  onRestored?: (studentId: string) => void
}

export function StudentDeletionHistoryPanel({
  entityLabel,
  entityLabelSingular,
  entityLabelColumn,
  onRestored,
}: Props) {
  const navigate = useAppNavigate()
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.profile?.role)
  const columnLabel = entityLabelColumn ?? (entityLabelSingular === 'paciente' ? 'Paciente' : 'Alumno')

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<StudentDeletionLogEntry[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<StudentDeletionLogEntry | null>(null)
  const [restoring, setRestoring] = useState(false)

  const loadRows = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setLoadError(null)
    const { data, error } = await fetchStudentDeletionLog({ userId: user.id, role })
    if (error) {
      setLoadError(error)
      toast.error(error)
    }
    setRows(data)
    setLoading(false)
  }, [user, role])

  useEffect(() => {
    if (!open) return
    void loadRows()
  }, [open, loadRows])

  async function handleRestore() {
    if (!restoreTarget || !user) return
    setRestoring(true)
    const { studentId, error } = await restoreDeletedStudent(restoreTarget.id, {
      userId: user.id,
      role,
    })
    setRestoring(false)
    if (error || !studentId) {
      toast.error(error ?? 'No se pudo restaurar')
      return
    }
    toast.success(`${entityLabelSingular.charAt(0).toUpperCase()}${entityLabelSingular.slice(1)} restaurado`)
    setRestoreTarget(null)
    setRows((prev) => prev.filter((r) => r.id !== restoreTarget.id))
    onRestored?.(studentId)
    const detailPath = role === 'nutritionist' ? `/nutrition/${studentId}` : `/students/${studentId}`
    navigate(detailPath)
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        size="sm"
        variant="outline"
        icon={<Archive className="h-4 w-4" />}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? 'Ocultar eliminados' : 'Ver eliminados'}
      </Button>

      {open ? (
        <section className="overflow-hidden rounded-2xl border border-surface-border/80 bg-surface-card shadow-card">
          <div className="flex flex-col gap-2 border-b border-surface-border/70 bg-surface-elevated/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight text-ink-primary">{entityLabel} eliminados</h2>
              <p className="text-[11px] text-ink-muted">
                Restaurar recupera la ficha básica. Rutinas, mediciones y archivos no vuelven.
              </p>
            </div>
            {!loading && !loadError ? (
              <span className="inline-flex items-center rounded-full border border-surface-border/70 bg-surface-card px-2.5 py-1 text-[11px] font-semibold tabular-nums text-ink-secondary">
                {rows.length === 1 ? '1 registro' : `${rows.length} registros`}
              </span>
            ) : null}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size="md" accent="trainerCta" />
            </div>
          ) : loadError ? (
            <p className="px-4 py-10 text-center text-sm text-status-expired">{loadError}</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-ink-muted">
              No hay {entityLabelSingular}s eliminados en tu historial.
            </p>
          ) : (
            <div className="max-h-[min(40vh,20rem)] overflow-auto">
              <table className="w-full border-collapse text-[13px] leading-snug">
                <thead className="sticky top-0 z-[1] border-b border-surface-border/70 bg-surface-card/92 backdrop-blur-md">
                  <tr className="text-left">
                    <th
                      scope="col"
                      className="whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-5"
                    >
                      {columnLabel}
                    </th>
                    <th
                      scope="col"
                      className="hidden whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:table-cell sm:px-5"
                    >
                      Nivel
                    </th>
                    <th
                      scope="col"
                      className="whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-5"
                    >
                      Estado
                    </th>
                    <th
                      scope="col"
                      className="whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-5"
                    >
                      Eliminado
                    </th>
                    <th
                      scope="col"
                      className="hidden whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted lg:table-cell lg:px-5"
                    >
                      Por
                    </th>
                    <th
                      scope="col"
                      className="hidden whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted lg:table-cell lg:px-5"
                    >
                      Email
                    </th>
                    <th scope="col" className="w-[7.5rem]" aria-hidden />
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/70 bg-surface-card">
                  {rows.map((row) => {
                    const age = calcAge(row.birth_date)
                    const showRestore = Boolean(row.can_restore)
                    return (
                      <tr key={row.id} className="group transition-colors hover:bg-surface-elevated/35">
                        <td className="px-4 py-2.5 sm:px-5">
                          <div className="flex items-center gap-2">
                            <StudentAvatarThumb
                              storagePath={row.avatar_path ?? null}
                              name={row.full_name}
                              className="h-6 w-6 shrink-0 rounded-full text-[10px]"
                            />
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="min-w-0 truncate text-[13px] font-semibold leading-snug text-ink-primary">
                                  {row.full_name}
                                </span>
                                {age !== null ? (
                                  <span className="shrink-0 text-[11px] text-ink-muted tabular-nums">{age}a</span>
                                ) : null}
                              </div>
                              {row.phone ? (
                                <span className="truncate text-[11px] text-ink-muted lg:hidden">{row.phone}</span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="hidden text-ink-secondary sm:table-cell sm:px-5 sm:py-2.5">
                          <span className="text-[12px]">
                            {row.level ? (LEVEL_LABELS[row.level] ?? row.level) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 sm:px-5">
                          {row.status ? (
                            <span
                              className={cn(
                                'inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold capitalize',
                                statusPillClass(row.status),
                              )}
                            >
                              {row.status}
                            </span>
                          ) : (
                            <span className="text-[11px] text-ink-muted/50">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-ink-secondary whitespace-nowrap sm:px-5">
                          <span className="text-[12px] tabular-nums">
                            {formatDate(row.deleted_at, 'dd/MM/yyyy HH:mm')}
                          </span>
                        </td>
                        <td className="hidden max-w-[10rem] truncate text-ink-muted lg:table-cell lg:px-5 lg:py-2.5">
                          <span className="text-[12px]">{row.deleted_by_name ?? '—'}</span>
                        </td>
                        <td className="hidden max-w-[12rem] truncate text-ink-muted lg:table-cell lg:max-w-none lg:px-5 lg:py-2.5">
                          <span className="text-[12px]">{row.email ?? '—'}</span>
                        </td>
                        <td className="px-2 py-2.5 sm:px-3">
                          <div className="flex items-center justify-end">
                            {showRestore ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                icon={<RotateCcw className="h-3.5 w-3.5" />}
                                className="opacity-100 sm:opacity-90 sm:group-hover:opacity-100"
                                onClick={() => setRestoreTarget(row)}
                              >
                                Restaurar
                              </Button>
                            ) : (
                              <span
                                className="px-2 text-[10px] text-ink-muted"
                                title="Solo el entrenador dueño puede restaurar"
                              >
                                —
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <ConfirmDialog
        open={!!restoreTarget}
        onClose={() => !restoring && setRestoreTarget(null)}
        onConfirm={() => void handleRestore()}
        title={`¿Restaurar a ${restoreTarget?.full_name}?`}
        description={`Se recreará la ficha del ${entityLabelSingular} con los datos guardados al eliminarlo. Rutinas, mediciones, planes y archivos no se recuperan.`}
        confirmLabel="Restaurar ficha"
        variant="warning"
        loading={restoring}
      />
    </div>
  )
}
