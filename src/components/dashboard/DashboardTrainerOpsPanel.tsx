import { useState, type ReactNode } from 'react'
import { BellRing, CalendarClock, ChevronDown, Copy, ExternalLink } from 'lucide-react'
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
  openMissingStudentCheckInReminder,
  openResourceGroupWhatsApp,
  type DashboardCheckInQuickSend,
  type DashboardMissingCheckInStudent,
  type DashboardResourceQuickSend,
} from '@/lib/dashboard/dashboardTrainerOps'
import { sanitizeMessageForWhatsApp } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'

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
    default:
      return r.title
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .slice(0, 28)
  }
}

type Props = {
  dueCheckInSchedules: DueCheckInSchedule[]
  dueResourceSchedules: DueResourceSchedule[]
  checkInQuickSends: DashboardCheckInQuickSend[]
  resourceQuickSends: DashboardResourceQuickSend[]
  missingCheckInStudents: DashboardMissingCheckInStudent[]
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
    <div className="rounded-xl border border-surface-border/70 bg-surface-card/80 px-3 py-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold text-ink-primary">{title}</p>
        {dueToday ? (
          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
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
}: Props) {
  const navigate = useAppNavigate()
  const [guideOpen, setGuideOpen] = useState(false)
  const [missingOpen, setMissingOpen] = useState(missingCheckInStudents.length > 0)
  const fridayHighlight = TRAINER_WEEKLY_REMINDERS.some((r) => isTrainerReminderHighlightedToday(r))

  const dueCheckInFormIds = new Set(dueCheckInSchedules.map((s) => s.form_id))
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        Avisos semanales · envío rápido
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {primaryCheckIn ? (
          <QuickActionRow
            title={`Check-in · ${primaryCheckIn.formTitle}`}
            dueToday={checkInDueToday}
          >
            <p className="text-[10px] text-ink-muted leading-relaxed">
              Link general para el grupo. Cada alumno completa con su correo.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => void copyCheckInLink(primaryCheckIn)}
                className="inline-flex items-center gap-1 rounded-md border border-surface-border/80 bg-surface-elevated px-2 py-1 text-[10px] font-medium text-ink-primary hover:bg-surface-card transition-colors"
              >
                <Copy className="h-3 w-3" aria-hidden />
                Copiar link
              </button>
              {primaryCheckIn.publicToken ? (
                <a
                  href={checkInSharedPublicUrl(primaryCheckIn.publicToken)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-surface-border/80 bg-surface-elevated px-2 py-1 text-[10px] font-medium text-ink-primary hover:bg-surface-card transition-colors"
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
                className="inline-flex items-center gap-1 rounded-md border border-emerald-600/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-500/16 disabled:opacity-45 dark:text-emerald-300"
              >
                <WhatsAppIcon className="h-3 w-3" />
                Grupo WA
              </button>
            </div>
          </QuickActionRow>
        ) : (
          <QuickActionRow title="Check-in semanal">
            <p className="text-[10px] text-ink-muted">Creá un formulario en Devoluciones → Check-ins y guardalo para obtener el link general.</p>
            <button
              type="button"
              onClick={() => navigate('/feedback?tab=checkins')}
              className="text-[10px] font-medium text-brand-primary hover:underline"
            >
              Ir a Check-ins
            </button>
          </QuickActionRow>
        )}

        {primaryResource ? (
          <QuickActionRow title={`Recursos · ${primaryResource.label}`} dueToday={resourceDueToday}>
            <p className="text-[10px] text-ink-muted leading-relaxed">
              Aviso semanal o recurso para compartir en el grupo de alumnos.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(sanitizeMessageForWhatsApp(primaryResource.message)).then(
                    () => toast.success('Mensaje copiado'),
                    () => toast.error('No se pudo copiar'),
                  )
                }}
                className="inline-flex items-center gap-1 rounded-md border border-surface-border/80 bg-surface-elevated px-2 py-1 text-[10px] font-medium text-ink-primary hover:bg-surface-card transition-colors"
              >
                <Copy className="h-3 w-3" aria-hidden />
                Copiar mensaje
              </button>
              <button
                type="button"
                onClick={() => {
                  openResourceGroupWhatsApp(primaryResource)
                  toast.success('Elegí el grupo en WhatsApp')
                }}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-600/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-500/16 dark:text-emerald-300"
              >
                <WhatsAppIcon className="h-3 w-3" />
                Grupo WA
              </button>
            </div>
          </QuickActionRow>
        ) : (
          <QuickActionRow title="Recursos · aviso semanal">
            <p className="text-[10px] text-ink-muted">Agregá una plantilla o recurso en Devoluciones → Recursos.</p>
            <button
              type="button"
              onClick={() => navigate('/feedback?tab=recursos')}
              className="text-[10px] font-medium text-brand-primary hover:underline"
            >
              Ir a Recursos
            </button>
          </QuickActionRow>
        )}
      </div>

      {missingCheckInStudents.length > 0 ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/5">
          <button
            type="button"
            onClick={() => setMissingOpen((v) => !v)}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
            aria-expanded={missingOpen}
          >
            <CalendarClock className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <span className="flex-1 text-[11px] font-semibold text-amber-900 dark:text-amber-200">
              Sin check-in esta semana ({missingCheckInStudents.length}) — recordales por WhatsApp
            </span>
            <ChevronDown
              className={cn('h-3.5 w-3.5 text-amber-700 transition-transform dark:text-amber-300', missingOpen && 'rotate-180')}
              aria-hidden
            />
          </button>
          {missingOpen ? (
            <ul className="max-h-52 space-y-1 overflow-y-auto border-t border-amber-500/20 px-2 py-2">
              {missingCheckInStudents.map((st) => (
                <li
                  key={st.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[11px] hover:bg-amber-500/8"
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
                    className="shrink-0 inline-flex items-center gap-1 rounded-md border border-emerald-600/35 px-2 py-0.5 text-[10px] font-medium text-emerald-800 hover:bg-emerald-500/10 disabled:opacity-45 dark:text-emerald-300"
                  >
                    <WhatsAppIcon className="h-3 w-3" />
                    Recordar
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-surface-border/70 bg-surface-elevated/15">
        <button
          type="button"
          onClick={() => setGuideOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-elevated/30 transition-colors rounded-xl"
          aria-expanded={guideOpen}
        >
          <BellRing className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
          <span className="flex-1 min-w-0 text-[11px] font-medium text-ink-secondary">
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
    </div>
  )
}
