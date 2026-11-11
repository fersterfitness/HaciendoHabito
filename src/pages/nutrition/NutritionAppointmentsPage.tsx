import { controlSmClassName } from '@/lib/formControlClasses'
import { IS_V2 } from '@/lib/uiVersion'
import { UnmarkedAppointmentsV2 } from '@/components/v2/UnmarkedAppointmentsV2'
import { v2TabClass } from '@/components/v2/tabStyle'
import { AvatarV2 } from '@/components/v2/ui'
import { Modal } from '@/components/ui/Modal'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import { Header } from '@/components/layout/Header'
import { Card, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageToolbar } from '@/components/ui/PageToolbar'
import { Spinner } from '@/components/ui/Spinner'
import { Tooltip as UiTooltip } from '@/components/ui/Tooltip'
import { Popover } from '@/components/ui/Popover'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import {
  Calendar,
  Plus,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Grid2x2,
  List,
  MessageCircle,
  Search,
  Sparkles,
  UserRound,
  Video,
} from 'lucide-react'
import {
  buildAppointmentConfirmationWaUrl,
  buildAppointmentConfirmedPrepWaUrl,
  buildAppointmentFeedbackWaUrl,
} from '@/lib/whatsapp'
import { parseGoogleCalendarSyncFailure } from '@/lib/googleCalendarSyncErrors'
import { googleCalendarEventUrl } from '@/lib/googleCalendarLink'
import { STUDENT_PHONE_FORMAT_HINT } from '@/lib/studentPhone'
import { cn } from '@/lib/utils'
import { appFocusRingClassName } from '@/lib/appFocusRingClasses'
import { supabase } from '@/lib/supabase'
import { fetchAccessibleStudents } from '@/lib/students/studentAccess'
import { useAuthStore } from '@/stores/authStore'
import type {
  Appointment,
  AppointmentReminder,
  PersonalCalendarItem,
  Student,
  AppointmentStatus,
} from '@/types/database'
import toast from 'react-hot-toast'
import {
  addDays, addMonths, addWeeks, eachDayOfInterval,
  endOfDay, endOfMonth, endOfWeek, format, getMonth, isSameDay, isToday,
  isWithinInterval, parseISO, startOfDay, startOfMonth, startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'

async function parseFunctionErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') return 'Error desconocido'
  const fallback = (error as { message?: string }).message ?? 'Error desconocido'
  const maybeContext = (error as { context?: Response }).context
  if (!maybeContext) return fallback

  try {
    const payload = await maybeContext.clone().json()
    if (typeof payload?.error === 'string') return payload.error
    if (payload?.error?.message) return payload.error.message as string
    return JSON.stringify(payload)
  } catch {
    return fallback
  }
}

async function syncAppointmentGoogleCalendar(appointmentId: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('create-google-calendar-event', {
    body: { appointmentId },
  })
  if (error) {
    const functionMessage = await parseFunctionErrorMessage(error)
    const { title, body, kind } = parseGoogleCalendarSyncFailure(functionMessage)
    toast.custom(
      (toastId) => (
        <div className="max-w-md rounded-2xl border border-surface-border bg-surface-card shadow-lg px-4 py-3 flex flex-col gap-2">
          <p className="text-sm font-semibold text-ink-primary leading-snug">{title}</p>
          <p className="text-xs text-ink-secondary leading-relaxed">{body}</p>
          <button
            type="button"
            className="self-end px-2 py-1 text-xs font-medium text-ink-secondary"
            onClick={() => toast.dismiss(toastId.id)}
          >
            Entendido
          </button>
        </div>
      ),
      { duration: kind === 'oauth_revoked' ? 28000 : 16000 },
    )
    return null
  }
  if (data?.googleEventId) return data.googleEventId as string
  toast.error('No se recibió ID de Google Calendar')
  return null
}

type AppointmentRow = Appointment & {
  student?: Pick<Student, 'full_name' | 'phone' | 'avatar_path'> | null
  reminders?: AppointmentReminder[] | null
}

function whatsappToast(title: string, whatsappUrl: string, dismissLabel = 'Listo') {
  toast.custom(
    (t) => (
      <div className="max-w-sm rounded-2xl border border-surface-border bg-surface-card shadow-lg px-4 py-3 flex flex-col gap-2">
        <p className="text-sm text-ink-primary font-medium leading-snug">{title}</p>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary shadow-sm"
            onClick={() => toast.dismiss(t.id)}
          >
            <WhatsAppIcon className="h-3.5 w-3.5" v1={<MessageCircle className="h-3.5 w-3.5 shrink-0" />} />
            Abrir WhatsApp
          </a>
          <button type="button" className="text-xs text-ink-muted hover:text-ink-secondary px-2 py-1" onClick={() => toast.dismiss(t.id)}>
            {dismissLabel}
          </button>
        </div>
      </div>
    ),
    { duration: 45000 },
  )
}

function appointmentPhoneRaw(a: AppointmentRow, studentsById: Map<string, Student>): string | undefined {
  const fromJoin = a.student?.phone?.trim()
  if (fromJoin) return fromJoin
  return studentsById.get(a.student_id)?.phone?.trim() || undefined
}
type ViewMode = 'week' | 'agenda' | 'month'

const STATUS_LABEL_ES: Record<AppointmentStatus, string> = {
  scheduled: 'Programado',
  confirmed: 'Confirmado',
  completed: 'Realizado',
  cancelled: 'Cancelado',
  no_show: 'Ausente',
}

/** Badges: gris base + tintes suaves por estado (legible sin gritar). */
const STATUS_BADGE: Record<AppointmentStatus, string> = {
  scheduled:
    'border-surface-inputBorder/65 bg-zinc-500/[0.08] text-ink-primary dark:bg-zinc-500/[0.12]',
  confirmed:
    'bg-brand-primary/[0.1] text-ink-primary dark:text-brand-primary/95 border-brand-primary/30',
  completed:
    'bg-brand-primary/[0.06] text-ink-primary dark:text-brand-primary/85 border-brand-primary/22',
  cancelled:
    'bg-surface-elevated/50 text-ink-muted border-surface-border line-through decoration-ink-muted/60',
  no_show:
    'bg-status-expiring/10 text-status-expiring border-status-expiring/35',
}

function agendaCardAccent(status: AppointmentStatus): string {
  if (status === 'confirmed') return 'border-l-brand-primary'
  return 'border-l-zinc-500/85 dark:border-l-zinc-500/55'
}

const FALLBACK_DURATION_MIN = 45

/** Fin del turno en ms (usa `ends_at` o duración por defecto). */
function appointmentEndMs(a: Pick<Appointment, 'starts_at' | 'ends_at'>, fallbackMin = FALLBACK_DURATION_MIN): number {
  if (a.ends_at) return new Date(a.ends_at).getTime()
  return new Date(a.starts_at).getTime() + fallbackMin * 60 * 1000
}

/** Link para agregar el turno a la cuenta de Google de quien lo toca (sin depender del servidor). */
function appointmentGoogleUrl(a: AppointmentRow): string {
  const name = a.student?.full_name?.trim()
  return googleCalendarEventUrl({
    title: name && !a.title.includes(name) ? `${a.title} · ${name}` : a.title,
    start: new Date(a.starts_at),
    end: new Date(appointmentEndMs(a)),
    details: [a.notes?.trim(), 'Agendado desde Haciéndolo Hábito'].filter(Boolean).join('\n\n'),
    location: a.location,
  })
}

function intervalsOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
  return s1 < e2 && e1 > s2
}

function findOverlappingAppointment(
  apps: AppointmentRow[],
  startMs: number,
  endMs: number,
  excludeIds: Set<string>,
): AppointmentRow | undefined {
  for (const a of apps) {
    if (excludeIds.has(a.id)) continue
    if (a.status === 'cancelled') continue
    const s = new Date(a.starts_at).getTime()
    const e = appointmentEndMs(a)
    if (intervalsOverlap(startMs, endMs, s, e)) return a
  }
  return undefined
}

function appointmentInProgress(a: AppointmentRow, now = Date.now()): boolean {
  if (a.status !== 'scheduled' && a.status !== 'confirmed') return false
  const s = new Date(a.starts_at).getTime()
  const e = appointmentEndMs(a)
  return now >= s && now < e
}

const REMINDER_CHANNEL_LABEL: Record<string, string> = {
  app: 'App',
  email: 'Email',
  whatsapp: 'WhatsApp',
}

function formatReminderLine(reminders: AppointmentReminder[] | null | undefined): string | null {
  if (!reminders?.length) return null
  const sorted = [...reminders].sort((x, y) => x.scheduled_for.localeCompare(y.scheduled_for))
  return sorted
    .map((r) => {
      const when = format(parseISO(r.scheduled_for), 'EEE d MMM HH:mm', { locale: es })
      const ch = REMINDER_CHANNEL_LABEL[r.channel] ?? r.channel
      return `${ch}: ${when}`
    })
    .join(' · ')
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function formatIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function locationLooksLikeVideoCall(location: string | null | undefined): boolean {
  const t = (location ?? '').toLowerCase()
  if (!t.trim()) return false
  if (t.includes('http://') || t.includes('https://')) return true
  if (
    t.includes('zoom.us') ||
    t.includes('meet.google') ||
    t.includes('teams.microsoft') ||
    t.includes('whereby.com')
  ) {
    return true
  }
  return false
}

function personalEndMs(p: Pick<PersonalCalendarItem, 'starts_at' | 'ends_at'>): number {
  return new Date(p.ends_at).getTime()
}

function personalInProgress(p: PersonalCalendarItem, now = Date.now()): boolean {
  const s = new Date(p.starts_at).getTime()
  const e = personalEndMs(p)
  return now >= s && now < e
}

function buildPersonalIcsFile(rows: PersonalCalendarItem[], filenameHint: string): { blob: Blob; filename: string } {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'PRODID:-//Haciendo Habito//Agenda personal//ES',
  ]
  for (const p of rows) {
    const s = new Date(p.starts_at)
    const e = new Date(p.ends_at)
    lines.push('BEGIN:VEVENT', `UID:${p.id}@hh-personal`)
    lines.push(`DTSTAMP:${formatIcsUtc(new Date())}`)
    lines.push(`DTSTART:${formatIcsUtc(s)}`)
    lines.push(`DTEND:${formatIcsUtc(e)}`)
    lines.push(`SUMMARY:${escapeIcsText(p.title || 'Personal')}`)
    if (p.notes?.trim()) lines.push(`DESCRIPTION:${escapeIcsText(p.notes.trim())}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  const safe = filenameHint.replace(/[^\w-]+/g, '_').slice(0, 40)
  return {
    blob: new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }),
    filename: `agenda_personal_${safe || 'export'}.ics`,
  }
}

function buildTurnosIcsFile(rows: AppointmentRow[], filenameHint: string): { blob: Blob; filename: string } {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'PRODID:-//Haciendo Habito//Turnos//ES',
  ]
  for (const a of rows) {
    if (a.status === 'cancelled') continue
    const s = new Date(a.starts_at)
    const e = new Date(appointmentEndMs(a))
    lines.push('BEGIN:VEVENT', `UID:${a.id}@hh-turnos`)
    lines.push(`DTSTAMP:${formatIcsUtc(new Date())}`)
    lines.push(`DTSTART:${formatIcsUtc(s)}`)
    lines.push(`DTEND:${formatIcsUtc(e)}`)
    lines.push(`SUMMARY:${escapeIcsText(a.title || 'Turno')}`)
    const who = a.student?.full_name
    if (who) lines.push(`DESCRIPTION:${escapeIcsText(who)}`)
    if (a.location?.trim()) lines.push(`LOCATION:${escapeIcsText(a.location.trim())}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  const safe = filenameHint.replace(/[^\w-]+/g, '_').slice(0, 40)
  return {
    blob: new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }),
    filename: `turnos_${safe || 'export'}.ics`,
  }
}

const FIELD_ROW =
  'mt-1 w-full rounded-lg bg-surface-input border border-surface-inputBorder text-ink-primary px-3 py-2 text-sm placeholder:text-ink-muted/60'

/** Opciones de duración del turno (minutos, de 15 en 15 hasta 8 h). */
const APPOINTMENT_DURATION_OPTIONS_MINUTES = Array.from({ length: 32 }, (_, i) => (i + 1) * 15)

/** Alta de turno / evento: desplegable en la v1, panel (modal) en la v2. */
function BookingShell({
  v2Open,
  onClose,
  title,
  subtitle,
  className,
  summaryClassName,
  children,
}: {
  v2Open: boolean
  onClose: () => void
  title: string
  subtitle: string
  className: string
  summaryClassName: string
  children: ReactNode
}) {
  if (IS_V2) {
    return (
      <Modal open={v2Open} onClose={onClose} title={title} size="lg">
        {children}
      </Modal>
    )
  }
  return (
    <details open className={className}>
      <summary className={summaryClassName}>
        <div>
          <p className="text-sm font-semibold text-ink-primary">{title}</p>
          <p className="text-2xs text-ink-muted mt-0.5">{subtitle}</p>
        </div>
        <ChevronDown className="h-4 w-4 text-ink-muted shrink-0 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      {children}
    </details>
  )
}

export function AppointmentsPage() {
  const [bookingOpen, setBookingOpen] = useState(false)
  const [personalOpen, setPersonalOpen] = useState(false)
  const { user, profile } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [syncingGoogleId, setSyncingGoogleId] = useState<string | null>(null)
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()))
  const [form, setForm] = useState({
    student_id: '',
    starts_at: '',
    duration_minutes: 45 as number,
    title: '',
    location: '',
    notes: '',
  })
  const [recurring, setRecurring]       = useState(false)
  const [recurWeeks, setRecurWeeks]     = useState(4)
  const [listQuery, setListQuery]       = useState('')
  const [upcomingStatusFilter, setUpcomingStatusFilter] = useState<'all' | 'scheduled' | 'confirmed'>('all')
  // Week view appointment popover
  const [weekPopoverOpen, setWeekPopoverOpen] = useState(false)
  const [weekPopoverApptId, setWeekPopoverApptId] = useState<string | null>(null)
  const [calendarScope, setCalendarScope] = useState<'students' | 'personal'>('students')
  const [studentVideoOnly, setStudentVideoOnly] = useState(false)
  const [personalItems, setPersonalItems] = useState<PersonalCalendarItem[]>([])
  const [personalForm, setPersonalForm] = useState({
    title: '',
    starts_at: '',
    duration_minutes: 60 as number,
    notes: '',
  })
  const [personalSaving, setPersonalSaving] = useState(false)
  const [personalWeekPopoverOpen, setPersonalWeekPopoverOpen] = useState(false)
  const [personalWeekPopoverId, setPersonalWeekPopoverId] = useState<string | null>(null)

  const navigate = useAppNavigate()
  const reduceMotion = useReducedMotion()
  const profileType = profile?.role === 'nutritionist' ? 'nutritionist' : 'trainer'
  const personWord = profile?.role === 'nutritionist' ? 'paciente' : 'alumno'
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [completingNote, setCompletingNote] = useState('')

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students])

  const listMotion = useMemo((): { parent: Variants; item: Variants } => {
    if (reduceMotion) {
      return {
        parent: { hidden: {}, visible: {} },
        item: { hidden: {}, visible: {} },
      }
    }
    return {
      parent: {
        hidden: {},
        visible: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
      },
      item: {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
      },
    }
  }, [reduceMotion])

  useEffect(() => {
    if (!user) return
    void (async () => {
      setLoading(true)
      const [{ data: stData, error: stErr }, { data: apData, error: apErr }, { data: pcData, error: pcErr }] =
        await Promise.all([
          fetchAccessibleStudents(),
          supabase
            .from('appointments')
            .select('*, student:students(full_name, phone, avatar_path)')
            .eq('owner_id', user.id)
            .order('starts_at', { ascending: true }),
          supabase
            .from('personal_calendar_items')
            .select('*')
            .eq('owner_id', user.id)
            .order('starts_at', { ascending: true }),
        ])
      if (stErr || apErr) {
        toast.error(stErr ?? apErr?.message ?? 'No se pudieron cargar turnos')
        setStudents([])
        setAppointments([])
        setPersonalItems([])
      } else {
        setStudents(stData ?? [])
        const base = ((apData as AppointmentRow[]) ?? []).slice().sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        const ids = base.map((a) => a.id)
        const reminderByAppt = new Map<string, AppointmentReminder[]>()
        if (ids.length) {
          const { data: remData, error: remErr } = await supabase
            .from('appointment_reminders')
            .select('*')
            .in('appointment_id', ids)
          if (!remErr && remData) {
            for (const r of remData as AppointmentReminder[]) {
              const list = reminderByAppt.get(r.appointment_id) ?? []
              list.push(r)
              reminderByAppt.set(r.appointment_id, list)
            }
          }
        }
        setAppointments(
          base.map((a) => ({
            ...a,
            reminders: reminderByAppt.get(a.id) ?? [],
          })),
        )
        if (pcErr) {
          console.warn('[appointments] personal_calendar_items', pcErr.message)
          setPersonalItems([])
        } else {
          setPersonalItems((pcData as PersonalCalendarItem[]) ?? [])
        }
      }
      setLoading(false)
    })()
  }, [user])

  /** Sugerencia de título al elegir alumno/paciente (solo si el título sigue vacío). */
  useEffect(() => {
    if (!form.student_id) return
    const st = students.find((s) => s.id === form.student_id)
    if (!st?.full_name) return
    setForm((prev) => {
      if (prev.title.trim() !== '') return prev
      return { ...prev, title: `Seguimiento — ${st.full_name}` }
    })
  }, [form.student_id, students])

  const upcoming = useMemo(() => appointments.filter((a) => a.status === 'scheduled' || a.status === 'confirmed'), [appointments])
  const history = useMemo(() => appointments.filter((a) => a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show'), [appointments])
  // v2: turnos de las últimas dos semanas que ya pasaron y nadie marcó si vino o faltó.
  const unmarked = useMemo(() => {
    if (!IS_V2) return []
    const now = Date.now()
    const from = now - 14 * 86_400_000
    return upcoming
      .filter((a) => {
        const t = new Date(a.starts_at).getTime()
        return t < now - 15 * 60_000 && t >= from
      })
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
      .map((a) => ({ id: a.id, starts_at: a.starts_at, name: a.student?.full_name ?? a.title ?? 'Turno', title: a.student?.full_name ? a.title : null }))
  }, [upcoming])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekAnchor, index)), [weekAnchor])
  const monthDays = useMemo(() => {
    const first = startOfMonth(monthAnchor)
    const last  = endOfMonth(monthAnchor)
    return eachDayOfInterval({
      start: startOfWeek(first, { weekStartsOn: 1 }),
      end:   endOfWeek(last,  { weekStartsOn: 1 }),
    })
  }, [monthAnchor])

  function handlePrev() {
    if (viewMode === 'month') setMonthAnchor((p) => addMonths(p, -1))
    else setWeekAnchor((p) => addWeeks(p, -1))
  }
  function handleNext() {
    if (viewMode === 'month') setMonthAnchor((p) => addMonths(p, 1))
    else setWeekAnchor((p) => addWeeks(p, 1))
  }
  function handleGoToday() {
    const now = new Date()
    if (viewMode === 'month') setMonthAnchor(startOfMonth(now))
    else if (viewMode === 'week') setWeekAnchor(startOfWeek(now, { weekStartsOn: 1 }))
  }
  const weekAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.status !== 'cancelled')
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [appointments]
  )

  const matchesListFilters = useMemo(() => {
    return (a: AppointmentRow) => {
      if (upcomingStatusFilter === 'scheduled' && a.status !== 'scheduled') return false
      if (upcomingStatusFilter === 'confirmed' && a.status !== 'confirmed') return false
      const q = listQuery.trim().toLowerCase()
      if (!q) return true
      const name = (a.student?.full_name ?? '').toLowerCase()
      const title = (a.title ?? '').toLowerCase()
      return name.includes(q) || title.includes(q)
    }
  }, [listQuery, upcomingStatusFilter])

  const filteredStudentUpcoming = useMemo(() => {
    let base = upcoming.filter(matchesListFilters)
    if (studentVideoOnly) base = base.filter((a) => locationLooksLikeVideoCall(a.location))
    return base
  }, [upcoming, matchesListFilters, studentVideoOnly])

  const filteredPersonalAgenda = useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    return personalItems
      .filter((p) => {
        if (!q) return true
        return p.title.toLowerCase().includes(q) || (p.notes ?? '').toLowerCase().includes(q)
      })
      .slice()
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  }, [personalItems, listQuery])

  const filteredWeekAppointments = useMemo(() => {
    let base = weekAppointments.filter(matchesListFilters)
    if (studentVideoOnly) base = base.filter((a) => locationLooksLikeVideoCall(a.location))
    return base
  }, [weekAppointments, matchesListFilters, studentVideoOnly])

  const filteredWeekPersonal = useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    return personalItems.filter((p) => {
      if (!q) return true
      return p.title.toLowerCase().includes(q) || (p.notes ?? '').toLowerCase().includes(q)
    })
  }, [personalItems, listQuery])

  const filteredHistory = useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    return history.filter((a) => {
      if (!q) return true
      const name = (a.student?.full_name ?? '').toLowerCase()
      const title = (a.title ?? '').toLowerCase()
      return name.includes(q) || title.includes(q)
    })
  }, [history, listQuery])

  function exportVisibleWeekToIcs() {
    if (!weekDays.length) return
    const rangeStart = startOfDay(weekDays[0])
    const rangeEnd = endOfDay(weekDays[6])
    if (calendarScope === 'personal') {
      const inWeek = personalItems.filter((p) => {
        const t = parseISO(p.starts_at)
        return isWithinInterval(t, { start: rangeStart, end: rangeEnd })
      })
      if (!inWeek.length) {
        toast.error('No hay eventos personales esta semana para exportar')
        return
      }
      const { blob, filename } = buildPersonalIcsFile(inWeek, format(weekAnchor, 'yyyy-MM-dd'))
      const url = URL.createObjectURL(blob)
      const el = document.createElement('a')
      el.href = url
      el.download = filename
      el.click()
      URL.revokeObjectURL(url)
      toast.success('Archivo .ics descargado')
      return
    }
    const inWeek = appointments.filter((a) => {
      if (a.status === 'cancelled') return false
      const t = parseISO(a.starts_at)
      return isWithinInterval(t, { start: rangeStart, end: rangeEnd })
    })
    if (!inWeek.length) {
      toast.error('No hay turnos esta semana para exportar')
      return
    }
    const { blob, filename } = buildTurnosIcsFile(inWeek, format(weekAnchor, 'yyyy-MM-dd'))
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Archivo .ics descargado')
  }

  function goToWeekFromDay(day: Date) {
    setWeekAnchor(startOfWeek(day, { weekStartsOn: 1 }))
    setViewMode('week')
  }

  function openAppointmentConfirmationWa(a: AppointmentRow) {
    const phoneRaw = appointmentPhoneRaw(a, studentById)
    const url = buildAppointmentConfirmationWaUrl({
      phoneRaw,
      studentName: a.student?.full_name ?? 'Paciente',
      title: a.title,
      startsAtIso: a.starts_at,
      location: a.location,
    })
    if (!phoneRaw?.trim()) {
      toast.error('Sin teléfono del alumno: cargalo en la ficha para usar WhatsApp.')
      return
    }
    if (!url) {
      toast.error(`Teléfono inválido. Usá el formato ${STUDENT_PHONE_FORMAT_HINT}`)
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function openAppointmentFeedbackWa(a: AppointmentRow) {
    const phoneRaw = appointmentPhoneRaw(a, studentById)
    const url = buildAppointmentFeedbackWaUrl({
      phoneRaw,
      studentName: a.student?.full_name ?? 'Paciente',
      title: a.title,
      startsAtIso: a.starts_at,
    })
    if (!phoneRaw?.trim()) {
      toast.error('Sin teléfono del alumno: cargalo en la ficha para usar WhatsApp.')
      return
    }
    if (!url) {
      toast.error(`Teléfono inválido. Usá el formato ${STUDENT_PHONE_FORMAT_HINT}`)
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function openAppointmentConfirmedPrepWa(a: AppointmentRow) {
    const phoneRaw = appointmentPhoneRaw(a, studentById)
    const url = buildAppointmentConfirmedPrepWaUrl({ phoneRaw })
    if (!phoneRaw?.trim()) {
      toast.error('Sin teléfono del alumno: cargalo en la ficha para usar WhatsApp.')
      return
    }
    if (!url) {
      toast.error(`Teléfono inválido. Usá el formato ${STUDENT_PHONE_FORMAT_HINT}`)
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function createAppointment() {
    if (!user) return
    if (!form.student_id || !form.starts_at || !form.title.trim()) {
      toast.error('Completá paciente, fecha/hora y título')
      return
    }
    setCreating(true)
    try {
      const startMs = new Date(form.starts_at).getTime()
      const mins = APPOINTMENT_DURATION_OPTIONS_MINUTES.includes(form.duration_minutes)
        ? form.duration_minutes
        : 45
      const endMs = startMs + mins * 60 * 1000
      const startsAtIso = new Date(startMs).toISOString()
      const endsAtIso = new Date(endMs).toISOString()

      // Recurring: insert N copies spaced by 7 days
      if (recurring && recurWeeks > 1) {
        for (let i = 0; i < recurWeeks; i++) {
          const offset = i * 7 * 24 * 60 * 60 * 1000
          const slotStart = startMs + offset
          const slotEnd = endMs + offset
          const clash = findOverlappingAppointment(appointments, slotStart, slotEnd, new Set())
          if (clash) {
            toast.error(
              `La ocurrencia ${i + 1}/${recurWeeks} se solapa con «${clash.title}» (${format(parseISO(clash.starts_at), "d MMM HH:mm", { locale: es })}).`,
            )
            return
          }
        }
        const rows = Array.from({ length: recurWeeks }, (_, i) => {
          const offset = i * 7 * 24 * 60 * 60 * 1000
          return {
            owner_id:     user.id,
            student_id:   form.student_id,
            profile_type: profileType,
            starts_at:    new Date(startMs + offset).toISOString(),
            ends_at:      new Date(endMs   + offset).toISOString(),
            title:        form.title.trim(),
            location:     form.location.trim() || null,
            notes:        form.notes.trim() || null,
            status:       'scheduled' as const,
          }
        })
        const { data: recData, error: recErr } = await supabase
          .from('appointments')
          .insert(rows)
          .select('*, student:students(full_name, phone, avatar_path)')
        if (recErr) { toast.error(recErr.message); return }
        const recAppts = recData as AppointmentRow[]
        setAppointments((prev) => [...prev, ...recAppts].sort((a, b) => a.starts_at.localeCompare(b.starts_at)))
        setForm({ student_id: '', starts_at: '', duration_minutes: 45, title: '', location: '', notes: '' })
        setBookingOpen(false)
        setRecurring(false); setRecurWeeks(4)
        toast.success(`${recurWeeks} turnos recurrentes agendados`)

        const first = recAppts[0]
        if (first) {
          const studentName = first.student?.full_name ?? '—'
          const phoneRaw = first.student?.phone ?? students.find((s) => s.id === first.student_id)?.phone
          const confirmUrl = buildAppointmentConfirmationWaUrl({
            phoneRaw,
            studentName,
            title: first.title,
            startsAtIso: first.starts_at,
            location: first.location,
          })
          if (!phoneRaw?.trim()) {
            toast.custom(
              (t) => (
                <div className="max-w-sm rounded-2xl border border-surface-border bg-surface-card shadow-lg px-4 py-3 text-sm text-ink-secondary">
                  Para pedir confirmación por WhatsApp (primera fecha de la serie), agregá el teléfono del alumno en su ficha.
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-ink-secondary underline-offset-2 hover:underline "
                    onClick={() => toast.dismiss(t.id)}
                  >
                    Entendido
                  </button>
                </div>
              ),
              { duration: 8000 },
            )
          } else if (!confirmUrl) {
            toast.error(`Teléfono del alumno: actualizalo en la ficha con formato tipo ${STUDENT_PHONE_FORMAT_HINT}`)
          } else {
            whatsappToast(
              'Pedí confirmación por WhatsApp para la primera fecha (el resto de la serie está en la agenda)',
              confirmUrl,
            )
          }
        }
        return
      }

      const clashSingle = findOverlappingAppointment(appointments, startMs, endMs, new Set())
      if (clashSingle) {
        toast.error(
          `Ese horario se solapa con «${clashSingle.title}» (${format(parseISO(clashSingle.starts_at), "EEE d MMM HH:mm", { locale: es })}).`,
        )
        return
      }

      const { data, error } = await supabase
        .from('appointments')
        .insert({
          owner_id: user.id,
          student_id: form.student_id,
          profile_type: profileType,
          starts_at: startsAtIso,
          ends_at: endsAtIso,
          title: form.title.trim(),
          location: form.location.trim() || null,
          notes: form.notes.trim() || null,
          status: 'scheduled',
        })
        .select('*, student:students(full_name, phone, avatar_path)')
        .single()

      if (error) {
        toast.error(error.message)
        return
      }
      const appointment = data as AppointmentRow
      const startsAtMs = new Date(appointment.starts_at).getTime()
      const reminderRows = [
        {
          owner_id: user.id,
          appointment_id: appointment.id,
          channel: 'app',
          scheduled_for: new Date(startsAtMs - 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
        },
        {
          owner_id: user.id,
          appointment_id: appointment.id,
          channel: 'email',
          scheduled_for: new Date(startsAtMs - 2 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
        },
      ]
      const { data: remInserted } = await supabase.from('appointment_reminders').insert(reminderRows).select('*')
      const googleEventId = await syncAppointmentGoogleCalendar(appointment.id)
      if (googleEventId) {
        appointment.google_event_id = googleEventId
        toast.success('Turno agendado y sincronizado con Google Calendar')
      }

      const appointmentWithReminders: AppointmentRow = {
        ...appointment,
        reminders: (remInserted as AppointmentReminder[] | null) ?? [],
      }
      setAppointments((prev) => [...prev, appointmentWithReminders].sort((a, b) => a.starts_at.localeCompare(b.starts_at)))
      setForm({ student_id: '', starts_at: '', duration_minutes: 45, title: '', location: '', notes: '' })
      setBookingOpen(false)

      const studentName = appointment.student?.full_name ?? '—'
      const phoneRaw = appointment.student?.phone ?? students.find((s) => s.id === appointment.student_id)?.phone
      const confirmUrl = buildAppointmentConfirmationWaUrl({
        phoneRaw,
        studentName,
        title: appointment.title,
        startsAtIso: appointment.starts_at,
        location: appointment.location,
      })
      if (!phoneRaw?.trim()) {
        toast.custom(
          (t) => (
            <div className="max-w-sm rounded-2xl border border-surface-border bg-surface-card shadow-lg px-4 py-3 text-sm text-ink-secondary">
              Para pedir confirmación por WhatsApp, agregá el teléfono del alumno en su ficha.
              <button
                type="button"
                className="mt-2 text-xs font-medium text-ink-secondary underline-offset-2 hover:underline "
                onClick={() => toast.dismiss(t.id)}
              >
                Entendido
              </button>
            </div>
          ),
          { duration: 8000 },
        )
      } else if (!confirmUrl) {
        toast.error(`Teléfono del alumno: actualizalo en la ficha con formato tipo ${STUDENT_PHONE_FORMAT_HINT}`)
      } else {
        whatsappToast('Pedí confirmación por WhatsApp (podés repetir desde la lista de Agenda)', confirmUrl)
      }

      if (!googleEventId) {
        const gUrl = appointmentGoogleUrl(appointment)
        toast.custom(
          (t) => (
            <div className="flex max-w-sm items-center gap-3 rounded-2xl border border-surface-border bg-surface-card px-4 py-3 text-sm text-ink-primary shadow-lg">
              <span className="flex-1">Turno agendado</span>
              <a
                href={gUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => toast.dismiss(t.id)}
                className="hh-row-btn"
              >
                <Calendar className="h-3 w-3" aria-hidden />
                Agregar a Google Calendar
              </a>
            </div>
          ),
          { duration: 10000 },
        )
      }
    } finally {
      setCreating(false)
    }
  }

  async function createPersonalEvent() {
    if (!user) return
    if (!personalForm.title.trim() || !personalForm.starts_at) {
      toast.error('Completá título y fecha/hora')
      return
    }
    setPersonalSaving(true)
    try {
      const startMs = new Date(personalForm.starts_at).getTime()
      const mins = APPOINTMENT_DURATION_OPTIONS_MINUTES.includes(personalForm.duration_minutes)
        ? personalForm.duration_minutes
        : 60
      const endMs = startMs + mins * 60 * 1000
      const { data, error } = await supabase
        .from('personal_calendar_items')
        .insert({
          owner_id: user.id,
          title: personalForm.title.trim(),
          starts_at: new Date(startMs).toISOString(),
          ends_at: new Date(endMs).toISOString(),
          notes: personalForm.notes.trim() || null,
        })
        .select('*')
        .single()
      if (error) {
        toast.error(error.message)
        return
      }
      const row = data as PersonalCalendarItem
      setPersonalItems((prev) => [...prev, row].sort((a, b) => a.starts_at.localeCompare(b.starts_at)))
      setPersonalForm({ title: '', starts_at: '', duration_minutes: 60, notes: '' })
      setPersonalOpen(false)
      toast.success('Evento personal guardado')
    } finally {
      setPersonalSaving(false)
    }
  }

  async function deletePersonalEvent(id: string) {
    if (!user) return
    const { error } = await supabase.from('personal_calendar_items').delete().eq('id', id).eq('owner_id', user.id)
    if (error) {
      toast.error(error.message)
      return
    }
    setPersonalItems((prev) => prev.filter((p) => p.id !== id))
    setPersonalWeekPopoverOpen(false)
    setPersonalWeekPopoverId(null)
    toast.success('Evento eliminado')
  }

  async function retryGoogleCalendarSync(appointmentId: string) {
    if (syncingGoogleId) return
    setSyncingGoogleId(appointmentId)
    try {
      const googleEventId = await syncAppointmentGoogleCalendar(appointmentId)
      if (googleEventId) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === appointmentId ? { ...a, google_event_id: googleEventId } : a)),
        )
        toast.success('Turno sincronizado con Google Calendar')
      }
    } finally {
      setSyncingGoogleId(null)
    }
  }

  async function updateStatus(
    id: string,
    status: AppointmentStatus,
    sessionNotes?: string,
    opts?: { allowUndo?: boolean; quiet?: boolean },
  ) {
    if (!user) return
    const prev = appointments.find((a) => a.id === id)
    const updatePayload: { status: AppointmentStatus; notes?: string } = { status }
    if (sessionNotes !== undefined) updatePayload.notes = sessionNotes.trim() || undefined
    const { error } = await supabase.from('appointments').update(updatePayload).eq('id', id).eq('owner_id', user.id)
    if (error) {
      toast.error(error.message)
      return
    }
    setAppointments((prevList) => prevList.map((a) => (a.id === id ? { ...a, status, ...(sessionNotes !== undefined && { notes: sessionNotes.trim() || undefined }) } : a)))

    const allowUndo = opts?.allowUndo ?? true
    if (allowUndo && prev && status === 'cancelled') {
      const prevStatus = prev.status
      const prevNotes = prev.notes
      toast.custom(
        (t) => (
          <div className="max-w-sm rounded-2xl border border-surface-border bg-surface-card shadow-lg px-4 py-3">
            <p className="text-sm font-medium text-ink-primary leading-snug">Turno cancelado</p>
            <p className="mt-0.5 text-xs text-ink-muted truncate">
              {prev.title} · {prev.student?.full_name ?? 'Paciente'}
            </p>
            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                className="text-xs font-medium text-ink-muted hover:text-ink-primary px-2 py-1"
                onClick={() => toast.dismiss(t.id)}
              >
                Cerrar
              </button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={async () => {
                  toast.dismiss(t.id)
                  await updateStatus(id, prevStatus, prevNotes ?? undefined, { allowUndo: false })
                  toast.success('Cancelación deshecha')
                }}>
                Deshacer
              </Button>
            </div>
          </div>
        ),
        { duration: 7000 },
      )
    }

    if (status === 'completed' && prev && !opts?.quiet) {
      const studentName = prev.student?.full_name ?? '—'
      const phoneRaw = prev.student?.phone ?? students.find((s) => s.id === prev.student_id)?.phone
      const feedbackUrl = buildAppointmentFeedbackWaUrl({
        phoneRaw,
        studentName,
        title: prev.title,
        startsAtIso: prev.starts_at,
      })
      if (!phoneRaw?.trim()) {
        toast.custom(
          (t) => (
            <div className="max-w-sm rounded-2xl border border-surface-border bg-surface-card shadow-lg px-4 py-3 text-sm text-ink-secondary">
              Sesión marcada como completada. Para pedir feedback por WhatsApp, cargá el teléfono en la ficha del alumno.
              <button
                type="button"
                className="mt-2 text-xs font-medium text-ink-secondary underline-offset-2 hover:underline "
                onClick={() => toast.dismiss(t.id)}
              >
                Entendido
              </button>
            </div>
          ),
          { duration: 8000 },
        )
      } else if (!feedbackUrl) {
        toast.error(`Sesión guardada — el teléfono del alumno no sirve para WhatsApp (usá ${STUDENT_PHONE_FORMAT_HINT} en la ficha).`)
      } else {
        whatsappToast('Pedí cómo fue hoy por WhatsApp (desde Agenda o Historial podés repetir)', feedbackUrl)
      }
    }

    if (status === 'confirmed' && prev && prev.status !== 'confirmed') {
      const phoneRaw = prev.student?.phone ?? students.find((s) => s.id === prev.student_id)?.phone
      const prepUrl = buildAppointmentConfirmedPrepWaUrl({ phoneRaw })
      if (!phoneRaw?.trim()) {
        toast.custom(
          (t) => (
            <div className="max-w-sm rounded-2xl border border-surface-border bg-surface-card shadow-lg px-4 py-3 text-sm text-ink-secondary">
              Turno confirmado. Para enviar el mensaje de preparación por WhatsApp, cargá el teléfono en la ficha del alumno.
              <button
                type="button"
                className="mt-2 text-xs font-medium text-ink-secondary underline-offset-2 hover:underline "
                onClick={() => toast.dismiss(t.id)}
              >
                Entendido
              </button>
            </div>
          ),
          { duration: 8000 },
        )
      } else if (!prepUrl) {
        toast.error(`Turno confirmado — el teléfono no sirve para WhatsApp (usá ${STUDENT_PHONE_FORMAT_HINT} en la ficha).`)
      } else {
        whatsappToast('Enviá el mensaje de preparación para la videollamada por WhatsApp (podés repetir desde la agenda)', prepUrl)
      }
    }
  }

  if (loading) {
    return (
      <div>
        <Header title="Turnos" />
        <div className="flex justify-center py-16"><Spinner size="lg" accent="trainerCta" /></div>
      </div>
    )
  }

  return (
    <div>
      <Header
        title="Turnos"
        actions={
          IS_V2 ? (
            calendarScope === 'students' ? (
              <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setBookingOpen(true)}>
                Agendar turno
              </Button>
            ) : (
              <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setPersonalOpen(true)}>
                Nuevo evento
              </Button>
            )
          ) : undefined
        }
      />
      <div className={cn('px-4 lg:px-6 space-y-8', IS_V2 ? 'py-6' : 'py-8')}>
        <Card className="overflow-hidden p-0 gap-0">
          <PageToolbar
            className={cn(
              'rounded-none border-0 border-b border-surface-border',
              IS_V2 ? 'bg-transparent dark:bg-transparent' : 'bg-surface-elevated/35 dark:bg-surface-elevated/15',
            )}
            title={
              !IS_V2
                ? 'Calendario'
                : viewMode === 'agenda'
                  ? calendarScope === 'personal' ? 'Eventos propios' : 'Próximos turnos'
                  : viewMode === 'month'
                    ? format(monthAnchor, 'MMMM yyyy', { locale: es }).replace(/^./, (c) => c.toUpperCase())
                    : `Semana del ${format(weekAnchor, "d 'de' MMMM", { locale: es })}`
            }
            description={
              IS_V2 ? undefined :
              calendarScope === 'personal'
                ? viewMode === 'agenda'
                  ? 'Eventos propios (no visibles para alumnos)'
                  : viewMode === 'month'
                    ? format(monthAnchor, 'MMMM yyyy', { locale: es })
                    : `Semana del ${format(weekAnchor, "d 'de' MMMM", { locale: es })}`
                : viewMode === 'agenda'
                  ? 'Próximos turnos confirmados y programados'
                  : viewMode === 'month'
                    ? format(monthAnchor, 'MMMM yyyy', { locale: es })
                    : `Semana del ${format(weekAnchor, "d 'de' MMMM", { locale: es })}`
            }
          >
            <div className={cn('flex flex-wrap items-center gap-2', IS_V2 && 'w-full')}>
              <div className={IS_V2 ? 'inline-flex gap-1.5' : 'inline-flex rounded-lg border border-surface-border bg-surface-card/70 dark:bg-surface-card/40 p-0.5 gap-px'}>
                <button
                  type="button"
                  onClick={() => {
                    setCalendarScope('students')
                    setPersonalWeekPopoverOpen(false)
                    setPersonalWeekPopoverId(null)
                  }}
                  className={IS_V2 ? v2TabClass(calendarScope === 'students', 'sm') : cn(
                    'rounded-md px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors',
                    calendarScope === 'students'
                      ? 'bg-slate-500/12 text-ink-primary font-medium shadow-sm ring-1 ring-slate-400/30 dark:bg-slate-400/14 dark:text-ink-primary dark:ring-slate-500/35'
                      : 'text-ink-muted hover:text-ink-secondary',
                  )}
                >
                  <UserRound className="h-3.5 w-3.5" aria-hidden /> {personWord === 'paciente' ? 'Pacientes' : 'Alumnos'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCalendarScope('personal')
                    setWeekPopoverOpen(false)
                    setWeekPopoverApptId(null)
                  }}
                  className={IS_V2 ? v2TabClass(calendarScope === 'personal', 'sm') : cn(
                    'rounded-md px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors',
                    calendarScope === 'personal'
                      ? 'bg-slate-500/12 text-ink-primary font-medium shadow-sm ring-1 ring-slate-400/30 dark:bg-slate-400/14 dark:text-ink-primary dark:ring-slate-500/35'
                      : 'text-ink-muted hover:text-ink-secondary',
                  )}
                >
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Personal
                </button>
              </div>
              {IS_V2 ? <span className="h-5 w-px bg-surface-border max-sm:hidden" aria-hidden /> : null}
              <div className={IS_V2 ? 'inline-flex gap-1.5 max-sm:order-last' : 'inline-flex rounded-lg border border-surface-border bg-surface-card/70 dark:bg-surface-card/40 p-0.5 gap-px'}>
                <button
                  type="button"
                  onClick={() => setViewMode('week')}
                  className={IS_V2 ? v2TabClass(viewMode === 'week', 'sm') : cn(
                    'rounded-md px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors',
                    viewMode === 'week'
                      ? 'bg-slate-500/12 text-ink-primary font-medium shadow-sm ring-1 ring-slate-400/30 dark:bg-slate-400/14 dark:text-ink-primary dark:ring-slate-500/35'
                      : 'text-ink-muted hover:text-ink-secondary'
                  )}
                >
                  <Grid2x2 className="h-3.5 w-3.5" aria-hidden /> Semana
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('month')}
                  className={IS_V2 ? v2TabClass(viewMode === 'month', 'sm') : cn(
                    'rounded-md px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors',
                    viewMode === 'month'
                      ? 'bg-slate-500/12 text-ink-primary font-medium shadow-sm ring-1 ring-slate-400/30 dark:bg-slate-400/14 dark:text-ink-primary dark:ring-slate-500/35'
                      : 'text-ink-muted hover:text-ink-secondary'
                  )}
                >
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Mes
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('agenda')}
                  className={IS_V2 ? v2TabClass(viewMode === 'agenda', 'sm') : cn(
                    'rounded-md px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors',
                    viewMode === 'agenda'
                      ? 'bg-slate-500/12 text-ink-primary font-medium shadow-sm ring-1 ring-slate-400/30 dark:bg-slate-400/14 dark:text-ink-primary dark:ring-slate-500/35'
                      : 'text-ink-muted hover:text-ink-secondary'
                  )}
                >
                  <List className="h-3.5 w-3.5" aria-hidden /> Agenda
                </button>
              </div>
              {/* Celu v2: Hoy y las flechas en la fila de Pacientes/Personal, a la derecha. */}
              <div className={IS_V2 ? 'ml-auto flex items-center gap-2' : 'contents'}>
              {viewMode !== 'agenda' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-surface-inputBorder/80 px-3 text-xs text-ink-primary hover:border-surface-inputBorder/90 hover:bg-surface-elevated "
                  onClick={handleGoToday}
                >
                  Hoy
                </Button>
              )}
              <div className={IS_V2 ? 'flex items-center gap-1' : 'flex items-center rounded-lg border border-surface-border overflow-hidden'}>
                <button
                  type="button"
                  onClick={handlePrev}
                  className={
                    IS_V2
                      ? 'hh-focus flex h-8 w-8 items-center justify-center rounded-full bg-surface-elevated text-ink-primary transition-colors hover:bg-surface-border'
                      : 'p-1.5 text-ink-secondary hover:bg-surface-elevated hover:text-ink-primary transition-colors border-r border-surface-border'
                  }
                  aria-label="Periodo anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <Button
                  variant="ghost"
                  size="iconSm"
                  type="button"
                  onClick={handleNext}
                  className={IS_V2 ? 'h-8 w-8 bg-surface-elevated text-ink-primary hover:bg-surface-border' : 'text-ink-muted'}
                  aria-label="Periodo siguiente">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              </div>
            </div>
          </PageToolbar>

          <div className="p-4 sm:p-6">
          <div className="mb-5 space-y-3 sm:mb-6">
            <div className={cn('flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-4', IS_V2 && 'max-sm:flex-row max-sm:flex-wrap max-sm:gap-2')}>
              <div className={cn('min-w-0 flex flex-1 flex-col gap-1', IS_V2 && 'max-sm:basis-full lg:w-64 lg:flex-none')}>
                <label
                  htmlFor="appt-search"
                  className={cn('text-3xs font-semibold text-ink-muted leading-none', IS_V2 && 'sr-only')}
                >
                  Buscar
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" aria-hidden />
                  <Input
                    id="appt-search"
                    value={listQuery}
                    onChange={(e) => setListQuery(e.target.value)}
                    placeholder={
                      calendarScope === 'personal'
                        ? 'Título o nota del evento…'
                        : `Nombre del ${personWord} o título…`
                    }
                    className="h-9 border-surface-border bg-surface-input pl-9 text-sm"
                    aria-label="Buscar en la agenda"
                  />
                </div>
              </div>
              {calendarScope === 'students' ? (
                <>
                  <div className={cn('flex flex-col gap-1 sm:w-full sm:max-w-[min(100%,16rem)] lg:w-56 lg:max-w-none lg:shrink-0', IS_V2 && 'max-sm:min-w-0 max-sm:flex-1')}>
                    <span
                      id="appt-status-label"
                      className={cn('text-3xs font-semibold text-ink-muted leading-none', IS_V2 && 'sr-only')}
                    >
                      Estado
                    </span>
                    <select
                      value={upcomingStatusFilter}
                      onChange={(e) => setUpcomingStatusFilter(e.target.value as 'all' | 'scheduled' | 'confirmed')}
                      aria-labelledby="appt-status-label"
                      className={cn(
                        'h-9 w-full px-3 text-ink-primary outline-none transition-shadow focus:ring-1 focus:ring-brand-secondary/30',
                        IS_V2
                          ? 'cursor-pointer rounded-full border border-transparent bg-surface-elevated text-xs font-medium hover:bg-surface-border'
                          : 'rounded-lg border border-surface-inputBorder bg-surface-input text-sm focus:border-brand-secondary/40',
                      )}
                    >
                      <option value="all">{IS_V2 ? 'Todos los estados' : 'Programado o confirmado'}</option>
                      <option value="scheduled">Solo programados</option>
                      <option value="confirmed">Solo confirmados</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-end gap-1 lg:shrink-0">
                    <span className={cn('text-3xs font-semibold text-ink-muted leading-none', IS_V2 && 'sr-only')}>
                      Videollamada
                    </span>
                    <label
                      className={cn(
                        'inline-flex h-9 cursor-pointer select-none items-center gap-2 px-3 text-xs',
                        IS_V2
                          ? cn(
                              'rounded-full font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-primary/40',
                              studentVideoOnly ? 'bg-ink-primary text-surface-base' : 'bg-surface-elevated text-ink-primary hover:bg-surface-border',
                            )
                          : 'rounded-lg border border-surface-inputBorder bg-surface-input text-ink-secondary',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={studentVideoOnly}
                        onChange={(e) => setStudentVideoOnly(e.target.checked)}
                        className={IS_V2 ? 'sr-only' : 'h-4 w-4 rounded border-surface-border'}
                      />
                      {IS_V2 ? <Video className="h-3.5 w-3.5" aria-hidden /> : null}
                      {IS_V2 ? (
                        <>
                          <span className="max-sm:hidden">Solo con enlace</span>
                          <span className="sm:hidden">Con enlace</span>
                        </>
                      ) : (
                        'Solo con enlace'
                      )}
                    </label>
                  </div>
                </>
              ) : null}
              {viewMode === 'week' && (
                <div className={cn('flex flex-col gap-1 lg:w-auto lg:shrink-0', IS_V2 && 'max-sm:hidden lg:ml-auto')}>
                  <span className={cn('text-3xs font-semibold text-ink-muted leading-none', IS_V2 && 'sr-only')}>
                    Exportar
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={<Download className="h-3.5 w-3.5" aria-hidden />}
                    className="h-9 w-full whitespace-nowrap border-surface-inputBorder/80 px-3 text-xs sm:w-auto "
                    onClick={exportVisibleWeekToIcs}
                  >
                    Exportar .ics
                  </Button>
                </div>
              )}
            </div>
            {calendarScope === 'students' && unmarked.length ? (
              <UnmarkedAppointmentsV2
                items={unmarked}
                onMark={async (id, status) => {
                  await updateStatus(id, status, undefined, { allowUndo: false, quiet: true })
                  toast.success(status === 'completed' ? 'Marcado: vino' : 'Marcado: faltó')
                }}
              />
            ) : null}
            <p className={cn('flex items-start gap-2 border-t border-surface-border/70 pt-3 text-3xs leading-relaxed text-ink-muted', IS_V2 && 'hidden')}>
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500/85" aria-hidden />
              <span>
                <span className="font-medium text-ink-secondary">Tip:</span>{' '}
                {calendarScope === 'personal'
                  ? 'La agenda personal no crea turnos con alumnos ni sincroniza Google Calendar desde acá.'
                  : 'En vista mes, tocá un día para abrir esa semana. «Solo con enlace» filtra videollamadas (URL o Zoom/Meet/Teams).'}
              </span>
            </p>
          </div>

          {viewMode === 'month' ? (
            <div>
              {/* Day-of-week header */}
              <div className="grid grid-cols-7 mb-1">
                {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((d) => (
                  <p key={d} className="text-center text-3xs font-semibold text-ink-muted py-1">
                    {d}
                  </p>
                ))}
              </div>
              {/* Calendar grid */}
              <div className={IS_V2 ? 'grid grid-cols-7 gap-1.5 sm:gap-2' : 'grid grid-cols-7 gap-px bg-surface-border rounded-xl overflow-hidden'}>
                {monthDays.map((day) => {
                  const dayAppts =
                    calendarScope === 'students'
                      ? appointments
                          .filter(
                            (a) =>
                              a.status !== 'cancelled' &&
                              matchesListFilters(a) &&
                              (!studentVideoOnly || locationLooksLikeVideoCall(a.location)) &&
                              isSameDay(parseISO(a.starts_at), day),
                          )
                          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
                      : []
                  const dayPersonal =
                    calendarScope === 'personal'
                      ? filteredWeekPersonal
                          .filter((p) => isSameDay(parseISO(p.starts_at), day))
                          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
                      : []
                  const isCurrentMonth = getMonth(day) === getMonth(monthAnchor)
                  const today = isToday(day)
                  if (IS_V2) {
                    // Tablero: cada día es una tarjeta. El relleno dice cómo viene el día (todo confirmado en
                    // flúor, algo por confirmar en lavanda, ya pasado en gris) y adentro va quién viene y a qué hora.
                    const items =
                      calendarScope === 'students'
                        ? dayAppts.map((a) => ({ id: a.id, time: a.starts_at, name: a.student?.full_name ?? a.title, path: a.student?.avatar_path ?? null, person: true }))
                        : dayPersonal.map((it) => ({ id: it.id, time: it.starts_at, name: it.title, path: null, person: false }))
                    const open = dayAppts.filter((a) => a.status === 'scheduled' || a.status === 'confirmed')
                    const tone = !isCurrentMonth
                      ? 'text-ink-muted'
                      : items.length === 0
                        ? 'bg-surface-panel text-ink-secondary hover:bg-surface-elevated'
                        : calendarScope === 'personal'
                          ? 'bg-surface-card text-ink-primary shadow-[0_0_0_1px_rgb(var(--surface-border))] hover:bg-surface-panel'
                          : open.length === 0
                            ? 'bg-surface-elevated text-ink-secondary hover:bg-surface-border/70'
                            : open.every((a) => a.status === 'confirmed')
                              ? 'bg-status-ok hover:brightness-95'
                              : 'bg-[rgb(var(--v2-board-pending))] text-[rgb(43_33_64)] hover:brightness-95'
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => goToWeekFromDay(day)}
                        aria-label={`Abrir semana del ${format(day, "EEEE d 'de' MMMM", { locale: es })}${items.length ? `, ${items.length} ${items.length === 1 ? 'turno' : 'turnos'}` : ''}`}
                        aria-current={today ? 'date' : undefined}
                        style={
                          isCurrentMonth
                            ? undefined
                            : { backgroundImage: 'repeating-linear-gradient(135deg, rgb(var(--surface-border)) 0 1px, transparent 1px 9px)' }
                        }
                        className={cn(
                          'flex min-h-[4.5rem] flex-col rounded-xl p-1.5 text-left transition-all motion-safe:duration-200 sm:min-h-[7rem] sm:rounded-2xl sm:p-2.5',
                          tone,
                          appFocusRingClassName,
                        )}
                      >
                        <span className="flex items-baseline justify-between gap-1">
                          <span
                            className={cn(
                              'text-sm tabular-nums',
                              isCurrentMonth ? 'font-semibold' : 'font-medium',
                              // Hoy: el número va en una pastilla oscura (se ve igual sobre cualquier relleno).
                              today && 'inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-ink-primary px-1.5 text-surface-base',
                            )}
                          >
                            {format(day, 'd')}
                          </span>
                          {items.length ? <span className="text-3xs font-medium opacity-70 max-sm:hidden">{items.length === 1 ? '1 turno' : `${items.length} turnos`}</span> : null}
                        </span>
                        {items.length ? (
                          <>
                            <span className="mt-auto hidden flex-col gap-1.5 pt-2 sm:flex">
                              {items.slice(0, 2).map((it) => (
                                <span key={it.id} className="flex min-w-0 items-center gap-1.5">
                                  {it.person ? <AvatarV2 size="sm" name={it.name} path={it.path} /> : null}
                                  <span className="min-w-0">
                                    <span className="block truncate text-xs font-medium leading-tight">{it.person ? it.name.split(' ')[0] : it.name}</span>
                                    <span className="block text-3xs leading-tight opacity-70 tabular-nums">{format(parseISO(it.time), 'HH:mm')}</span>
                                  </span>
                                </span>
                              ))}
                              {items.length > 2 ? <span className="text-3xs font-medium opacity-70">+{items.length - 2} más</span> : null}
                            </span>
                            <span className="mt-auto text-3xs font-medium tabular-nums opacity-80 sm:hidden">{items.length}</span>
                          </>
                        ) : null}
                      </button>
                    )
                  }
                  return (
                    <div
                      key={day.toISOString()}
                      className={`bg-surface-elevated min-h-[80px] p-1 ${!isCurrentMonth ? 'opacity-40' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => goToWeekFromDay(day)}
                        className={cn(
                          'w-full min-h-[4.5rem] rounded-lg p-1 text-left transition-colors motion-safe:duration-200',
                          'hover:bg-surface-card/75 dark:hover:bg-surface-card/25',
                          appFocusRingClassName,
                        )}
                        aria-label={`Abrir semana del ${format(day, "EEEE d 'de' MMMM", { locale: es })}`}
                      >
                        <span className={cn(
                          'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold mb-1',
                          today
                            ? 'bg-zinc-500/[0.12] text-ink-primary ring-2 ring-zinc-400/45 dark:bg-zinc-500/[0.2] dark:ring-zinc-500/40'
                            : 'text-ink-secondary',
                        )}>
                          {format(day, 'd')}
                        </span>
                        <div className="space-y-0.5 pointer-events-none">
                          {calendarScope === 'students'
                            ? dayAppts.slice(0, 3).map((a) => (
                                <UiTooltip
                                  key={a.id}
                                  content={`${format(parseISO(a.starts_at), 'HH:mm')} — ${a.title} (${a.student?.full_name ?? '—'})`}
                                >
                                  <div
                                    className={cn(
                                      'truncate rounded border px-1 py-0.5 text-3xs font-medium leading-tight cursor-default',
                                      appointmentInProgress(a) &&
                                        (IS_V2 ? 'ring-1 ring-status-expiring/60 motion-safe:animate-pulse' : 'ring-1 ring-amber-400/50 motion-safe:animate-pulse'),
                                      IS_V2
                                        ? a.status === 'confirmed'
                                          ? 'border-surface-border bg-surface-panel text-ink-primary'
                                          : a.status === 'scheduled'
                                            ? 'border-dashed border-surface-inputBorder bg-surface-card text-ink-secondary'
                                            : 'border-surface-border bg-surface-elevated text-ink-muted'
                                        : a.status === 'confirmed'
                                        ? 'border-brand-primary/35 bg-brand-primary/[0.14] text-ink-primary dark:text-brand-primary/95'
                                        : a.status === 'scheduled'
                                          ? 'border-brand-tertiary/35 bg-brand-tertiary/10 text-brand-tertiary'
                                          : 'border-surface-inputBorder/70 bg-zinc-500/[0.08] text-ink-primary dark:bg-zinc-500/[0.14] ',
                                    )}
                                  >
                                    {format(parseISO(a.starts_at), 'HH:mm')}{' '}
                                    {a.student?.full_name?.split(' ')[0] ?? a.title}
                                  </div>
                                </UiTooltip>
                              ))
                            : dayPersonal.slice(0, 3).map((p) => (
                                <UiTooltip
                                  key={p.id}
                                  content={`${format(parseISO(p.starts_at), 'HH:mm')} — ${p.title}`}
                                >
                                  <div
                                    className={cn(
                                      (IS_V2 ? 'truncate rounded border px-1 py-0.5 text-3xs font-medium leading-tight cursor-default border-surface-border bg-surface-panel text-ink-primary' : 'truncate rounded border px-1 py-0.5 text-3xs font-medium leading-tight cursor-default border-violet-400/35 bg-violet-500/[0.12] text-violet-950 dark:text-violet-200/95'),
                                      personalInProgress(p) && (IS_V2 ? 'ring-1 ring-status-expiring/60 motion-safe:animate-pulse' : 'ring-1 ring-amber-400/50 motion-safe:animate-pulse'),
                                    )}
                                  >
                                    {format(parseISO(p.starts_at), 'HH:mm')} {p.title}
                                  </div>
                                </UiTooltip>
                              ))}
                          {(calendarScope === 'students' ? dayAppts.length : dayPersonal.length) > 3 && (
                            <p className="text-3xs text-ink-muted pl-1">
                              +{(calendarScope === 'students' ? dayAppts.length : dayPersonal.length) - 3} más
                            </p>
                          )}
                        </div>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : viewMode === 'week' ? (
            <div className="grid md:grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const dayIsToday = isToday(day)
                if (calendarScope === 'personal') {
                  const dayPersonalItems = filteredWeekPersonal.filter((p) =>
                    isSameDay(parseISO(p.starts_at), day),
                  )
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'rounded-xl border p-2 transition-shadow motion-safe:duration-300', IS_V2 ? 'md:min-h-44' : 'min-h-44',
                        IS_V2
                          ? dayIsToday
                            ? 'border-surface-inputBorder bg-surface-card'
                            : 'border-transparent bg-surface-panel'
                          : dayIsToday
                            ? 'border-brand-primary/40 bg-brand-primary/[0.06] shadow-card ring-1 ring-inset ring-brand-primary/20'
                            : 'border-surface-border bg-surface-elevated/50',
                      )}
                    >
                      <p
                        className={cn(
                          'text-2xs ',
                          dayIsToday ? 'font-semibold text-ink-primary ' : 'text-ink-secondary',
                        )}
                      >
                        {format(day, 'EEE', { locale: es })}
                        {dayIsToday && !IS_V2 ? (
                          <span className="ml-1.5 align-middle text-3xs font-semibold text-brand-primary">
                            · Hoy
                          </span>
                        ) : null}
                      </p>
                      <p
                      className={cn(
                        'text-sm font-semibold text-ink-primary',
                        IS_V2 && 'mt-0.5',
                        IS_V2 && dayIsToday && 'inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-ink-primary px-1.5 text-surface-base',
                      )}
                      aria-current={dayIsToday ? 'date' : undefined}
                    >
                        {format(day, 'd')}
                      </p>
                      <div className="mt-2 space-y-1.5">
                        {dayPersonalItems.length === 0 ? (
                          <p className={cn('text-2xs text-ink-secondary', IS_V2 && 'md:hidden')}>Sin eventos</p>
                        ) : (
                          dayPersonalItems.map((p) => (
                            <Popover
                              key={p.id}
                              open={personalWeekPopoverOpen && personalWeekPopoverId === p.id}
                              onOpenChange={(next) => {
                                setPersonalWeekPopoverOpen(next)
                                setPersonalWeekPopoverId(next ? p.id : null)
                              }}
                              className="w-52 rounded-2xl p-3 space-y-2"
                              trigger={({ ref, onClick, ...a11y }) => (
                                <button
                                  ref={ref}
                                  type="button"
                                  onClick={onClick}
                                  className={cn(
                                    (IS_V2 ? 'w-full text-left rounded-lg border px-2 py-1 transition-all motion-safe:duration-200 border-surface-border bg-surface-panel hover:bg-surface-elevated' : 'w-full text-left rounded-lg border px-2 py-1 transition-all border-l-[3px] motion-safe:duration-200 border-violet-500/30 border-l-violet-500 bg-violet-500/[0.08] hover:bg-violet-500/[0.13]'),
                                    personalInProgress(p) &&
                                      (IS_V2 ? 'ring-2 ring-status-expiring/50 motion-safe:animate-pulse' : 'ring-2 ring-amber-400/55 shadow-md shadow-amber-500/10 motion-safe:animate-pulse'),
                                  )}
                                  {...a11y}
                                >
                                  <p className="text-xs font-medium text-ink-primary truncate">{p.title}</p>
                                  <p className="text-2xs text-ink-secondary">
                                    {format(parseISO(p.starts_at), 'HH:mm')} — {format(parseISO(p.ends_at), 'HH:mm')}
                                  </p>
                                  {personalInProgress(p) ? (
                                    <p className={IS_V2 ? 'mt-0.5 text-3xs font-semibold text-status-expiring' : 'mt-0.5 text-3xs font-semibold text-amber-800 dark:text-amber-300/95'}>
                                      En curso
                                    </p>
                                  ) : null}
                                </button>
                              )}
                            >
                              <p className="text-xs font-semibold text-ink-primary truncate">{p.title}</p>
                              <p className="text-2xs text-ink-muted">
                                {format(parseISO(p.starts_at), 'HH:mm')} — {format(parseISO(p.ends_at), 'HH:mm')}
                              </p>
                              {p.notes?.trim() ? (
                                <p className="text-3xs leading-snug text-ink-secondary rounded-lg border border-surface-border/70 bg-surface-elevated/35 px-2 py-1.5">
                                  {p.notes.trim()}
                                </p>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  void deletePersonalEvent(p.id)
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-status-expired hover:bg-status-expired/10 transition-colors"
                              >
                                ✕ Eliminar
                              </button>
                            </Popover>
                          ))
                        )}
                      </div>
                    </div>
                  )
                }
                const dayAppointments = filteredWeekAppointments.filter((a) => isSameDay(parseISO(a.starts_at), day))
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'rounded-xl border p-2 transition-shadow motion-safe:duration-300', IS_V2 ? 'md:min-h-44' : 'min-h-44',
                      IS_V2
                        ? cn('rounded-none border-0 border-t-[3px] bg-transparent px-0 pb-1 pt-2.5', dayIsToday ? 'border-t-ink-primary' : 'border-t-surface-border')
                        : dayIsToday
                          ? 'border-brand-primary/40 bg-brand-primary/[0.06] shadow-card ring-1 ring-inset ring-brand-primary/20'
                          : 'border-surface-border bg-surface-elevated/50',
                    )}
                  >
                    <p
                      className={cn(
                        'text-2xs ',
                        dayIsToday ? 'font-semibold text-ink-primary ' : 'text-ink-secondary',
                      )}
                    >
                      {format(day, 'EEE', { locale: es })}
                      {dayIsToday && !IS_V2 ? (
                        <span className="ml-1.5 align-middle text-3xs font-semibold text-brand-primary">
                          · Hoy
                        </span>
                      ) : null}
                    </p>
                    <p
                      className={cn(
                        'text-sm font-semibold text-ink-primary',
                        IS_V2 && 'mt-0.5',
                        IS_V2 && dayIsToday && 'inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-ink-primary px-1.5 text-surface-base',
                      )}
                      aria-current={dayIsToday ? 'date' : undefined}
                    >
                      {format(day, 'd')}
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {dayAppointments.length === 0 ? (
                        <p className={cn('text-2xs text-ink-secondary', IS_V2 && 'md:hidden')}>Sin turnos</p>
                      ) : (
                        dayAppointments.map((a) => (
                          <Popover
                            key={a.id}
                            open={weekPopoverOpen && weekPopoverApptId === a.id}
                            onOpenChange={(next) => {
                              setWeekPopoverOpen(next)
                              setWeekPopoverApptId(next ? a.id : null)
                            }}
                            className="w-52 rounded-2xl p-3 space-y-2"
                            trigger={({ ref, onClick, ...a11y }) => (
                              <button
                                ref={ref}
                                type="button"
                                onClick={onClick}
                                className={cn(
                                  'w-full text-left transition-all motion-safe:duration-200',
                                  IS_V2 ? 'rounded-2xl p-2.5' : 'rounded-lg px-2 py-1',
                                  !IS_V2 && 'border border-l-[3px]',
                                  appointmentInProgress(a) &&
                                    (IS_V2 ? 'ring-2 ring-ink-primary ring-offset-2 ring-offset-surface-base' : 'ring-2 ring-amber-400/55 shadow-md shadow-amber-500/10 motion-safe:animate-pulse'),
                                  IS_V2
                                    ? // Tablero: el color del relleno dice el estado (confirmado en flúor, a confirmar en blanco).
                                      a.status === 'confirmed'
                                      ? 'bg-status-ok hover:brightness-95'
                                      : a.status === 'scheduled'
                                        ? 'bg-surface-card text-ink-primary shadow-[0_0_0_1px_rgb(var(--surface-border))] hover:bg-surface-panel'
                                        : a.status === 'completed'
                                          ? 'bg-surface-elevated text-ink-secondary hover:bg-surface-border/70'
                                          : 'bg-status-expired/10 text-status-expired hover:bg-status-expired/15'
                                    : a.status === 'confirmed'
                                      ? 'border border-brand-primary/25 border-l-brand-primary bg-brand-primary/[0.08] hover:bg-brand-primary/[0.13]'
                                      : a.status === 'scheduled'
                                        ? 'border border-brand-tertiary/30 border-l-brand-tertiary bg-brand-tertiary/[0.08] hover:bg-brand-tertiary/[0.13]'
                                        : 'border border-surface-border/90 border-l-zinc-500 bg-zinc-500/[0.05] hover:bg-zinc-500/[0.1] dark:border-l-zinc-500 dark:hover:bg-zinc-500/[0.16]',
                                )}
                                {...a11y}
                              >
                                {IS_V2 ? (
                                  <>
                                    <span className="flex items-baseline justify-between gap-2">
                                      <span className="text-sm font-semibold tabular-nums tracking-[-0.01em]">{format(parseISO(a.starts_at), 'HH:mm')}</span>
                                      <span className="truncate text-3xs font-medium opacity-75">
                                        {appointmentInProgress(a)
                                          ? 'En curso'
                                          : a.status === 'scheduled'
                                            ? 'A confirmar'
                                            : a.status === 'confirmed'
                                              ? 'Confirmado'
                                              : a.status === 'completed'
                                                ? 'Atendido'
                                                : a.status === 'no_show'
                                                  ? 'Faltó'
                                                  : 'Cancelado'}
                                      </span>
                                    </span>
                                    <span className="mt-2 flex items-center gap-2">
                                      <AvatarV2 size="sm" name={a.student?.full_name ?? '?'} path={a.student?.avatar_path ?? null} />
                                      <span className="min-w-0">
                                        <span className="block truncate text-xs font-medium leading-tight">{a.student?.full_name ?? 'Paciente'}</span>
                                        <span className="block truncate text-3xs leading-tight opacity-70">{a.title}</span>
                                      </span>
                                    </span>
                                  </>
                                ) : (
                                  <>
                                <p className="text-xs font-medium text-ink-primary truncate">{a.title}</p>
                                <p className="text-2xs text-ink-secondary">
                                  {format(parseISO(a.starts_at), 'HH:mm')} · {a.student?.full_name ?? 'Paciente'}
                                </p>
                                  </>
                                )}
                                {appointmentInProgress(a) && !IS_V2 ? (
                                  <p className={IS_V2 ? 'mt-0.5 text-3xs font-semibold text-status-expiring' : 'mt-0.5 text-3xs font-semibold text-amber-800 dark:text-amber-300/95'}>
                                    En curso
                                  </p>
                                ) : null}
                              </button>
                            )}
                          >
                            <p className="text-xs font-semibold text-ink-primary truncate">{a.title}</p>
                            <p className="text-2xs text-ink-muted">
                              {format(parseISO(a.starts_at), 'HH:mm')} · {a.student?.full_name ?? '—'}
                            </p>
                            {appointmentInProgress(a) && (
                              <p className={IS_V2 ? 'text-3xs font-semibold text-status-expiring' : 'text-3xs font-semibold text-amber-800 dark:text-amber-300/90'}>En curso ahora</p>
                            )}
                            {formatReminderLine(a.reminders) ? (
                              <p className="text-3xs leading-snug text-ink-muted rounded-lg border border-surface-border/70 bg-surface-elevated/35 px-2 py-1.5">
                                Recordatorios: {formatReminderLine(a.reminders)}
                              </p>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => {
                                navigate(`/students/${a.student_id}`)
                                setWeekPopoverOpen(false)
                                setWeekPopoverApptId(null)
                              }}
                              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-surface-border bg-surface-card/70 px-2.5 py-1.5 text-2xs font-medium text-ink-secondary transition-colors hover:bg-surface-elevated hover:text-ink-primary"
                            >
                              <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              Ficha del {personWord}
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                            </button>
                            {(a.status === 'scheduled' || a.status === 'confirmed') && (
                              <div className="space-y-1 pt-1 border-t border-surface-border">
                                <button
                                  type="button"
                                  onClick={() => { void updateStatus(a.id, 'confirmed'); setWeekPopoverOpen(false); setWeekPopoverApptId(null) }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-ink-primary dark:text-brand-primary/95 hover:bg-brand-primary/12 transition-colors"
                                >
                                  ✓ Confirmar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setCompletingId(a.id); setCompletingNote(''); setWeekPopoverOpen(false); setWeekPopoverApptId(null) }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-500/14 transition-colors"
                                >
                                  ✓ Completar (con nota)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (a.status === 'confirmed') openAppointmentConfirmedPrepWa(a)
                                    else openAppointmentConfirmationWa(a)
                                    setWeekPopoverOpen(false)
                                    setWeekPopoverApptId(null)
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-ink-primary/90 dark:text-brand-primary/90 hover:bg-brand-primary/12 transition-colors inline-flex items-center gap-1.5"
                                  title={
                                    a.status === 'confirmed'
                                      ? 'Abre WhatsApp con el mensaje de preparación para la videollamada (mismo que al confirmar el turno).'
                                      : 'Abre WhatsApp para pedir que el alumno confirme que va a asistir.'
                                  }
                                >
                                  <WhatsAppIcon className="h-3 w-3" v1={<MessageCircle className="h-3 w-3" />} />
                                  {a.status === 'confirmed' ? 'WhatsApp prep videollamada' : 'WhatsApp pedir confirmación'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { void updateStatus(a.id, 'cancelled'); setWeekPopoverOpen(false); setWeekPopoverApptId(null) }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-status-expired hover:bg-status-expired/10 transition-colors"
                                >
                                  ✕ Cancelar
                                </button>
                              </div>
                            )}
                          </Popover>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <motion.div
              className="space-y-2 mt-1"
              initial={reduceMotion ? false : 'hidden'}
              animate="visible"
              variants={listMotion.parent}
            >
              {calendarScope === 'personal' ? (
                filteredPersonalAgenda.length === 0 ? (
                  <p className="text-sm text-ink-secondary">
                    {listQuery.trim() ? 'Ningún evento coincide con la búsqueda.' : 'No hay eventos personales cargados.'}
                  </p>
                ) : (
                  filteredPersonalAgenda.map((p) => (
                    <motion.div
                      key={p.id}
                      variants={listMotion.item}
                      className={cn(
                        (IS_V2 ? 'rounded-xl border border-surface-border bg-surface-elevated/45 py-2 pl-3 pr-3 border-l-[3px] border-l-ink-muted/40' : 'rounded-xl border border-surface-border bg-surface-elevated/45 py-2 pl-3 pr-3 border-l-[3px] border-l-violet-500/75'),
                        personalInProgress(p) && (IS_V2 ? 'ring-1 ring-status-expiring/45' : 'ring-1 ring-amber-400/40 shadow-sm shadow-amber-500/5'),
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink-primary">{p.title}</p>
                          <p className="text-xs text-ink-secondary">
                            {new Date(p.starts_at).toLocaleString('es-AR')} — {new Date(p.ends_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {p.notes?.trim() ? (
                            <p className="mt-1 text-xs text-ink-muted">{p.notes.trim()}</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => void deletePersonalEvent(p.id)}
                          className="shrink-0 text-2xs px-2 py-1 rounded-lg border border-status-expired/30 text-status-expired hover:bg-status-expired/10"
                        >
                          Eliminar
                        </button>
                      </div>
                    </motion.div>
                  ))
                )
              ) : filteredStudentUpcoming.length === 0 ? (
                <p className="text-sm text-ink-secondary">
                  {listQuery.trim() || upcomingStatusFilter !== 'all' || studentVideoOnly
                    ? 'Ningún turno coincide con la búsqueda o los filtros.'
                    : 'No hay turnos agendados.'}
                </p>
              ) : (
                filteredStudentUpcoming.map((a) => (
                  <motion.div
                    key={a.id}
                    variants={listMotion.item}
                    className={cn(
                      'rounded-xl border border-surface-border bg-surface-elevated/45 py-2 pl-3 pr-3 border-l-[3px]',
                      agendaCardAccent(a.status),
                      appointmentInProgress(a) && (IS_V2 ? 'ring-1 ring-status-expiring/45' : 'ring-1 ring-amber-400/40 shadow-sm shadow-amber-500/5'),
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-primary">{a.title}</p>
                        <p className="text-xs text-ink-secondary">
                          {a.student?.full_name ?? (profile?.role === 'nutritionist' ? 'Paciente' : 'Alumno')} ·{' '}
                          {new Date(a.starts_at).toLocaleString('es-AR')}
                        </p>
                        {appointmentInProgress(a) ? (
                          <p className={IS_V2 ? 'mt-1 text-3xs font-semibold text-status-expiring' : 'mt-1 text-3xs font-semibold text-amber-800 dark:text-amber-300/90'}>
                            En curso
                          </p>
                        ) : null}
                        {formatReminderLine(a.reminders) ? (
                          <p className="mt-1 text-3xs leading-snug text-ink-muted">
                            Recordatorios: {formatReminderLine(a.reminders)}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => navigate(`/students/${a.student_id}`)}
                          className="mt-2 inline-flex items-center gap-1 text-2xs font-medium text-ink-secondary underline-offset-2 transition-colors hover:text-brand-secondary hover:underline"
                        >
                          <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Ver ficha del {personWord}
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </button>
                      </div>
                      <span className={`shrink-0 text-3xs px-2 py-1 rounded-md border font-medium ${STATUS_BADGE[a.status]}`}>
                        {STATUS_LABEL_ES[a.status]}
                      </span>
                    </div>
                    {completingId === a.id ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          autoFocus
                          rows={3}
                          value={completingNote}
                          onChange={(e) => setCompletingNote(e.target.value)}
                          placeholder="Notas de la sesión (opcional)…"
                          className={cn(FIELD_ROW, 'resize-none text-xs focus:ring-1 focus:ring-surface-border')}
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="text-xs h-8"
                            type="button"
                            onClick={async () => {
                              await updateStatus(a.id, 'completed', completingNote)
                              setCompletingId(null)
                              setCompletingNote('')
                            }}
                          >
                            Guardar y completar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-8"
                            type="button"
                            onClick={() => {
                              setCompletingId(null)
                              setCompletingNote('')
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateStatus(a.id, 'confirmed')}
                          className="text-2xs px-2 py-1 rounded-lg border border-brand-primary/35 text-ink-primary dark:text-brand-primary/95 hover:bg-brand-primary/12"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => { setCompletingId(a.id); setCompletingNote('') }}
                          className="text-2xs px-2 py-1 rounded-lg border border-slate-400/45 text-slate-800 dark:text-slate-200 hover:bg-slate-500/12"
                        >
                          Completar
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(a.id, 'cancelled')}
                          className="text-2xs px-2 py-1 rounded-lg border border-status-expired/30 text-status-expired"
                        >
                          Cancelar
                        </button>
                        {!a.google_event_id && (a.status === 'scheduled' || a.status === 'confirmed') ? (
                          <>
                            <a
                              href={appointmentGoogleUrl(a)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abre Google Calendar con el turno cargado para guardarlo en tu agenda"
                              className="text-2xs px-2.5 py-1 rounded-lg border border-surface-border text-ink-primary hover:bg-surface-elevated inline-flex items-center gap-1"
                            >
                              <Calendar className="h-3 w-3" />
                              Agregar a Google Calendar
                            </a>
                            <button
                              type="button"
                              disabled={syncingGoogleId === a.id}
                              onClick={() => void retryGoogleCalendarSync(a.id)}
                              title="Reintentar la sincronización automática con Google Calendar"
                              className="text-2xs px-2 py-1 rounded-lg text-ink-muted hover:bg-surface-elevated hover:text-ink-primary disabled:opacity-50"
                            >
                              {syncingGoogleId === a.id ? 'Sincronizando…' : 'Sincronizar'}
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            a.status === 'confirmed' ? openAppointmentConfirmedPrepWa(a) : openAppointmentConfirmationWa(a)
                          }
                          title={
                            a.status === 'confirmed'
                              ? 'Abre WhatsApp con el mensaje de preparación para la videollamada (mismo que al confirmar).'
                              : 'Abre WhatsApp para pedir que confirme asistencia (misma plantilla que al crear el turno).'
                          }
                          className="text-2xs px-2.5 py-1 rounded-lg border border-brand-primary/38 text-ink-primary dark:text-brand-primary/95 hover:bg-brand-primary/12 inline-flex items-center gap-1"
                        >
                          <WhatsAppIcon className="h-3 w-3" v1={<MessageCircle className="h-3 w-3" />} />
                          {a.status === 'confirmed' ? 'Prep videollamada WA' : 'Pedir confirmación WA'}
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))
              )
              }
            </motion.div>
          )}
          </div>
        </Card>

        {calendarScope === 'students' && (
        <BookingShell
          v2Open={bookingOpen}
          onClose={() => setBookingOpen(false)}
          title="Agendar turno"
          subtitle="Alta rápida · se limpia después de guardar"
          className="group overflow-hidden rounded-xl border border-surface-border border-l-[3px] border-l-zinc-400/70 bg-surface-card dark:border-l-zinc-500/50"
          summaryClassName="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-surface-border bg-surface-panel px-4 py-3 transition-colors hover:bg-surface-elevated [&::-webkit-details-marker]:hidden"
        >
          <div className={IS_V2 ? 'space-y-4' : 'p-4 sm:p-5 space-y-4'}>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-xs font-medium text-ink-muted">
                {profile?.role === 'nutritionist' ? 'Paciente' : 'Alumno'}
                <select
                  value={form.student_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, student_id: e.target.value }))}
                  className={FIELD_ROW}
                >
                  <option value="">Seleccionar…</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-ink-muted">
                Título
                <input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Consulta de seguimiento"
                  className={FIELD_ROW}
                />
              </label>
              <label className="text-xs font-medium text-ink-muted">
                Inicio
                <input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, starts_at: e.target.value }))}
                  className={FIELD_ROW}
                />
              </label>
              <label className="text-xs font-medium text-ink-muted">
                Duración
                <select
                  value={form.duration_minutes}
                  onChange={(e) => setForm((prev) => ({ ...prev, duration_minutes: Number(e.target.value) }))}
                  className={FIELD_ROW}
                >
                  {APPOINTMENT_DURATION_OPTIONS_MINUTES.map((m) => (
                    <option key={m} value={m}>
                      {m} min{m >= 60 ? ` (${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''})` : ''}
                    </option>
                  ))}
                </select>
                <span className="block text-3xs text-ink-muted mt-1 leading-snug">
                  Fin automático según duración (incrementos de 15 min).
                </span>
              </label>
              <label className="text-xs font-medium text-ink-muted">
                Ubicación
                <input
                  value={form.location}
                  onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="Online / Consultorio…"
                  className={FIELD_ROW}
                />
              </label>
              <label className="text-xs font-medium text-ink-muted md:col-span-2">
                Nota interna
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className={cn(FIELD_ROW, 'resize-y min-h-[4rem]')}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs text-ink-secondary">
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                  className="h-4 w-4 rounded border-surface-border"
                />
                Repetir semanalmente
              </label>
              {recurring && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={2}
                    max={52}
                    value={recurWeeks}
                    onChange={(e) => setRecurWeeks(Math.max(2, Math.min(52, Number(e.target.value))))}
                    className={cn(controlSmClassName, 'w-16 px-2 text-center')}
                  />
                  <span className="text-xs text-ink-muted">semanas</span>
                </div>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="border-surface-border/90 bg-surface-elevated/80 font-semibold text-ink-primary hover:bg-surface-elevated "
              onClick={() => void createAppointment()}
              loading={creating}
            >
              {recurring ? `Agendar ${recurWeeks} turnos` : 'Guardar turno'}
            </Button>
          </div>
        </BookingShell>
        )}

        {calendarScope === 'personal' && (
          <BookingShell
            v2Open={personalOpen}
            onClose={() => setPersonalOpen(false)}
            title="Nuevo evento personal"
            subtitle="No se asocia a alumnos ni sincroniza con Google Calendar"
            className={IS_V2 ? 'group overflow-hidden rounded-xl border border-surface-border bg-surface-card' : 'group overflow-hidden rounded-xl border border-surface-border border-l-[3px] border-l-violet-500/60 bg-surface-card dark:border-l-violet-500/45'}
            summaryClassName={IS_V2 ? 'flex cursor-pointer list-none items-center justify-between gap-3 border-b border-surface-border px-4 py-3 transition-colors hover:bg-surface-elevated [&::-webkit-details-marker]:hidden' : 'flex cursor-pointer list-none items-center justify-between gap-3 border-b border-surface-border bg-violet-500/[0.06] px-4 py-3 transition-colors hover:bg-violet-500/[0.1] [&::-webkit-details-marker]:hidden'}
          >
            <div className={IS_V2 ? 'space-y-4' : 'p-4 sm:p-5 space-y-4'}>
              <div className="grid md:grid-cols-2 gap-3">
                <label className="text-xs font-medium text-ink-muted md:col-span-2">
                  Título
                  <input
                    value={personalForm.title}
                    onChange={(e) => setPersonalForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Bloqueo / reunión / recordatorio"
                    className={FIELD_ROW}
                  />
                </label>
                <label className="text-xs font-medium text-ink-muted">
                  Inicio
                  <input
                    type="datetime-local"
                    value={personalForm.starts_at}
                    onChange={(e) => setPersonalForm((prev) => ({ ...prev, starts_at: e.target.value }))}
                    className={FIELD_ROW}
                  />
                </label>
                <label className="text-xs font-medium text-ink-muted">
                  Duración
                  <select
                    value={personalForm.duration_minutes}
                    onChange={(e) =>
                      setPersonalForm((prev) => ({ ...prev, duration_minutes: Number(e.target.value) }))
                    }
                    className={FIELD_ROW}
                  >
                    {APPOINTMENT_DURATION_OPTIONS_MINUTES.map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-ink-muted md:col-span-2">
                  Nota (opcional)
                  <textarea
                    value={personalForm.notes}
                    onChange={(e) => setPersonalForm((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className={cn(FIELD_ROW, 'resize-y min-h-[4rem]')}
                  />
                </label>
              </div>
              <Button
                variant={IS_V2 ? 'primary' : 'secondary'}
                size="sm"
                className={IS_V2 ? undefined : 'border-violet-200/90 bg-violet-100/80 font-semibold text-violet-950 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-950/70'}
                onClick={() => void createPersonalEvent()}
                loading={personalSaving}
              >
                Guardar evento
              </Button>
            </div>
          </BookingShell>
        )}

        {calendarScope === 'students' && (
        <Card>
          <CardTitle className="mb-2 font-medium text-base">Historial reciente</CardTitle>
          {history.length === 0 ? (
            <p className="text-sm text-ink-secondary">Todavía no hay turnos completados o cerrados.</p>
          ) : filteredHistory.length === 0 ? (
            <p className="text-sm text-ink-secondary">Nada coincide con la búsqueda actual.</p>
          ) : (
            <div className="space-y-2">
              {filteredHistory.slice(0, 12).map((a, rowIndex) => (
                <motion.div
                  key={a.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: Math.min(rowIndex, 14) * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  className={cn(
                    'rounded-xl border border-surface-border bg-surface-elevated/45 px-3 py-2 border-l-[3px] motion-safe:transition-shadow motion-safe:duration-200 hover:shadow-sm',
                    a.status === 'completed' && 'border-l-brand-primary/85',
                    a.status === 'cancelled' && 'border-l-status-expired/70',
                    a.status === 'no_show' && (IS_V2 ? 'border-l-status-expiring/80' : 'border-l-amber-500/80'),
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink-primary">{a.title}</p>
                    <span className={`text-3xs px-2 py-1 rounded-md border font-medium ${STATUS_BADGE[a.status]}`}>
                      {STATUS_LABEL_ES[a.status]}
                    </span>
                  </div>
                  <p className="text-xs text-ink-secondary mt-0.5">
                    {a.student?.full_name ?? (profile?.role === 'nutritionist' ? 'Paciente' : 'Alumno')} ·{' '}
                    {new Date(a.starts_at).toLocaleString('es-AR')}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(`/students/${a.student_id}`)}
                    className="mt-1.5 inline-flex items-center gap-1 text-2xs font-medium text-ink-muted transition-colors hover:text-brand-secondary"
                  >
                    <UserRound className="h-3 w-3 shrink-0" aria-hidden />
                    Ficha del {personWord}
                  </button>
                  {a.notes && (
                    <p className="mt-1 text-xs text-ink-muted bg-surface-border/30 rounded-lg px-2.5 py-1.5 italic leading-snug">
                      {a.notes}
                    </p>
                  )}
                  {a.status === 'completed' && (
                    <button
                      type="button"
                      onClick={() => openAppointmentFeedbackWa(a)}
                      title="Pedir feedback por WhatsApp (misma plantilla que al completar)."
                      className="mt-2 text-2xs px-2.5 py-1.5 rounded-lg border border-brand-primary/40 text-ink-primary dark:text-brand-primary/95 hover:bg-brand-primary/12 inline-flex items-center gap-1.5"
                    >
                      <WhatsAppIcon className="h-3 w-3" v1={<MessageCircle className="h-3 w-3" />} />
                      Feedback WA
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </Card>
        )}

      </div>

    </div>
  )
}

export { AppointmentsPage as NutritionAppointmentsPage }
