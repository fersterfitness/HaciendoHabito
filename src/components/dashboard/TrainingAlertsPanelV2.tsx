import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CalendarCheck2, Check, Flag, Trophy, UserX } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { loadStudentsMissingCheckIn } from '@/lib/dashboard/dashboardTrainerOps'
import { loadWeeklyPeriodStartYmd, weeklyPeriodMondayUtc } from '@/lib/checkIn/weeklyPeriod'
import { buildWeekAlerts, dismissAlert, loadWeekAlertData, readDismissedAlerts, type WeekAlertKind } from '@/lib/routine/trainingWeek'
import { buildWhatsAppUrl, normalizePhoneForWhatsApp } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'

const ICON: Record<WeekAlertKind, typeof Trophy> = { month_done: Trophy, last_week: Flag, week_done: CalendarCheck2, no_record: UserX }
const TONE: Record<WeekAlertKind, string> = {
  month_done: 'bg-pastel-butter text-pastel-butter-ink',
  last_week: 'bg-pastel-lavender text-pastel-lavender-ink',
  week_done: 'bg-status-ok/20 text-status-ok-ink',
  no_record: 'bg-pastel-rose text-pastel-rose-ink',
}

/**
 * v2 · Inicio del entrenador: avisos de la semana de entrenamiento de cada alumno, según lo que
 * registró desde su link. Terminó la semana (con formulario), entra en su última semana, terminó
 * el mes, o llegó el fin de semana sin registrar nada. Cada uno se marca como visto.
 */
export function TrainingAlertsPanelV2({ ownerId, onOpenRoutine }: { ownerId: string; onOpenRoutine: (routineId: string) => void }) {
  const today = useMemo(() => new Date(), [])
  const todayYmd = format(today, 'yyyy-MM-dd')
  const [seen, setSeen] = useState(readDismissedAlerts)
  const q = useQuery({
    queryKey: ['v2', 'training-week-alerts', ownerId, todayYmd],
    staleTime: 60_000,
    queryFn: async () => {
      const [data, missing] = await Promise.all([
        loadWeekAlertData(ownerId),
        loadStudentsMissingCheckIn(ownerId, weeklyPeriodMondayUtc(loadWeeklyPeriodStartYmd(ownerId))),
      ])
      if (!data) return []
      return buildWeekAlerts({
        routines: data.routines,
        statusOf: (id) => data.status.get(id),
        missingForm: new Set(missing.map((m) => m.id)),
        today,
        todayYmd,
      })
    },
  })
  const list = (q.data ?? []).filter((a) => !seen.includes(a.key))
  if (list.length === 0) return null

  return (
    <section aria-labelledby="avisos-semana" className="rounded-2xl border border-surface-border bg-surface-card">
      <h2 id="avisos-semana" className="px-4 pt-3.5 text-sm font-semibold text-ink-primary">
        Semana de tus alumnos
      </h2>
      <ul className="divide-y divide-surface-border px-4 pb-1">
        {list.map((a) => {
          const Icon = ICON[a.kind]
          const digits = normalizePhoneForWhatsApp(a.studentPhone)
          return (
            <li key={a.key} className="flex flex-col gap-2.5 py-3 sm:flex-row sm:items-center sm:gap-3">
              <span className={cn('hh-pastel hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:flex', TONE[a.kind])} aria-hidden>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-primary">{a.title}</p>
                <p className="mt-0.5 text-xs text-ink-secondary">{a.detail}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => onOpenRoutine(a.routineId)}>
                  Ver rutina
                </Button>
                {digits ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<WhatsAppIcon className="h-3.5 w-3.5" />}
                    title={a.whatsapp}
                    onClick={() => window.open(buildWhatsAppUrl(digits, a.whatsapp), '_blank', 'noopener')}
                  >
                    {a.kind === 'no_record' ? 'Recordar' : 'Felicitar'}
                  </Button>
                ) : null}
                <Button size="sm" icon={<Check className="h-3.5 w-3.5" />} onClick={() => setSeen(dismissAlert(a.key))}>
                  Visto
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
