import { format, parseISO } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StudentAvatar } from '@/components/students/StudentAvatar'
import { cn } from '@/lib/utils'
import type { NutritionAttendanceStatus, NutritionPatientFollowup, Student } from '@/types/database'

export type NutritionFollowupRow = Student & { followup?: NutritionPatientFollowup }

const STATUS_OPTIONS: NutritionAttendanceStatus[] = ['P', 'A', 'ST']

export const ATTENDANCE_LABELS: Record<NutritionAttendanceStatus, string> = {
  P: 'Asistió',
  A: 'No asistió',
  ST: 'Sin turno',
}

export const ATTENDANCE_PILLS: Record<NutritionAttendanceStatus, string> = {
  P: 'bg-status-generated/12 text-status-generated border-status-generated/25',
  A: 'bg-status-expired/12 text-status-expired border-status-expired/25',
  ST: 'bg-surface-elevated text-ink-secondary border-surface-border/60',
}

export function NutritionPatientMobileList({
  rows,
  nextConsultLabel,
  onOpen,
  onUpdateFollowup,
  onAvatarChange,
}: {
  rows: NutritionFollowupRow[]
  nextConsultLabel: (value: string | null) => { label: string; sub: string; tone: 'soon' | 'past' | 'far' | 'none' }
  onOpen: (id: string) => void
  onUpdateFollowup: (studentId: string, patch: Partial<NutritionPatientFollowup>) => void
  onAvatarChange: (studentId: string, avatarPath: string | null) => void
}) {
  return (
    <div className="sm:hidden divide-y divide-surface-border/60">
      {rows.map((row) => {
        const next = nextConsultLabel(row.followup?.next_consultation_date ?? null)
        return (
          <div
            key={row.id}
            className="px-4 py-3 space-y-2.5 hover:bg-surface-elevated/30 transition-colors"
            onClick={() => onOpen(row.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onOpen(row.id)
            }}
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center gap-3">
              <StudentAvatar
                studentId={row.id}
                fullName={row.full_name}
                avatarPath={row.avatar_path}
                size="md2"
                stopRowNavigation
                onPathChange={(path) => onAvatarChange(row.id, path)}
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-body-sm text-ink-primary truncate">{row.full_name}</p>
                {next.tone !== 'none' ? (
                  <p
                    className={cn(
                      'text-caption font-medium mt-0.5',
                      next.tone === 'soon' && 'text-status-active',
                      next.tone === 'past' && 'text-status-expired',
                      next.tone === 'far' && 'text-ink-muted',
                    )}
                  >
                    Próx.: {next.label} · {next.sub}
                  </p>
                ) : (
                  <p className="text-caption text-ink-muted mt-0.5">Sin próximo turno</p>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0"
                icon={<ChevronRight className="h-4 w-4" />}
                iconPosition="right"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpen(row.id)
                }}
              >
                Abrir
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
              <label className="text-caption text-ink-muted">
                Última
                <input
                  type="date"
                  value={row.followup?.last_consultation_date ?? ''}
                  onChange={(e) =>
                    onUpdateFollowup(row.id, { last_consultation_date: e.target.value || null })
                  }
                  className="mt-1 w-full rounded-lg px-2 py-1.5 border border-surface-border bg-surface-input text-ink-primary text-caption"
                />
              </label>
              <label className="text-caption text-ink-muted">
                Próxima
                <input
                  type="date"
                  value={row.followup?.next_consultation_date ?? ''}
                  onChange={(e) =>
                    onUpdateFollowup(row.id, { next_consultation_date: e.target.value || null })
                  }
                  className="mt-1 w-full rounded-lg px-2 py-1.5 border border-surface-border bg-surface-input text-ink-primary text-caption"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
              {STATUS_OPTIONS.map((s) => {
                const active = (row.followup?.attendance_status ?? 'ST') === s
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onUpdateFollowup(row.id, { attendance_status: s })}
                    className={cn(
                      'text-caption font-medium px-2.5 py-1 rounded-md border transition-colors',
                      active ? ATTENDANCE_PILLS[s] : 'border-surface-border/60 text-ink-muted',
                    )}
                  >
                    {ATTENDANCE_LABELS[s]}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function NutritionPatientDesktopTable({
  rows,
  nextConsultLabel,
  onOpen,
  onUpdateFollowup,
  onAvatarChange,
}: {
  rows: NutritionFollowupRow[]
  nextConsultLabel: (value: string | null) => { label: string; sub: string; tone: 'soon' | 'past' | 'far' | 'none' }
  onOpen: (id: string) => void
  onUpdateFollowup: (studentId: string, patch: Partial<NutritionPatientFollowup>) => void
  onAvatarChange: (studentId: string, avatarPath: string | null) => void
}) {
  return (
    <div className="hidden sm:block overflow-x-auto">
      <table className="w-full text-body-sm border-collapse min-w-[800px]">
        <thead>
          <tr className="border-b border-surface-border bg-surface-elevated/30">
            <th className="text-left px-4 py-3 text-table-head font-semibold text-ink-muted uppercase">
              Paciente
            </th>
            <th className="text-left px-4 py-3 text-table-head font-semibold text-ink-muted uppercase">
              Última consulta
            </th>
            <th className="text-left px-4 py-3 text-table-head font-semibold text-ink-muted uppercase">
              Próxima consulta
            </th>
            <th className="text-left px-4 py-3 text-table-head font-semibold text-ink-muted uppercase min-w-[10rem]">
              Estado
            </th>
            <th className="text-right px-4 py-3 text-table-head font-semibold text-ink-muted uppercase w-[1%] whitespace-nowrap">
              Acción
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const next = nextConsultLabel(row.followup?.next_consultation_date ?? null)
            return (
              <tr
                key={row.id}
                className={cn(
                  'hover:bg-surface-elevated/30 transition-colors cursor-pointer',
                  index < rows.length - 1 && 'border-b border-surface-border',
                )}
                onClick={() => onOpen(row.id)}
              >
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <StudentAvatar
                      studentId={row.id}
                      fullName={row.full_name}
                      avatarPath={row.avatar_path}
                      size="md2"
                      stopRowNavigation
                      onPathChange={(path) => onAvatarChange(row.id, path)}
                    />
                    <span className="font-semibold text-ink-primary hover:text-brand-primary truncate">
                      {row.full_name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="date"
                    value={row.followup?.last_consultation_date ?? ''}
                    onChange={(e) =>
                      onUpdateFollowup(row.id, { last_consultation_date: e.target.value || null })
                    }
                    className="w-full bg-surface-input text-ink-primary rounded-lg px-2.5 py-1.5 border border-surface-border focus:border-brand-primary outline-none text-caption"
                  />
                </td>
                <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col gap-1">
                    <input
                      type="date"
                      value={row.followup?.next_consultation_date ?? ''}
                      onChange={(e) =>
                        onUpdateFollowup(row.id, { next_consultation_date: e.target.value || null })
                      }
                      className="w-full bg-surface-input text-ink-primary rounded-lg px-2.5 py-1.5 border border-surface-border focus:border-brand-primary outline-none text-caption"
                    />
                    {next.tone !== 'none' ? (
                      <span
                        className={cn(
                          'text-caption font-medium',
                          next.tone === 'soon' && 'text-status-active',
                          next.tone === 'past' && 'text-status-expired',
                          next.tone === 'far' && 'text-ink-muted',
                        )}
                      >
                        {next.sub}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-wrap gap-1">
                    {STATUS_OPTIONS.map((s) => {
                      const active = (row.followup?.attendance_status ?? 'ST') === s
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => onUpdateFollowup(row.id, { attendance_status: s })}
                          className={cn(
                            'text-caption font-medium px-2.5 py-1 rounded-md border transition-colors',
                            active ? ATTENDANCE_PILLS[s] : 'border-surface-border/60 text-ink-muted',
                          )}
                        >
                          {ATTENDANCE_LABELS[s]}
                        </button>
                      )
                    })}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="whitespace-nowrap"
                    icon={<ChevronRight className="h-4 w-4" />}
                    iconPosition="right"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpen(row.id)
                    }}
                  >
                    Abrir
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function formatNextConsult(value: string | null): {
  label: string
  sub: string
  tone: 'soon' | 'past' | 'far' | 'none'
} {
  if (!value) return { label: '—', sub: 'Sin turno', tone: 'none' }
  const date = parseISO(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  const label = format(date, 'dd/MM/yyyy')
  let sub = format(date, 'EEEE')
  sub = sub.charAt(0).toUpperCase() + sub.slice(1)
  if (days < 0) return { label, sub: `${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'} atrás`, tone: 'past' }
  if (days === 0) return { label, sub: 'Hoy', tone: 'soon' }
  if (days <= 7) return { label, sub: `En ${days} día${days === 1 ? '' : 's'}`, tone: 'soon' }
  return { label, sub, tone: 'far' }
}
