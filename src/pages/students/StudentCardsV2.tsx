import { ArrowRight } from 'lucide-react'
import { StudentAvatar } from '@/components/students/StudentAvatar'
import { Button } from '@/components/ui/Button'
import { weekStatusOrEmpty } from '@/lib/checkIn/routineWeekProgress'
import type { LatestWeekStatus } from '@/lib/checkIn/latestWeekStatus'
import { effectivePaymentStatus } from '@/lib/studentPlanAssignments'
import { cn } from '@/lib/utils'
import type { Student, StudentPlanAssignment } from '@/types/database'

type Tile = { tone: string | null; value: string; hint: string }

const NEUTRAL = 'bg-surface-elevated/60'

/** Cómo viene la rutina: en qué semana está (según su último feedback) o si no tiene. */
function routineTile(hasRoutine: boolean, totalWeeks: number, w: LatestWeekStatus): Tile {
  if (!hasRoutine) return { tone: null, value: '—', hint: 'Sin rutina activa' }
  if (w.finished) return { tone: 'bg-pastel-rose text-pastel-rose-ink', value: 'Mes cerrado', hint: 'Armale la que sigue' }
  if (w.lastWeek) return { tone: 'bg-pastel-butter text-pastel-butter-ink', value: 'Última semana', hint: totalWeeks ? `de ${totalWeeks}` : 'de su rutina' }
  if (w.weekNumber && totalWeeks) return { tone: 'bg-pastel-mint text-pastel-mint-ink', value: `Semana ${w.weekNumber}`, hint: `de ${totalWeeks}` }
  return { tone: 'bg-pastel-lavender text-pastel-lavender-ink', value: totalWeeks ? `${totalWeeks} semanas` : 'Con rutina', hint: 'Todavía sin feedback' }
}

/** Plan contratado y cómo viene el pago. */
function planTile(plan: StudentPlanAssignment | undefined): Tile {
  if (!plan) return { tone: null, value: '—', hint: 'Sin plan' }
  const status = effectivePaymentStatus(plan)
  const name = plan.plan_name_snapshot
  if (status === 'overdue') return { tone: 'bg-pastel-rose text-pastel-rose-ink', value: 'Pago vencido', hint: name }
  if (status === 'pending') return { tone: 'bg-pastel-butter text-pastel-butter-ink', value: 'Pago pendiente', hint: name }
  if (status === 'cancelled') return { tone: null, value: 'Cancelado', hint: name }
  return { tone: 'bg-pastel-mint text-pastel-mint-ink', value: 'Al día', hint: name }
}

const STATUS_LABEL: Record<string, string> = { activo: 'Activo', inactivo: 'Inactivo', pausado: 'En pausa', suspendido: 'Suspendido' }

/** v2 · Alumnos en tarjetas: quién es, en qué semana de la rutina está y cómo viene su pago. */
export function StudentCardsV2({
  students,
  selectedStudentId,
  onOpen,
  onAvatarUpdated,
  activeRoutineStudentIds,
  weekByStudent,
  weeksByStudent,
  rmTestDueIds,
  currentPlanByStudent,
}: {
  students: Student[]
  selectedStudentId: string | null
  onOpen: (id: string) => void
  onAvatarUpdated: () => void
  activeRoutineStudentIds: Set<string>
  weekByStudent: Map<string, LatestWeekStatus>
  weeksByStudent: Map<string, number>
  rmTestDueIds: Set<string>
  currentPlanByStudent: Record<string, StudentPlanAssignment>
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {students.map((s) => {
        const routine = routineTile(activeRoutineStudentIds.has(s.id), weeksByStudent.get(s.id) ?? 0, weekStatusOrEmpty(weekByStudent, s.id))
        const plan = planTile(currentPlanByStudent[s.id])
        const active = s.status === 'activo'
        return (
          <li
            key={s.id}
            className={cn(
              'flex flex-col gap-3.5 rounded-2xl border bg-surface-card p-4 transition-colors',
              selectedStudentId === s.id ? 'border-ink-primary' : 'border-surface-border/60',
            )}
          >
            <div className="flex items-center gap-3">
              <StudentAvatar studentId={s.id} fullName={s.full_name} avatarPath={s.avatar_path ?? null} size="md2" stopRowNavigation onPathChange={() => onAvatarUpdated()} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold leading-snug text-ink-primary">{s.full_name}</p>
                <p className="truncate text-xs text-ink-muted">{s.email || s.phone || 'Sin contacto cargado'}</p>
              </div>
              <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-xs font-medium', active ? 'bg-status-ok/15 text-status-ok-ink' : 'bg-surface-elevated text-ink-muted')}>
                {STATUS_LABEL[s.status ?? ''] ?? s.status ?? '—'}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-2">
              {(
                [
                  ['Rutina', routine],
                  ['Plan y pago', plan],
                ] as const
              ).map(([label, t]) => (
                <div key={label} className={cn('min-w-0 rounded-xl px-3 py-2.5', t.tone ? cn('hh-pastel', t.tone) : NEUTRAL)}>
                  <dt className={cn('text-xs', t.tone ? 'opacity-80' : 'text-ink-muted')}>{label}</dt>
                  <dd className={cn('truncate text-lg font-semibold leading-tight tabular-nums', !t.tone && 'text-ink-primary')}>{t.value}</dd>
                  <dd className={cn('truncate text-xs', t.tone ? 'opacity-80' : 'text-ink-muted')} title={t.hint}>
                    {t.hint}
                  </dd>
                </div>
              ))}
            </dl>

            {rmTestDueIds.has(s.id) ? (
              <p className="hh-pastel -mt-1 rounded-lg bg-pastel-butter px-2.5 py-1.5 text-xs font-medium text-pastel-butter-ink" title="12 semanas de rutina desde el último test de RM">
                Toca testear RM
              </p>
            ) : null}

            <Button type="button" variant="secondary" size="sm" className="mt-auto w-full" icon={<ArrowRight className="h-3.5 w-3.5" />} iconPosition="right" onClick={() => onOpen(s.id)}>
              Abrir ficha
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
