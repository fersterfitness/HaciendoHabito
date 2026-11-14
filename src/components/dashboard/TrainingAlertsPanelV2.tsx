import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CalendarCheck2, Check, ChevronDown, FileText, Flag, Trophy, UserX } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { AvatarV2 } from '@/components/v2/ui'
import { loadStudentsMissingCheckIn } from '@/lib/dashboard/dashboardTrainerOps'
import { loadWeeklyPeriodStartYmd, weeklyPeriodMondayUtc } from '@/lib/checkIn/weeklyPeriod'
import { buildWeekAlerts, dismissAlert, loadWeekAlertData, readDismissedAlerts, type WeekAlert, type WeekAlertKind } from '@/lib/routine/trainingWeek'
import { buildWhatsAppUrl, normalizePhoneForWhatsApp } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'

const ICON: Record<WeekAlertKind, typeof Trophy> = { month_done: Trophy, last_week: Flag, week_done: CalendarCheck2, no_record: UserX }
const TONE: Record<WeekAlertKind, string> = {
  month_done: 'bg-pastel-butter text-pastel-butter-ink',
  last_week: 'bg-pastel-lavender text-pastel-lavender-ink',
  week_done: 'bg-status-ok/20 text-status-ok-ink',
  no_record: 'bg-pastel-rose text-pastel-rose-ink',
}
const ORDER: WeekAlertKind[] = ['month_done', 'last_week', 'week_done', 'no_record']

/** Título del grupo: «3 alumnos terminaron la semana». */
function groupTitle(kind: WeekAlertKind, n: number): string {
  const who = n === 1 ? '1 alumno' : `${n} alumnos`
  const one = n === 1
  if (kind === 'month_done') return `${who} ${one ? 'terminó' : 'terminaron'} su mes de rutina`
  if (kind === 'last_week') return `${who} ${one ? 'entra' : 'entran'} en su última semana`
  if (kind === 'week_done') return `${who} ${one ? 'terminó' : 'terminaron'} la semana`
  return `${who} no ${one ? 'registró' : 'registraron'} nada esta semana`
}

/** «Bianca, Briana, Federico y 8 más». */
function namesPreview(list: WeekAlert[], max = 3): string {
  const first = list.slice(0, max).map((a) => a.studentName.trim().split(/\s+/)[0])
  const rest = list.length - first.length
  return rest > 0 ? `${first.join(', ')} y ${rest} más` : first.join(', ')
}

/**
 * v2 · Inicio del entrenador: avisos de la semana de entrenamiento de cada alumno, según lo que
 * registró desde su link. Cada tipo de aviso ocupa UN renglón («11 alumnos no registraron nada»),
 * que se despliega para ver alumno por alumno: así el Inicio no se llena cuando hay muchos.
 */
export function TrainingAlertsPanelV2({ ownerId, onOpenRoutine }: { ownerId: string; onOpenRoutine: (routineId: string) => void }) {
  const today = useMemo(() => new Date(), [])
  const todayYmd = format(today, 'yyyy-MM-dd')
  const [seen, setSeen] = useState(readDismissedAlerts)
  const [open, setOpen] = useState<WeekAlertKind | null>(null)
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
  const groups = ORDER.map((kind) => ({ kind, items: list.filter((a) => a.kind === kind) })).filter((g) => g.items.length > 0)

  function markSeen(items: WeekAlert[]) {
    let next = seen
    for (const a of items) next = dismissAlert(a.key)
    setSeen(next)
  }

  return (
    <section aria-labelledby="avisos-semana" className="rounded-2xl border border-surface-border bg-surface-card">
      <h2 id="avisos-semana" className="sr-only">
        Semana de tus alumnos
      </h2>
      <ul className="divide-y divide-surface-border">
        {groups.map(({ kind, items }) => {
          const Icon = ICON[kind]
          const expanded = open === kind
          const panelId = `avisos-${kind}`
          return (
            <li key={kind}>
              <div className="flex items-center gap-3 px-4 py-3">
                <span className={cn('hh-pastel flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TONE[kind])} aria-hidden>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-primary">{groupTitle(kind, items.length)}</p>
                  <p className="truncate text-xs text-ink-secondary">{namesPreview(items)}</p>
                </div>
                <Button size="sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => markSeen(items)}>
                  {items.length === 1 ? 'Visto' : 'Vistos'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  icon={<ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />}
                  iconPosition="right"
                  onClick={() => setOpen(expanded ? null : kind)}
                >
                  {expanded ? 'Cerrar' : 'Ver'}
                </Button>
              </div>
              {expanded ? (
                <ul id={panelId} className="max-h-80 overflow-y-auto border-t border-surface-border bg-surface-panel/40 px-4 py-1">
                  {items.map((a) => {
                    const digits = normalizePhoneForWhatsApp(a.studentPhone)
                    return (
                      <li key={a.key} className="flex items-center gap-3 py-2">
                        <AvatarV2 name={a.studentName} path={a.studentAvatar} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-ink-primary">{a.studentName}</p>
                          {kind === 'no_record' ? null : <p className="truncate text-xs text-ink-muted">{a.detail}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <IconButton label={`Ver la rutina de ${a.studentName}`} icon={<FileText className="h-4 w-4" />} onClick={() => onOpenRoutine(a.routineId)} />
                          {digits ? (
                            <IconButton
                              label={`${kind === 'no_record' ? 'Recordarle' : 'Felicitar'} por WhatsApp a ${a.studentName}`}
                              icon={<WhatsAppIcon className="h-4 w-4" />}
                              onClick={() => window.open(buildWhatsAppUrl(digits, a.whatsapp), '_blank', 'noopener')}
                            />
                          ) : null}
                          <IconButton label={`Marcar como visto el aviso de ${a.studentName}`} icon={<Check className="h-4 w-4" />} onClick={() => markSeen([a])} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
