import { useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageToolbar } from '@/components/ui/PageToolbar'
import { Spinner } from '@/components/ui/Spinner'
import { Tooltip as UiTooltip } from '@/components/ui/Tooltip'
import { Popover } from '@/components/ui/Popover'
import {
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Grid2x2,
  List,
  MessageCircle,
} from 'lucide-react'
import {
  buildAppointmentConfirmationWaUrl,
  buildAppointmentFeedbackWaUrl,
} from '@/lib/whatsapp'
import { parseGoogleCalendarSyncFailure } from '@/lib/googleCalendarSyncErrors'
import { STUDENT_PHONE_FORMAT_HINT } from '@/lib/studentPhone'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Appointment, Student, AppointmentStatus } from '@/types/database'
import toast from 'react-hot-toast'
import {
  addDays, addMonths, addWeeks, eachDayOfInterval,
  endOfMonth, endOfWeek, format, getMonth, isSameDay, isToday,
  parseISO, startOfMonth, startOfWeek,
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

type AppointmentRow = Appointment & { student?: Pick<Student, 'full_name' | 'phone'> | null }

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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 shadow-sm"
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
    'bg-emerald-500/[0.1] text-emerald-950 dark:text-emerald-400/95 border-emerald-500/30',
  completed:
    'bg-emerald-500/[0.06] text-emerald-900 dark:text-emerald-400/85 border-emerald-500/22',
  cancelled:
    'bg-surface-elevated/50 text-ink-muted border-surface-border line-through decoration-ink-muted/60',
  no_show:
    'bg-status-expiring/10 text-status-expiring border-status-expiring/35',
}

function agendaCardAccent(status: AppointmentStatus): string {
  if (status === 'confirmed') return 'border-l-emerald-500'
  return 'border-l-zinc-500/85 dark:border-l-zinc-500/55'
}

const FIELD_ROW =
  'mt-1 w-full rounded-lg bg-surface-input border border-surface-inputBorder text-ink-primary px-3 py-2 text-sm placeholder:text-ink-muted/60'

/** Opciones de duración del turno (minutos, de 15 en 15 hasta 8 h). */
const APPOINTMENT_DURATION_OPTIONS_MINUTES = Array.from({ length: 32 }, (_, i) => (i + 1) * 15)

export function NutritionAppointmentsPage() {
  const { user, profile } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
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
  // Week view appointment popover
  const [weekPopoverOpen, setWeekPopoverOpen] = useState(false)
  const [weekPopoverApptId, setWeekPopoverApptId] = useState<string | null>(null)

  const profileType = profile?.role === 'nutritionist' ? 'nutritionist' : 'trainer'
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [completingNote, setCompletingNote] = useState('')

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      setLoading(true)
      const [{ data: stData, error: stErr }, { data: apData, error: apErr }] = await Promise.all([
        supabase.from('students').select('*').eq('owner_id', user.id).order('full_name'),
        supabase
          .from('appointments')
          .select('*, student:students(full_name, phone)')
          .eq('owner_id', user.id)
          .order('starts_at', { ascending: true }),
      ])
      if (stErr || apErr) {
        toast.error(stErr?.message ?? apErr?.message ?? 'No se pudieron cargar turnos')
      } else {
        setStudents((stData as Student[]) ?? [])
        setAppointments((apData as AppointmentRow[]) ?? [])
      }
      setLoading(false)
    })()
  }, [user])

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
      await supabase.from('appointment_reminders').insert(reminderRows)
      const { data: calendarData, error: calendarError } = await supabase.functions.invoke('create-google-calendar-event', {
        body: { appointmentId: appointment.id },
      })

      if (calendarError) {
        const functionMessage = await parseFunctionErrorMessage(calendarError)
        const { title, body, kind } = parseGoogleCalendarSyncFailure(functionMessage)
        toast.custom(
          (t) => (
            <div className="max-w-md rounded-2xl border border-surface-border bg-surface-card shadow-lg px-4 py-3 flex flex-col gap-2">
              <p className="text-sm font-semibold text-ink-primary leading-snug">{title}</p>
              <p className="text-xs text-ink-secondary leading-relaxed">{body}</p>
              <button
                type="button"
                className="self-end px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-400"
                onClick={() => toast.dismiss(t.id)}
              >
                Entendido
              </button>
            </div>
          ),
          { duration: kind === 'oauth_revoked' ? 28000 : 16000 },
        )
      } else if (calendarData?.googleEventId) {
        appointment.google_event_id = calendarData.googleEventId as string
        toast.success('Turno agendado y sincronizado con Google Calendar')
      } else {
        toast.error('Turno guardado, pero no se recibió ID de Google Calendar')
      }

      setAppointments((prev) => [...prev, appointment].sort((a, b) => a.starts_at.localeCompare(b.starts_at)))
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

      if (!calendarData?.googleEventId && !calendarError) {
        toast.success('Turno agendado')
      }
    } finally {
      setCreating(false)
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
  }

  if (loading) {
    return (
      <div>
        <Header title="Turnos" />
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
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
              viewMode === 'agenda'
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
              <CalendarClock className="hidden h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-500 sm:block" aria-hidden />
            </div>
          </PageToolbar>

          <div className="p-4 sm:p-6">
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
                  const dayAppts = appointments
                    .filter((a) => a.status !== 'cancelled' && isSameDay(parseISO(a.starts_at), day))
                    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
                  const isCurrentMonth = getMonth(day) === getMonth(monthAnchor)
                  const today = isToday(day)
                  return (
                    <div
                      key={day.toISOString()}
                      className={`bg-surface-elevated min-h-[80px] p-1.5 ${!isCurrentMonth ? 'opacity-40' : ''}`}
                    >
                      <span className={cn(
                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold mb-1',
                        today
                          ? 'bg-zinc-500/[0.12] text-zinc-900 ring-2 ring-zinc-400/45 dark:bg-zinc-500/[0.2] dark:text-zinc-100 dark:ring-zinc-500/40'
                          : 'text-ink-secondary',
                      )}>
                        {format(day, 'd')}
                      </span>
                      <div className="space-y-0.5">
                        {dayAppts.slice(0, 3).map((a) => (
                          <UiTooltip
                            key={a.id}
                            content={`${format(parseISO(a.starts_at), 'HH:mm')} — ${a.title} (${a.student?.full_name ?? '—'})`}
                          >
                            <div
                              className={cn(
                                'truncate rounded border px-1 py-0.5 text-[10px] font-medium leading-tight cursor-default',
                                a.status === 'confirmed'
                                  ? 'border-emerald-400/35 bg-emerald-500/[0.14] text-emerald-950 dark:text-emerald-300/95'
                                  : a.status === 'scheduled'
                                    ? 'border-brand-tertiary/35 bg-brand-tertiary/10 text-brand-tertiary'
                                    : 'border-zinc-300/70 bg-zinc-500/[0.08] text-zinc-900 dark:border-zinc-600/55 dark:bg-zinc-500/[0.14] dark:text-zinc-200',
                              )}
                            >
                              {format(parseISO(a.starts_at), 'HH:mm')} {a.student?.full_name?.split(' ')[0] ?? a.title}
                            </div>
                          </UiTooltip>
                        ))}
                        {dayAppts.length > 3 && (
                          <p className="text-[9px] text-ink-muted pl-1">+{dayAppts.length - 3} más</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : viewMode === 'week' ? (
            <div className="grid md:grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const dayAppointments = weekAppointments.filter((a) => isSameDay(parseISO(a.starts_at), day))
                const dayIsToday = isToday(day)
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'rounded-xl border min-h-44 p-2 transition-shadow',
                      dayIsToday
                        ? 'border-zinc-300/85 bg-zinc-500/[0.06] shadow-sm shadow-black/[0.06] dark:border-zinc-600 dark:bg-zinc-500/[0.1] dark:shadow-black/20'
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
                                  'w-full text-left rounded-lg border px-2 py-1 transition-colors border-l-[3px]',
                                  a.status === 'confirmed'
                                    ? 'border border-emerald-500/25 border-l-emerald-500 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.13]'
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
                              </button>
                            )}
                          >
                            <p className="text-xs font-semibold text-ink-primary truncate">{a.title}</p>
                            <p className="text-[11px] text-ink-muted">
                              {format(parseISO(a.starts_at), 'HH:mm')} · {a.student?.full_name ?? '—'}
                            </p>
                            {(a.status === 'scheduled' || a.status === 'confirmed') && (
                              <div className="space-y-1 pt-1 border-t border-surface-border">
                                <button
                                  type="button"
                                  onClick={() => { void updateStatus(a.id, 'confirmed'); setWeekPopoverOpen(false); setWeekPopoverApptId(null) }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-emerald-900 dark:text-emerald-400/95 hover:bg-emerald-500/12 transition-colors"
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
                                  onClick={() => { openAppointmentConfirmationWa(a); setWeekPopoverOpen(false); setWeekPopoverApptId(null) }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-emerald-900/90 dark:text-emerald-400/90 hover:bg-emerald-500/12 transition-colors inline-flex items-center gap-1.5"
                                >
                                  <MessageCircle className="h-3 w-3" /> WhatsApp confirmación
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
            <div className="space-y-2 mt-1">
              {upcoming.length === 0 ? (
                <p className="text-sm text-ink-secondary">No hay turnos agendados.</p>
              ) : (
                upcoming.map((a) => (
                  <div
                    key={a.id}
                    className={cn(
                      'rounded-xl border border-surface-border bg-surface-elevated/45 py-2 pl-3 pr-3 border-l-[3px]',
                      agendaCardAccent(a.status),
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink-primary">{a.title}</p>
                        <p className="text-xs text-ink-secondary">
                          {a.student?.full_name ?? 'Paciente'} · {new Date(a.starts_at).toLocaleString('es-AR')}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-md border font-medium ${STATUS_BADGE[a.status]}`}>
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
                          className="text-[11px] px-2 py-1 rounded-lg border border-emerald-500/35 text-emerald-900 dark:text-emerald-400/95 hover:bg-emerald-500/12"
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
                        <button
                          type="button"
                          onClick={() => openAppointmentConfirmationWa(a)}
                          title="Abre WhatsApp con mensaje para confirmar el turno (misma plantilla que al crear)."
                          className="text-[11px] px-2.5 py-1 rounded-lg border border-emerald-500/38 text-emerald-900 dark:text-emerald-400/95 hover:bg-emerald-500/12 inline-flex items-center gap-1"
                        >
                          <MessageCircle className="h-3 w-3" />
                          Confirmación WA
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
          </div>
        </Card>

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
                Paciente
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

        <Card>
          <CardTitle className="mb-2 font-medium text-base">Historial reciente</CardTitle>
          {history.length === 0 ? (
            <p className="text-sm text-ink-secondary">Todavía no hay turnos completados o cerrados.</p>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 8).map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    'rounded-xl border border-surface-border bg-surface-elevated/45 px-3 py-2 border-l-[3px]',
                    a.status === 'completed' && 'border-l-emerald-500/85',
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
                    {a.student?.full_name ?? 'Paciente'} · {new Date(a.starts_at).toLocaleString('es-AR')}
                  </p>
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
                      className="mt-2 text-[11px] px-2.5 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-900 dark:text-emerald-400/95 hover:bg-emerald-500/12 inline-flex items-center gap-1.5"
                    >
                      <MessageCircle className="h-3 w-3" />
                      Feedback WA
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

    </div>
  )
}
