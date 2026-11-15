import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { FolderOpen } from 'lucide-react'
import { StudentAvatar } from '@/components/students/StudentAvatar'
import { Button } from '@/components/ui/Button'
import { TONE_TINT } from '@/components/v2/ui'
import { NUTRITION_CONTROL_OVERDUE_DAYS } from '@/lib/dashboard/nutritionistOps'
import { cn, formatNumber } from '@/lib/utils'
import { formatNextConsult, type NutritionFollowupRow } from './NutritionPatientDirectory'

const shortDay = (iso: string) => format(parseISO(iso), 'd MMM', { locale: es })

/** v2 · Pacientes en tarjetas: quién es, cuándo viene y cómo salió su último control. */
export function NutritionPatientGridV2({
  rows,
  selectedPatientId = null,
  onOpen,
  onAvatarChange,
}: {
  rows: NutritionFollowupRow[]
  selectedPatientId?: string | null
  onOpen: (id: string) => void
  onAvatarChange: (studentId: string, avatarPath: string | null) => void
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => {
        const nextDate = row.followup?.next_consultation_date ?? null
        const next = formatNextConsult(nextDate)
        const c = row.lastControl
        const controlDays = c ? differenceInCalendarDays(new Date(), parseISO(c.date)) : null
        // Color solo cuando hay algo para resolver: turno atrasado o control vencido.
        const late = next.tone === 'past'
        const controlOverdue = controlDays != null && controlDays > NUTRITION_CONTROL_OVERDUE_DAYS
        const delta = c?.weightDelta != null && Math.abs(c.weightDelta) >= 0.05 ? c.weightDelta : null
        return (
          <li
            key={row.id}
            className={cn(
              'flex flex-col gap-3.5 rounded-2xl border bg-surface-card p-4 transition-colors',
              selectedPatientId === row.id ? 'border-ink-primary' : 'border-surface-border/60',
            )}
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
                <p className="truncate text-base font-semibold leading-snug text-ink-primary">{row.full_name}</p>
                <p className="truncate text-xs text-ink-muted">
                  {row.followup?.last_consultation_date ? `Última consulta: ${shortDay(row.followup.last_consultation_date)}` : 'Todavía sin consultas'}
                </p>
              </div>
              {late ? <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-xs font-medium', TONE_TINT.rose)}>Atrasado</span> : null}
            </div>

            <dl className="grid grid-cols-2 gap-2">
              <div className={cn('rounded-xl px-3 py-2.5', late ? TONE_TINT.rose : 'bg-surface-elevated/60')}>
                <dt className={cn('text-xs', late ? 'opacity-80' : 'text-ink-muted')}>Próximo turno</dt>
                <dd className={cn('text-lg font-semibold leading-tight tabular-nums', !late && 'text-ink-primary')}>{nextDate ? shortDay(nextDate) : '—'}</dd>
                <dd className={cn('truncate text-xs', late ? 'opacity-80' : 'text-ink-muted')}>{nextDate ? next.sub : 'Sin agendar'}</dd>
              </div>
              <div className={cn('rounded-xl px-3 py-2.5', controlOverdue ? TONE_TINT.butter : 'bg-surface-elevated/60')}>
                <dt className={cn('text-xs', controlOverdue ? 'opacity-80' : 'text-ink-muted')}>Último control</dt>
                <dd className={cn('text-lg font-semibold leading-tight tabular-nums', !controlOverdue && 'text-ink-primary')}>
                  {c?.weight != null ? (
                    <>
                      {formatNumber(c.weight)}
                      <span className="ml-1 text-xs font-normal opacity-80">kg</span>
                    </>
                  ) : c ? (
                    shortDay(c.date)
                  ) : (
                    '—'
                  )}
                </dd>
                <dd className={cn('truncate text-xs', controlOverdue ? 'opacity-80' : 'text-ink-muted')}>
                  {!c
                    ? 'Sin controles'
                    : `${delta != null ? `${delta > 0 ? '+' : '−'}${formatNumber(Math.abs(delta))} kg · ` : ''}${
                        controlDays === 0 ? 'hoy' : controlDays === 1 ? 'ayer' : `hace ${controlDays} días`
                      }`}
                </dd>
              </div>
            </dl>

            <Button type="button" variant="secondary" size="sm" className="w-full" icon={<FolderOpen className="h-3.5 w-3.5" />} onClick={() => onOpen(row.id)}>
              Abrir carpeta
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
