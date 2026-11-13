import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { FolderOpen } from 'lucide-react'
import { StudentAvatar } from '@/components/students/StudentAvatar'
import { Button } from '@/components/ui/Button'
import { cn, formatNumber } from '@/lib/utils'
import { formatNextConsult, type NutritionFollowupRow } from './NutritionPatientDirectory'

const TONE = {
  past: 'bg-pastel-rose text-pastel-rose-ink',
  soon: 'bg-pastel-mint text-pastel-mint-ink',
  far: 'bg-pastel-sky text-pastel-sky-ink',
  none: '',
} as const

const STATUS: Record<keyof typeof TONE, string> = { past: 'Atrasado', soon: 'Esta semana', far: 'Con turno', none: 'Sin turno' }

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
              <span
                className={cn(
                  'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
                  next.tone === 'none' ? 'bg-surface-elevated text-ink-muted' : cn('hh-pastel', TONE[next.tone]),
                )}
              >
                {STATUS[next.tone]}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-2">
              <div className={cn('rounded-xl px-3 py-2.5', next.tone === 'none' ? 'bg-surface-elevated/60' : cn('hh-pastel', TONE[next.tone]))}>
                <dt className={cn('text-xs', next.tone === 'none' ? 'text-ink-muted' : 'opacity-80')}>Próximo turno</dt>
                <dd className={cn('text-lg font-semibold leading-tight tabular-nums', next.tone === 'none' && 'text-ink-primary')}>
                  {nextDate ? shortDay(nextDate) : '—'}
                </dd>
                <dd className={cn('truncate text-xs', next.tone === 'none' ? 'text-ink-muted' : 'opacity-80')}>{nextDate ? next.sub : 'Sin agendar'}</dd>
              </div>
              <div className={cn('rounded-xl px-3 py-2.5', c ? 'hh-pastel bg-pastel-lavender text-pastel-lavender-ink' : 'bg-surface-elevated/60')}>
                <dt className={cn('text-xs', c ? 'opacity-80' : 'text-ink-muted')}>Último control</dt>
                <dd className={cn('text-lg font-semibold leading-tight tabular-nums', !c && 'text-ink-primary')}>
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
                <dd className={cn('truncate text-xs', c ? 'opacity-80' : 'text-ink-muted')}>
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
