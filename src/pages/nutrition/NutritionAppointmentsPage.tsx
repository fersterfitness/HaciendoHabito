import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
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
} from 'lucide-react'
import {
  buildAppointmentConfirmationWaUrl,
  buildAppointmentConfirmedPrepWaUrl,
  buildAppointmentFeedbackWaUrl,
} from '@/lib/whatsapp'
import { parseGoogleCalendarSyncFailure } from '@/lib/googleCalendarSyncErrors'
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
            className="self-end px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-400"
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
  student?: Pick<Student, 'full_name' | 'phone'> | null
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
            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
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
    'border-zinc-300/65 bg-zinc-500/[0.08] text-zinc-900 dark:border-zinc-600/50 dark:bg-zinc-500/[0.12] dark:text-zinc-200',
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

export function AppointmentsPage() {
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

  const listMotion = useMemo(() => {
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
            .select('*, student:students(full_name, phone)')
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
          .select('*, student:students(full_name, phone)')
        if (recErr) { toast.error(recErr.message); return }
        const recAppts = recData as AppointmentRow[]
        setAppointments((prev) => [...prev, ...recAppts].sort((a, b) => a.starts_at.localeCompare(b.starts_at)))
        setForm({ student_id: '', starts_at: '', duration_minutes: 45, title: '', location: '', notes: '' })
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
                    className="mt-2 text-xs font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-400"
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
        .select('*, student:students(full_name, phone)')
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
                className="mt-2 text-xs font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-400"
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
        toast.success('Turno agendado')
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
    opts?: { allowUndo?: boolean },
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
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-surface-border bg-surface-elevated/40 px-2.5 py-1.5 text-xs font-semibold text-ink-primary hover:bg-surface-elevated"
                onClick={async () => {
                  toast.dismiss(t.id)
                  await updateStatus(id, prevStatus, prevNotes ?? undefined, { allowUndo: false })
                  toast.success('Cancelación deshecha')
                }}
              >
                Deshacer
              </button>
            </div>
          </div>
        ),
        { duration: 7000 },
      )
    }

    if (status === 'completed' && prev) {
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
                className="mt-2 text-xs font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-400"
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
                className="mt-2 text-xs font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-400"
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
      <Header title="Turnos" />
      <div className="px-4 lg:px-6 py-8 space-y-8">
        <Card className="overflow-hidden p-0 gap-0">
          <PageToolbar
            className="rounded-none border-0 border-b border-surface-border bg-surface-elevated/35 dark:bg-surface-elevated/15"
            title="Calendario"
            description={
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
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-surface-border bg-surface-card/70 dark:bg-surface-card/40 p-0.5 gap-px">
                <button
                  type="button"
                  onClick={() => {
                    setCalendarScope('students')
                    setPersonalWeekPopoverOpen(false)
                    setPersonalWeekPopoverId(null)
                  }}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors',
                    calendarScope === 'students'
                      ? 'bg-slate-500/12 text-ink-primary font-medium shadow-sm ring-1 ring-slate-400/30 dark:bg-slate-400/14 dark:text-ink-primary dark:ring-slate-500/35'
                      : 'text-ink-muted hover:text-ink-secondary',
                  )}
                >
                  <UserRound className="h-3.5 w-3.5" aria-hidden /> Alumnos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCalendarScope('personal')
                    setWeekPopoverOpen(false)
                    setWeekPopoverApptId(null)
                  }}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors',
                    calendarScope === 'personal'
                      ? 'bg-slate-500/12 text-ink-primary font-medium shadow-sm ring-1 ring-slate-400/30 dark:bg-slate-400/14 dark:text-ink-primary dark:ring-slate-500/35'
                      : 'text-ink-muted hover:text-ink-secondary',
                  )}
                >
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Personal
                </button>
              </div>
              <div className="inline-flex rounded-lg border border-surface-border bg-surface-card/70 dark:bg-surface-card/40 p-0.5 gap-px">
                <button
                  type="button"
                  onClick={() => setViewMode('week')}
                  className={cn(
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
                  className={cn(
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
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors',
                    viewMode === 'agenda'
                      ? 'bg-slate-500/12 text-ink-primary font-medium shadow-sm ring-1 ring-slate-400/30 dark:bg-slate-400/14 dark:text-ink-primary dark:ring-slate-500/35'
                      : 'text-ink-muted hover:text-ink-secondary'
                  )}
                >
                  <List className="h-3.5 w-3.5" aria-hidden /> Agenda
                </button>
              </div>
              {viewMode !== 'agenda' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-zinc-300/80 px-3 text-xs text-zinc-800 hover:border-zinc-400/90 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/80"
                  onClick={handleGoToday}
                >
                  Hoy
                </Button>
              )}
              <div className="flex items-center rounded-lg border border-surface-border overflow-hidden">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="p-1.5 text-ink-secondary hover:bg-surface-elevated hover:text-ink-primary transition-colors border-r border-surface-border"
                  aria-label="Periodo anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="p-1.5 text-ink-secondary hover:bg-surface-elevated hover:text-ink-primary transition-colors"
                  aria-label="Periodo siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </PageToolbar>

          <div className="p-4 sm:p-6">
          <div className="mb-5 space-y-3 sm:mb-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-4">
              <div className="min-w-0 flex flex-1 flex-col gap-1">
                <label
                  htmlFor="appt-search"
                  className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted leading-none"
                >
                  Buscar
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" aria-hidden />
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
                  <div className="flex flex-col gap-1 sm:w-full sm:max-w-[min(100%,16rem)] lg:w-56 lg:max-w-none lg:shrink-0">
                    <span
                      id="appt-status-label"
                      className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted leading-none"
                    >
                      Estado
                    </span>
                    <select
                      value={upcomingStatusFilter}
                      onChange={(e) => setUpcomingStatusFilter(e.target.value as 'all' | 'scheduled' | 'confirmed')}
                      aria-labelledby="appt-status-label"
                      className="h-9 w-full rounded-lg border border-surface-inputBorder bg-surface-input px-3 text-sm text-ink-primary outline-none transition-shadow focus:border-brand-secondary/40 focus:ring-1 focus:ring-brand-secondary/30 dark:border-zinc-600 dark:bg-zinc-900/40"
                    >
                      <option value="all">Programado o confirmado</option>
                      <option value="scheduled">Solo programados</option>
                      <option value="confirmed">Solo confirmados</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-end gap-1 lg:shrink-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted leading-none">
                      Videollamada
                    </span>
                    <label className="inline-flex h-9 cursor-pointer select-none items-center gap-2 rounded-lg border border-surface-inputBorder bg-surface-input px-3 text-xs text-ink-secondary dark:border-zinc-600 dark:bg-zinc-900/40">
                      <input
                        type="checkbox"
                        checked={studentVideoOnly}
                        onChange={(e) => setStudentVideoOnly(e.target.checked)}
                        className="h-4 w-4 rounded border-surface-border accent-zinc-600 dark:accent-zinc-500"
                      />
                      Solo con enlace
                    </label>
                  </div>
                </>
              ) : null}
              {viewMode === 'week' && (
                <div className="flex flex-col gap-1 lg:w-auto lg:shrink-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted leading-none">
                    Exportar
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={<Download className="h-3.5 w-3.5" aria-hidden />}
                    className="h-9 w-full whitespace-nowrap border-zinc-300/80 px-3 text-xs sm:w-auto dark:border-zinc-600"
                    onClick={exportVisibleWeekToIcs}
                  >
                    Exportar .ics
                  </Button>
                </div>
              )}
            </div>
            <p className="flex items-start gap-2 border-t border-surface-border/70 pt-3 text-[10px] leading-relaxed text-ink-muted dark:border-zinc-700/80">
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
                  <p key={d} className="text-center text-[10px] font-semibold text-ink-muted uppercase tracking-wide py-1">
                    {d}
                  </p>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-px bg-surface-border rounded-xl overflow-hidden">
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
                            ? 'bg-zinc-500/[0.12] text-zinc-900 ring-2 ring-zinc-400/45 dark:bg-zinc-500/[0.2] dark:text-zinc-100 dark:ring-zinc-500/40'
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
                                      'truncate rounded border px-1 py-0.5 text-[10px] font-medium leading-tight cursor-default',
                                      appointmentInProgress(a) &&
                                        'ring-1 ring-amber-400/50 motion-safe:animate-pulse',
                                      a.status === 'confirmed'
                                        ? 'border-brand-primary/35 bg-brand-primary/[0.14] text-ink-primary dark:text-brand-primary/95'
                                        : a.status === 'scheduled'
                                          ? 'border-brand-tertiary/35 bg-brand-tertiary/10 text-brand-tertiary'
                                          : 'border-zinc-300/70 bg-zinc-500/[0.08] text-zinc-900 dark:border-zinc-600/55 dark:bg-zinc-500/[0.14] dark:text-zinc-200',
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
                                      'truncate rounded border px-1 py-0.5 text-[10px] font-medium leading-tight cursor-default border-violet-400/35 bg-violet-500/[0.12] text-violet-950 dark:text-violet-200/95',
                                      personalInProgress(p) && 'ring-1 ring-amber-400/50 motion-safe:animate-pulse',
                                    )}
                                  >
                                    {format(parseISO(p.starts_at), 'HH:mm')} {p.title}
                                  </div>
                                </UiTooltip>
                              ))}
                          {(calendarScope === 'students' ? dayAppts.length : dayPersonal.length) > 3 && (
                            <p className="text-[9px] text-ink-muted pl-1">
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
                        'rounded-xl border min-h-44 p-2 transition-shadow motion-safe:duration-300',
                        dayIsToday
                          ? 'border-zinc-300/85 bg-zinc-500/[0.06] shadow-sm shadow-black/[0.06] ring-1 ring-amber-400/25 dark:border-zinc-600 dark:bg-zinc-500/[0.1] dark:shadow-black/20 dark:ring-amber-500/20'
                          : 'border-surface-border bg-surface-elevated/50',
                      )}
                    >
                      <p
                        className={cn(
                          'text-[11px] uppercase tracking-wide',
                          dayIsToday ? 'font-semibold text-zinc-800 dark:text-zinc-300' : 'text-ink-secondary',
                        )}
                      >
                        {format(day, 'EEE', { locale: es })}
                        {dayIsToday ? (
                          <span className="ml-1.5 align-middle text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400/90">
                            · Hoy
                          </span>
                        ) : null}
                      </p>
                      <p className={cn('text-sm font-semibold', dayIsToday ? 'text-zinc-950 dark:text-zinc-50' : 'text-ink-primary')}>
                        {format(day, 'd')}
                      </p>
                      <div className="mt-2 space-y-1.5">
                        {dayPersonalItems.length === 0 ? (
                          <p className="text-[11px] text-ink-secondary">Sin eventos</p>
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
                                    'w-full text-left rounded-lg border px-2 py-1 transition-all border-l-[3px] motion-safe:duration-200 border-violet-500/30 border-l-violet-500 bg-violet-500/[0.08] hover:bg-violet-500/[0.13]',
                                    personalInProgress(p) &&
                                      'ring-2 ring-amber-400/55 shadow-md shadow-amber-500/10 motion-safe:animate-pulse',
                                  )}
                                  {...a11y}
                                >
                                  <p className="text-xs font-medium text-ink-primary truncate">{p.title}</p>
                                  <p className="text-[11px] text-ink-secondary">
                                    {format(parseISO(p.starts_at), 'HH:mm')} — {format(parseISO(p.ends_at), 'HH:mm')}
                                  </p>
                                  {personalInProgress(p) ? (
                                    <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300/95">
                                      En curso
                                    </p>
                                  ) : null}
                                </button>
                              )}
                            >
                              <p className="text-xs font-semibold text-ink-primary truncate">{p.title}</p>
                              <p className="text-[11px] text-ink-muted">
                                {format(parseISO(p.starts_at), 'HH:mm')} — {format(parseISO(p.ends_at), 'HH:mm')}
                              </p>
                              {p.notes?.trim() ? (
                                <p className="text-[10px] leading-snug text-ink-secondary rounded-lg border border-surface-border/70 bg-surface-elevated/35 px-2 py-1.5">
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
                      'rounded-xl border min-h-44 p-2 transition-shadow motion-safe:duration-300',
                      dayIsToday
                        ? 'border-zinc-300/85 bg-zinc-500/[0.06] shadow-sm shadow-black/[0.06] ring-1 ring-amber-400/25 dark:border-zinc-600 dark:bg-zinc-500/[0.1] dark:shadow-black/20 dark:ring-amber-500/20'
                        : 'border-surface-border bg-surface-elevated/50',
                    )}
                  >
                    <p
                      className={cn(
                        'text-[11px] uppercase tracking-wide',
                        dayIsToday ? 'font-semibold text-zinc-800 dark:text-zinc-300' : 'text-ink-secondary',
                      )}
                    >
                      {format(day, 'EEE', { locale: es })}
                      {dayIsToday ? (
                        <span className="ml-1.5 align-middle text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400/90">
                          · Hoy
                        </span>
                      ) : null}
                    </p>
                    <p className={cn('text-sm font-semibold', dayIsToday ? 'text-zinc-950 dark:text-zinc-50' : 'text-ink-primary')}>
                      {format(day, 'd')}
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {dayAppointments.length === 0 ? (
                        <p className="text-[11px] text-ink-secondary">Sin turnos</p>
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
                                  'w-full text-left rounded-lg border px-2 py-1 transition-all border-l-[3px] motion-safe:duration-200',
                                  appointmentInProgress(a) &&
                                    'ring-2 ring-amber-400/55 shadow-md shadow-amber-500/10 motion-safe:animate-pulse',
                                  a.status === 'confirmed'
                                    ? 'border border-brand-primary/25 border-l-brand-primary bg-brand-primary/[0.08] hover:bg-brand-primary/[0.13]'
                                    : a.status === 'scheduled'
                                      ? 'border border-brand-tertiary/30 border-l-brand-tertiary bg-brand-tertiary/[0.08] hover:bg-brand-tertiary/[0.13]'
                                      : 'border border-zinc-200/90 border-l-zinc-500 bg-zinc-500/[0.05] hover:bg-zinc-500/[0.1] dark:border-zinc-600/75 dark:border-l-zinc-500 dark:bg-zinc-500/[0.1] dark:hover:bg-zinc-500/[0.16]',
                                )}
                                {...a11y}
                              >
                                <p className="text-xs font-medium text-ink-primary truncate">{a.title}</p>
                                <p className="text-[11px] text-ink-secondary">
                                  {format(parseISO(a.starts_at), 'HH:mm')} · {a.student?.full_name ?? 'Paciente'}
                                </p>
                                {appointmentInProgress(a) ? (
                                  <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300/95">
                                    En curso
                                  </p>
                                ) : null}
                              </button>
                            )}
                          >
                            <p className="text-xs font-semibold text-ink-primary truncate">{a.title}</p>
                            <p className="text-[11px] text-ink-muted">
                              {format(parseISO(a.starts_at), 'HH:mm')} · {a.student?.full_name ?? '—'}
                            </p>
                            {appointmentInProgress(a) && (
                              <p className="text-[10px] font-semibold text-amber-800 dark:text-amber-300/90">En curso ahora</p>
                            )}
                            {formatReminderLine(a.reminders) ? (
                              <p className="text-[10px] leading-snug text-ink-muted rounded-lg border border-surface-border/70 bg-surface-elevated/35 px-2 py-1.5">
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
                              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-surface-border bg-surface-card/70 px-2.5 py-1.5 text-[11px] font-medium text-ink-secondary transition-colors hover:bg-surface-elevated hover:text-ink-primary"
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
                                  <MessageCircle className="h-3 w-3" />
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
                        'rounded-xl border border-surface-border bg-surface-elevated/45 py-2 pl-3 pr-3 border-l-[3px] border-l-violet-500/75',
                        personalInProgress(p) && 'ring-1 ring-amber-400/40 shadow-sm shadow-amber-500/5',
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
                          className="shrink-0 text-[11px] px-2 py-1 rounded-lg border border-status-expired/30 text-status-expired hover:bg-status-expired/10"
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
                      appointmentInProgress(a) && 'ring-1 ring-amber-400/40 shadow-sm shadow-amber-500/5',
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
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300/90">
                            En curso
                          </p>
                        ) : null}
                        {formatReminderLine(a.reminders) ? (
                          <p className="mt-1 text-[10px] leading-snug text-ink-muted">
                            Recordatorios: {formatReminderLine(a.reminders)}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => navigate(`/students/${a.student_id}`)}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-ink-secondary underline-offset-2 transition-colors hover:text-brand-secondary hover:underline"
                        >
                          <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Ver ficha del {personWord}
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </button>
                      </div>
                      <span className={`shrink-0 text-[10px] px-2 py-1 rounded-md border font-medium ${STATUS_BADGE[a.status]}`}>
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
                          className="text-[11px] px-2 py-1 rounded-lg border border-brand-primary/35 text-ink-primary dark:text-brand-primary/95 hover:bg-brand-primary/12"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => { setCompletingId(a.id); setCompletingNote('') }}
                          className="text-[11px] px-2 py-1 rounded-lg border border-slate-400/45 text-slate-800 dark:text-slate-200 hover:bg-slate-500/12"
                        >
                          Completar
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(a.id, 'cancelled')}
                          className="text-[11px] px-2 py-1 rounded-lg border border-status-expired/30 text-status-expired"
                        >
                          Cancelar
                        </button>
                        {!a.google_event_id && (a.status === 'scheduled' || a.status === 'confirmed') ? (
                          <button
                            type="button"
                            disabled={syncingGoogleId === a.id}
                            onClick={() => void retryGoogleCalendarSync(a.id)}
                            title="Crear o vincular el evento en Google Calendar"
                            className="text-[11px] px-2.5 py-1 rounded-lg border border-sky-500/35 text-sky-900 dark:text-sky-300/95 hover:bg-sky-500/12 inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <Calendar className="h-3 w-3" />
                            {syncingGoogleId === a.id ? 'Sincronizando…' : 'Google Calendar'}
                          </button>
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
                          className="text-[11px] px-2.5 py-1 rounded-lg border border-brand-primary/38 text-ink-primary dark:text-brand-primary/95 hover:bg-brand-primary/12 inline-flex items-center gap-1"
                        >
                          <MessageCircle className="h-3 w-3" />
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
        <details
          open
          className="group overflow-hidden rounded-xl border border-surface-border border-l-[3px] border-l-zinc-400/70 bg-surface-card dark:border-l-zinc-500/50"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-surface-border bg-gradient-to-r from-zinc-500/[0.06] to-surface-elevated/25 px-4 py-3 transition-colors hover:from-zinc-500/[0.09] hover:to-surface-elevated/35 dark:from-zinc-500/[0.1] dark:hover:from-zinc-500/[0.14] [&::-webkit-details-marker]:hidden">
            <div>
              <p className="text-sm font-semibold text-ink-primary">Agendar turno</p>
              <p className="text-[11px] text-ink-muted mt-0.5">Alta rápida · se limpia después de guardar</p>
            </div>
            <ChevronDown className="h-4 w-4 text-ink-muted shrink-0 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="p-4 sm:p-5 space-y-4">
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
                <span className="block text-[10px] text-ink-muted mt-1 leading-snug">
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
                  className="h-4 w-4 rounded border-surface-border accent-zinc-600 dark:accent-zinc-500"
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
                    className="w-16 rounded-lg bg-surface-input border border-surface-inputBorder text-ink-primary text-xs px-2 py-1.5 text-center"
                  />
                  <span className="text-xs text-ink-muted">semanas</span>
                </div>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="border-zinc-200/90 bg-zinc-100/80 font-semibold text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-50 dark:hover:bg-zinc-800"
              onClick={() => void createAppointment()}
              loading={creating}
            >
              {recurring ? `Agendar ${recurWeeks} turnos` : 'Guardar turno'}
            </Button>
          </div>
        </details>
        )}

        {calendarScope === 'personal' && (
          <details
            open
            className="group overflow-hidden rounded-xl border border-surface-border border-l-[3px] border-l-violet-500/60 bg-surface-card dark:border-l-violet-500/45"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-surface-border bg-gradient-to-r from-violet-500/[0.08] to-surface-elevated/25 px-4 py-3 transition-colors hover:from-violet-500/[0.11] hover:to-surface-elevated/35 dark:from-violet-500/[0.12] dark:hover:from-violet-500/[0.16] [&::-webkit-details-marker]:hidden">
              <div>
                <p className="text-sm font-semibold text-ink-primary">Nuevo evento personal</p>
                <p className="text-[11px] text-ink-muted mt-0.5">No se asocia a alumnos ni sincroniza con Google Calendar</p>
              </div>
              <ChevronDown className="h-4 w-4 text-ink-muted shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="p-4 sm:p-5 space-y-4">
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
                variant="secondary"
                size="sm"
                className="border-violet-200/90 bg-violet-100/80 font-semibold text-violet-950 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-950/70"
                onClick={() => void createPersonalEvent()}
                loading={personalSaving}
              >
                Guardar evento
              </Button>
            </div>
          </details>
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
                    a.status === 'no_show' && 'border-l-amber-500/80',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink-primary">{a.title}</p>
                    <span className={`text-[10px] px-2 py-1 rounded-md border font-medium ${STATUS_BADGE[a.status]}`}>
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
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted transition-colors hover:text-brand-secondary"
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
                      className="mt-2 text-[11px] px-2.5 py-1.5 rounded-lg border border-brand-primary/40 text-ink-primary dark:text-brand-primary/95 hover:bg-brand-primary/12 inline-flex items-center gap-1.5"
                    >
                      <MessageCircle className="h-3 w-3" />
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
