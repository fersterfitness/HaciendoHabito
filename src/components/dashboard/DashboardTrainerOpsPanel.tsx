import { useState, type ReactNode } from 'react'
import { BellRing, CalendarClock, Check, ChevronDown, Copy, Dumbbell, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import {
  TRAINER_WEEKLY_REMINDERS,
  isTrainerReminderHighlightedToday,
  type TrainerWeeklyReminder,
} from '@/lib/trainerWeeklyReminders'
import {
  checkInSharedPublicUrl,
  openCheckInGroupWhatsApp,
  openLastWeekMonthlyFeedback,
  openMissingStudentCheckInReminder,
  openResourceGroupWhatsApp,
  type DashboardCheckInQuickSend,
  type DashboardLastWeekStudent,
  type DashboardMissingCheckInStudent,
  type DashboardResourceQuickSend,
} from '@/lib/dashboard/dashboardTrainerOps'
import { copyWhatsAppMessage, WHATSAPP_CLIPBOARD_PASTE_HINT } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'
import { markRmTestReminderRead, type RmTestWeeksRow } from '@/lib/checkIn/rmTestReminder'

type DueCheckInSchedule = {
  id: string
  form_id: string
}

type DueResourceSchedule = {
  id: string
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
    case 'off-context-wednesday':
      return 'Saliendo de contexto'
    default:
      return r.title
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .slice(0, 28)
  }
}

const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function readDone(id: string): boolean {
  try {
    return localStorage.getItem(`hh-reminder-done:${id}`) === todayKey()
  } catch {
    return false
  }
}

function writeDone(id: string) {
  try {
    localStorage.setItem(`hh-reminder-done:${id}`, todayKey())
  } catch {
    /* modo privado: el aviso vuelve a salir al recargar */
  }
}

/**
 * Aviso del día bien a la vista: los viernes, mandar el feedback semanal al grupo;
 * los miércoles, el hilo de «Saliendo de contexto». «Listo» lo oculta hasta mañana.
 */
function TodayReminders({ checkIn }: { checkIn: DashboardCheckInQuickSend | null }) {
  const navigate = useAppNavigate()
  const [done, setDone] = useState<Record<string, boolean>>({})
  const today = TRAINER_WEEKLY_REMINDERS.filter(
    (r) => isTrainerReminderHighlightedToday(r) && !done[r.id] && !readDone(r.id),
  )
  if (today.length === 0) return null

  function finish(id: string) {
    writeDone(id)
    setDone((d) => ({ ...d, [id]: true }))
  }

  return (
    <div className="space-y-2">
      {today.map((r) => {
        const friday = r.id === 'checkins-send-friday'
        return (
          <div key={r.id} className="hh-alert hh-alert-warning flex flex-wrap items-center gap-2.5 rounded-xl px-3.5 py-2.5">
            <span className="hh-alert-icon h-7 w-7 shrink-0" aria-hidden>
              <BellRing className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-ink-primary">
                {friday ? 'Hoy es viernes: mandá el feedback semanal' : 'Hoy es miércoles: Saliendo de contexto'}
              </span>
              <span className="block text-2xs text-ink-muted">
                {friday ? 'Link general al grupo de WhatsApp, o a cada alumno desde Consulta semanal.' : 'Armá la pregunta de la semana y mandá el hilo al grupo.'}
              </span>
            </span>
            {friday && checkIn?.publicToken ? (
              <button
                type="button"
                className="hh-row-btn"
                onClick={() => {
                  openCheckInGroupWhatsApp(checkIn)
                  toast.success('Elegí el grupo en WhatsApp')
                }}
              >
                <WhatsAppIcon className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                Mandar al grupo
              </button>
            ) : null}
            <button type="button" className="hh-row-btn" onClick={() => navigate(r.href)}>
              {friday ? 'Consulta semanal' : 'Armar el hilo'}
            </button>
            <button
              type="button"
              onClick={() => finish(r.id)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-3xs font-medium text-ink-secondary transition-colors hover:bg-surface-elevated hover:text-ink-primary"
              title="Ocultarlo hasta mañana"
            >
              <Check className="h-3 w-3" /> Listo
            </button>
          </div>
        )
      })}
    </div>
  )
}

type Props = {
  dueCheckInSchedules: DueCheckInSchedule[]
  dueResourceSchedules: DueResourceSchedule[]
  checkInQuickSends: DashboardCheckInQuickSend[]
  resourceQuickSends: DashboardResourceQuickSend[]
  missingCheckInStudents: DashboardMissingCheckInStudent[]
  lastWeekStudents: DashboardLastWeekStudent[]
  monthlyFeedbackUrl: string | null
  /** Alumnos que llegaron a 12 semanas sin testear RM. */
  rmTestDueStudents: RmTestWeeksRow[]
  onRmTestRead: (studentId: string) => void
  /** Otros avisos del día (cobros, cumpleaños…): van con los de entrenamiento, antes del envío rápido. */
  extraAlerts?: ReactNode
}

function QuickActionRow({
  title,
  dueToday,
  children,
}: {
  title: string
  dueToday?: boolean
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card px-3 py-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-2xs font-semibold text-ink-primary">{title}</p>
        {dueToday ? (
          <span className="inline-flex items-center gap-1 text-3xs font-medium text-brand-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" aria-hidden />
            Hoy
          </span>
        ) : null}
      </div>
      {children}
    </div>
  )
}

/** Envío rápido a WhatsApp + alumnos sin check-in — desde Inicio. */
export function DashboardTrainerOpsPanel({
  dueCheckInSchedules,
  dueResourceSchedules,
  checkInQuickSends,
  resourceQuickSends,
  missingCheckInStudents,
  lastWeekStudents,
  monthlyFeedbackUrl,
  rmTestDueStudents,
  onRmTestRead,
  extraAlerts,
}: Props) {
  const navigate = useAppNavigate()
  const [guideOpen, setGuideOpen] = useState(false)
  const [missingOpen, setMissingOpen] = useState(false)
  const [lastWeekOpen, setLastWeekOpen] = useState(true)
  const [rmOpen, setRmOpen] = useState(true)
  const [rmMarkingId, setRmMarkingId] = useState<string | null>(null)

  async function markRmRead(studentId: string) {
    setRmMarkingId(studentId)
    const err = await markRmTestReminderRead(studentId)
    setRmMarkingId(null)
    if (err) {
      toast.error(err)
      return
    }
    onRmTestRead(studentId)
  }

  const fridayHighlight = TRAINER_WEEKLY_REMINDERS.some((r) => isTrainerReminderHighlightedToday(r))

  const dueResourceScheduleIds = new Set(dueResourceSchedules.map((s) => s.id))

  const primaryCheckIn = checkInQuickSends[0] ?? null
  const primaryResource = resourceQuickSends[0] ?? null

  const checkInDueToday =
    primaryCheckIn != null &&
    dueCheckInSchedules.some((s) => s.form_id === primaryCheckIn.formId || s.id === primaryCheckIn.scheduleId)

  const resourceDueToday =
    primaryResource != null && dueResourceScheduleIds.has(primaryResource.scheduleId)

  async function copyCheckInLink(send: DashboardCheckInQuickSend) {
    if (!send.publicToken) {
      toast.error('Guardá el formulario en Check-ins para obtener el link general')
      return
    }
    try {
      await navigator.clipboard.writeText(checkInSharedPublicUrl(send.publicToken))
      toast.success('Link general copiado')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <div className="space-y-3">
      <TodayReminders checkIn={primaryCheckIn} />

      {rmTestDueStudents.length > 0 ? (
        <div className="rounded-xl hh-alert hh-alert-warning">
          <button
            type="button"
            onClick={() => setRmOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
            aria-expanded={rmOpen}
          >
            <span className="hh-alert-icon h-7 w-7 shrink-0" aria-hidden>
              <Dumbbell className="h-3.5 w-3.5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-xs font-semibold text-ink-primary">Testear RM</span>
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-ink-primary/[0.08] px-1.5 text-3xs font-bold tabular-nums text-ink-primary">
                {rmTestDueStudents.length}
              </span>
              <span className="text-2xs text-ink-muted">en la próxima rutina</span>
            </span>
            <ChevronDown
              className={cn('h-3.5 w-3.5 text-ink-muted transition-transform', rmOpen && 'rotate-180')}
              aria-hidden
            />
          </button>
          {rmOpen ? (
            <ul className="max-h-52 space-y-1 overflow-y-auto border-t border-surface-border/70 px-2 py-2">
              {rmTestDueStudents.map((st) => (
                <li
                  key={st.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-2xs hover:bg-surface-elevated/60"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/students/${st.id}`)}
                    className="min-w-0 truncate text-left font-medium text-ink-primary hover:underline"
                  >
                    {st.full_name}
                  </button>
                  <span className="ml-auto shrink-0 tabular-nums text-3xs text-ink-muted">{st.weeks} sem.</span>
                  <button
                    type="button"
                    disabled={rmMarkingId === st.id}
                    onClick={() => void markRmRead(st.id)}
                    className="shrink-0 inline-flex items-center gap-1 rounded-md border border-surface-border bg-surface-card px-2 py-0.5 text-3xs font-medium text-ink-secondary shadow-xs hover:border-surface-inputBorder hover:text-ink-primary disabled:opacity-45"
                    title="Marcar como leído: la cuenta de 12 semanas vuelve a cero"
                  >
                    <Check className="h-3 w-3" />
                    Leído
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {lastWeekStudents.length > 0 ? (
        <div className="rounded-xl hh-alert hh-alert-danger">
          <button
            type="button"
            onClick={() => setLastWeekOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
            aria-expanded={lastWeekOpen}
          >
            <span className="hh-alert-icon h-7 w-7 shrink-0" aria-hidden>
              <BellRing className="h-3.5 w-3.5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-xs font-semibold text-ink-primary">Última semana</span>
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-ink-primary/[0.08] px-1.5 text-3xs font-bold tabular-nums text-ink-primary">
                {lastWeekStudents.length}
              </span>
              <span className="text-2xs text-ink-muted">enviar feedback mensual</span>
            </span>
            <ChevronDown
              className={cn('h-3.5 w-3.5 text-ink-muted transition-transform', lastWeekOpen && 'rotate-180')}
              aria-hidden
            />
          </button>
          {lastWeekOpen ? (
            <ul className="max-h-52 space-y-1 overflow-y-auto border-t border-surface-border/70 px-2 py-2">
              {lastWeekStudents.map((st) => (
                <li
                  key={st.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-2xs hover:bg-surface-elevated/60"
                >
                  <span className="min-w-0 truncate font-medium text-ink-primary">{st.full_name}</span>
                  <button
                    type="button"
                    disabled={!monthlyFeedbackUrl}
                    onClick={() => {
                      if (!monthlyFeedbackUrl) {
                        toast.error('Creá el formulario de feedback mensual en Check-ins')
                        return
                      }
                      const ok = openLastWeekMonthlyFeedback({
                        studentName: st.full_name,
                        phone: st.phone,
                        monthlyUrl: monthlyFeedbackUrl,
                      })
                      if (!ok) toast.error(`Sin teléfono válido para ${st.full_name}`)
                    }}
                    className="hh-row-btn"
                  >
                    <WhatsAppIcon className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    Enviar feedback mensual
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {missingCheckInStudents.length > 0 ? (
        <div className="rounded-xl border border-surface-border/90 bg-surface-card shadow-[var(--highlight-top),var(--shadow-xs)]">
          <button
            type="button"
            onClick={() => setMissingOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
            aria-expanded={missingOpen}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-ink-secondary" aria-hidden>
              <CalendarClock className="h-3.5 w-3.5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-xs font-semibold text-ink-primary">Sin feedback semanal</span>
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-ink-primary/[0.08] px-1.5 text-3xs font-bold tabular-nums text-ink-primary">
                {missingCheckInStudents.length}
              </span>
              <span className="text-2xs text-ink-muted">recordales por WhatsApp</span>
            </span>
            <ChevronDown
              className={cn('h-3.5 w-3.5 text-ink-muted transition-transform', missingOpen && 'rotate-180')}
              aria-hidden
            />
          </button>
          {missingOpen ? (
            <ul className="max-h-52 space-y-1 overflow-y-auto border-t border-surface-border px-2 py-2">
              {missingCheckInStudents.map((st) => (
                <li
                  key={st.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-2xs hover:bg-surface-elevated"
                >
                  <span className="min-w-0 truncate font-medium text-ink-primary">{st.full_name}</span>
                  <button
                    type="button"
                    disabled={!primaryCheckIn?.publicToken}
                    onClick={() => {
                      if (!primaryCheckIn?.publicToken) {
                        toast.error('Configurá el link general en Check-ins')
                        return
                      }
                      const ok = openMissingStudentCheckInReminder({
                        studentName: st.full_name,
                        phone: st.phone,
                        formTitle: primaryCheckIn.formTitle,
                        sharedUrl: checkInSharedPublicUrl(primaryCheckIn.publicToken),
                        intro: primaryCheckIn.intro,
                      })
                      if (!ok) toast.error(`Sin teléfono válido para ${st.full_name}`)
                    }}
                    className="hh-row-btn"
                  >
                    <WhatsAppIcon className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    Recordar
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {extraAlerts}

      <p className="text-3xs font-semibold text-ink-muted">
        Envío rápido
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {primaryCheckIn ? (
          <QuickActionRow
            title={`Check-in · ${primaryCheckIn.formTitle}`}
            dueToday={checkInDueToday}
          >
            <p className="text-3xs text-ink-muted leading-relaxed">
              Link general para el grupo. Cada alumno completa con su correo.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => void copyCheckInLink(primaryCheckIn)}
                className="hh-row-btn"
              >
                <Copy className="h-3 w-3" aria-hidden />
                Copiar link
              </button>
              {primaryCheckIn.publicToken ? (
                <a
                  href={checkInSharedPublicUrl(primaryCheckIn.publicToken)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hh-row-btn"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden />
                  Abrir
                </a>
              ) : null}
              <button
                type="button"
                disabled={!primaryCheckIn.publicToken}
                onClick={() => {
                  if (!primaryCheckIn.publicToken) {
                    toast.error('Guardá el formulario en Check-ins primero')
                    return
                  }
                  openCheckInGroupWhatsApp(primaryCheckIn)
                  toast.success('Elegí el grupo en WhatsApp')
                }}
                className="hh-row-btn"
              >
                <WhatsAppIcon className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                Grupo WA
              </button>
            </div>
          </QuickActionRow>
        ) : (
          <QuickActionRow title="Feedback semanal">
            <p className="text-3xs text-ink-muted">Creá un formulario en Consulta semanal → Check-ins y guardalo para obtener el link general.</p>
            <button
              type="button"
              onClick={() => navigate('/feedback?tab=checkins')}
              className="text-3xs font-medium text-brand-primary hover:underline"
            >
              Ir a Check-ins
            </button>
          </QuickActionRow>
        )}

        {primaryResource ? (
          <QuickActionRow title={`Recursos · ${primaryResource.label}`} dueToday={resourceDueToday}>
            <p className="text-3xs text-ink-muted leading-relaxed">
              Aviso semanal o recurso para compartir en el grupo de alumnos.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  void copyWhatsAppMessage(primaryResource.message).then((ok) =>
                    ok ? toast.success('Mensaje copiado') : toast.error('No se pudo copiar'),
                  )
                }}
                className="hh-row-btn"
              >
                <Copy className="h-3 w-3" aria-hidden />
                Copiar mensaje
              </button>
              <button
                type="button"
                onClick={() => {
                  void openResourceGroupWhatsApp(primaryResource).then((r) => {
                    if (r.mode === 'clipboard') {
                      toast.success(r.copied ? WHATSAPP_CLIPBOARD_PASTE_HINT : 'Abrí WhatsApp y pegá el mensaje')
                    } else {
                      toast.success('Elegí el grupo en WhatsApp')
                    }
                  })
                }}
                className="hh-row-btn"
              >
                <WhatsAppIcon className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                Grupo WA
              </button>
            </div>
          </QuickActionRow>
        ) : (
          <QuickActionRow title="Recursos · aviso semanal">
            <p className="text-3xs text-ink-muted">Agregá una plantilla o recurso en Consulta semanal → Recursos.</p>
            <button
              type="button"
              onClick={() => navigate('/feedback?tab=recursos')}
              className="text-3xs font-medium text-brand-primary hover:underline"
            >
              Ir a Recursos
            </button>
          </QuickActionRow>
        )}
      </div>

      <div className="rounded-xl border border-surface-border/70 bg-surface-elevated/15">
        <button
          type="button"
          onClick={() => setGuideOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-elevated/30 transition-colors rounded-xl"
          aria-expanded={guideOpen}
        >
          <BellRing className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
          <span className="flex-1 min-w-0 text-2xs font-medium text-ink-secondary">
            Guía semanal
            {fridayHighlight ? (
              <span className="text-brand-primary font-semibold"> · hoy: check-ins al grupo</span>
            ) : null}
          </span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform', guideOpen && 'rotate-180')}
            aria-hidden
          />
        </button>

        {guideOpen ? (
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
                    'rounded-md border px-2 py-1 text-3xs font-medium transition-colors',
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
    </div>
  )
}
