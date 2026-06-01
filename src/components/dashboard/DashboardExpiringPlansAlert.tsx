import { useEffect, useState } from 'react'
import { CalendarX, ChevronDown } from 'lucide-react'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { cn } from '@/lib/utils'
import { BILLING_PERIOD_LABELS, daysBetween, fetchAssignmentsExpiringSoon, todayISO } from '@/lib/studentPlanAssignments'
import type { StudentPlanAssignment } from '@/types/database'

type Props = {
  /** Días hacia adelante a considerar como "por vencer". */
  daysAhead?: number
  /** Ruta base para abrir el alumno. Por defecto /students; nutritionist usa /nutrition. */
  studentPathBase?: '/students' | '/nutrition'
}

export function DashboardExpiringPlansAlert({ daysAhead = 14, studentPathBase = '/students' }: Props) {
  const navigate = useAppNavigate()
  const [expiringPlans, setExpiringPlans] = useState<Array<StudentPlanAssignment & { student_name?: string }>>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const list = await fetchAssignmentsExpiringSoon(daysAhead)
      if (!cancelled) setExpiringPlans(list)
    })()
    return () => { cancelled = true }
  }, [daysAhead])

  if (expiringPlans.length === 0) return null

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <CalendarX className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
        <span className="flex-1 text-[11px] font-semibold text-ink-primary">
          Planes por vencer ({expiringPlans.length}) — próximos {daysAhead} días
        </span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 text-ink-muted transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <ul className="max-h-60 space-y-1 overflow-y-auto border-t border-surface-border px-2 py-2">
          {expiringPlans.map((p) => {
            const days = daysBetween(todayISO(), p.end_date)
            const tone = days <= 3 ? 'text-red-600 dark:text-red-300' : days <= 7 ? 'text-amber-700 dark:text-amber-300' : 'text-ink-secondary'
            return (
              <li
                key={p.id}
                onClick={() => navigate(`${studentPathBase}/${p.student_id}`)}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[11px] hover:bg-surface-elevated"
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-ink-primary">{p.student_name ?? '—'}</span>
                  <span className="text-ink-muted"> · {p.plan_name_snapshot} · {BILLING_PERIOD_LABELS[p.billing_period]}</span>
                </span>
                <span className={cn('shrink-0 font-semibold', tone)}>
                  {days <= 0 ? 'Vence hoy' : `${days} día${days === 1 ? '' : 's'}`}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
