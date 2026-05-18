import { useState } from 'react'
import { BellRing, CalendarClock, ChevronDown } from 'lucide-react'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import {
  TRAINER_WEEKLY_REMINDERS,
  isTrainerReminderHighlightedToday,
  type TrainerWeeklyReminder,
} from '@/lib/trainerWeeklyReminders'
import { cn } from '@/lib/utils'

type DueSchedule = {
  id: string
  form_id: string
  form: { title: string } | null
}

function shortReminderLabel(r: TrainerWeeklyReminder): string {
  switch (r.id) {
    case 'checkins-send-friday':
      return 'Check-ins · viernes'
    case 'checkins-review':
      return 'Revisar check-ins'
    case 'resources-weekly':
      return 'Recursos semanal'
    case 'routines-review':
      return 'Rutinas por vencer'
    default:
      return r.title
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .slice(0, 28)
  }
}

type Props = {
  dueCheckInSchedules: DueSchedule[]
}

/** Guía operativa compacta: no compite con las métricas del tablero. */
export function DashboardTrainerOpsPanel({ dueCheckInSchedules }: Props) {
  const navigate = useAppNavigate()
  const [open, setOpen] = useState(false)
  const fridayHighlight = TRAINER_WEEKLY_REMINDERS.some((r) => isTrainerReminderHighlightedToday(r))

  return (
    <div className="rounded-xl border border-surface-border/70 bg-surface-elevated/15">
      {dueCheckInSchedules.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-surface-border/60 px-3 py-2">
          <CalendarClock className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
          <span className="text-[11px] text-ink-muted">Hoy · enviar check-in:</span>
          {dueCheckInSchedules.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => navigate(`/check-ins?formId=${encodeURIComponent(s.form_id)}`)}
              className="rounded-md border border-sky-500/25 bg-sky-500/8 px-2 py-0.5 text-[11px] font-medium text-ink-primary hover:bg-sky-500/14 transition-colors"
            >
              {s.form?.title ?? 'Formulario'}
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-elevated/30 transition-colors rounded-xl"
        aria-expanded={open}
      >
        <BellRing className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
        <span className="flex-1 min-w-0 text-[11px] font-medium text-ink-secondary">
          Guía semanal
          {fridayHighlight ? (
            <span className="text-brand-primary font-semibold"> · hoy: check-ins al grupo</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2.5 pt-0">
          {TRAINER_WEEKLY_REMINDERS.map((reminder) => {
            const highlighted = isTrainerReminderHighlightedToday(reminder)
            return (
              <button
                key={reminder.id}
                type="button"
                title={reminder.description}
                onClick={() => navigate(reminder.href)}
                className={cn(
                  'rounded-md border px-2 py-1 text-[10px] font-medium transition-colors',
                  highlighted
                    ? 'border-brand-primary/35 bg-brand-primary/10 text-brand-primary'
                    : 'border-surface-border/80 bg-surface-base/50 text-ink-secondary hover:text-ink-primary hover:border-surface-border',
                )}
              >
                {shortReminderLabel(reminder)}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
