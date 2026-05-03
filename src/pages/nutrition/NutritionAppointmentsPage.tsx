import { useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Grid2x2, List, MessageCircle } from 'lucide-react'
import {
  buildAppointmentConfirmationWaUrl,
  buildAppointmentFeedbackWaUrl,
} from '@/lib/whatsapp'
import { STUDENT_PHONE_FORMAT_HINT } from '@/lib/studentPhone'
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

const STATUS_BADGE: Record<AppointmentStatus, string> = {
  scheduled: 'bg-blue-500/10 text-blue-300 border-blue-500/40',
  confirmed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
  completed: 'bg-violet-500/10 text-violet-300 border-violet-500/40',
  cancelled: 'bg-rose-500/10 text-rose-300 border-rose-500/40',
  no_show: 'bg-amber-500/10 text-amber-300 border-amber-500/40',
}

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
  const [weekPopover, setWeekPopover]   = useState<{ apptId: string; top: number; left: number } | null>(null)

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
        toast.error(`Turno guardado, pero falló Google Calendar: ${functionMessage}`)
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
              <button type="button" className="mt-2 text-xs font-medium text-brand-primary" onClick={() => toast.dismiss(t.id)}>
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

  async function updateStatus(id: string, status: AppointmentStatus, sessionNotes?: string) {
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
              <button type="button" className="mt-2 text-xs font-medium text-brand-primary" onClick={() => toast.dismiss(t.id)}>
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
      <div className="px-4 lg:px-6 py-6 space-y-4">
        <Card>
          <CardTitle className="mb-3">Agendar turno</CardTitle>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-xs text-ink-secondary">
              Paciente
              <select
                value={form.student_id}
                onChange={(e) => setForm((prev) => ({ ...prev, student_id: e.target.value }))}
                className="mt-1 w-full rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary px-3 py-2.5"
              >
                <option value="">Seleccionar...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ink-secondary">
              Título
              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Consulta de seguimiento"
                className="mt-1 w-full rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary px-3 py-2.5"
              />
            </label>
            <label className="text-xs text-ink-secondary">
              Inicio
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm((prev) => ({ ...prev, starts_at: e.target.value }))}
                className="mt-1 w-full rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary px-3 py-2.5"
              />
            </label>
            <label className="text-xs text-ink-secondary">
              Duración
              <select
                value={form.duration_minutes}
                onChange={(e) => setForm((prev) => ({ ...prev, duration_minutes: Number(e.target.value) }))}
                className="mt-1 w-full rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary px-3 py-2.5"
              >
                {APPOINTMENT_DURATION_OPTIONS_MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {m} min{m >= 60 ? ` (${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''})` : ''}
                  </option>
                ))}
              </select>
              <span className="block text-[10px] text-ink-muted mt-1 leading-snug">
                El horario de fin se calcula desde el inicio (de 15 en 15 minutos).
              </span>
            </label>
            <label className="text-xs text-ink-secondary">
              Ubicación
              <input
                value={form.location}
                onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="Online / Consultorio..."
                className="mt-1 w-full rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary px-3 py-2.5"
              />
            </label>
            <label className="text-xs text-ink-secondary md:col-span-2">
              Nota
              <textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary px-3 py-2.5"
              />
            </label>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
                className="accent-brand-primary h-4 w-4"
              />
              <span className="text-xs text-ink-secondary">Repetir semanalmente</span>
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
          <div className="mt-3">
            <Button size="sm" onClick={createAppointment} loading={creating}>
              {recurring ? `Agendar ${recurWeeks} turnos` : 'Guardar turno'}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                <CalendarClock className="h-4 w-4 text-brand-primary" />
              </div>
              <div>
                <CardTitle className="mb-0.5">Calendario de turnos</CardTitle>
                <p className="text-xs text-ink-secondary">
                  {viewMode === 'month'
                    ? format(monthAnchor, "MMMM yyyy", { locale: es })
                    : `Semana del ${format(weekAnchor, "d 'de' MMMM", { locale: es })}`
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-surface-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode('week')}
                  className={`px-2 py-1.5 text-xs flex items-center gap-1 ${viewMode === 'week' ? 'bg-brand-primary/15 text-brand-primary' : 'text-ink-secondary'}`}
                >
                  <Grid2x2 className="h-3.5 w-3.5" /> Semana
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('month')}
                  className={`px-2 py-1.5 text-xs flex items-center gap-1 ${viewMode === 'month' ? 'bg-brand-primary/15 text-brand-primary' : 'text-ink-secondary'}`}
                >
                  <CalendarDays className="h-3.5 w-3.5" /> Mes
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('agenda')}
                  className={`px-2 py-1.5 text-xs flex items-center gap-1 ${viewMode === 'agenda' ? 'bg-brand-primary/15 text-brand-primary' : 'text-ink-secondary'}`}
                >
                  <List className="h-3.5 w-3.5" /> Agenda
                </button>
              </div>
              <button
                type="button"
                onClick={handlePrev}
                className="p-1.5 rounded-lg border border-surface-border text-ink-secondary hover:text-ink-primary"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="p-1.5 rounded-lg border border-surface-border text-ink-secondary hover:text-ink-primary"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
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
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold mb-1 ${
                        today
                          ? 'bg-brand-primary text-white'
                          : 'text-ink-secondary'
                      }`}>
                        {format(day, 'd')}
                      </span>
                      <div className="space-y-0.5">
                        {dayAppts.slice(0, 3).map((a) => (
                          <div
                            key={a.id}
                            title={`${format(parseISO(a.starts_at), 'HH:mm')} — ${a.title} (${a.student?.full_name ?? '—'})`}
                            className={`truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight cursor-default ${
                              a.status === 'confirmed'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-brand-primary/15 text-brand-primary'
                            }`}
                          >
                            {format(parseISO(a.starts_at), 'HH:mm')} {a.student?.full_name?.split(' ')[0] ?? a.title}
                          </div>
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
                return (
                  <div key={day.toISOString()} className="rounded-xl border border-surface-border bg-surface-elevated min-h-44 p-2">
                    <p className="text-[11px] uppercase tracking-wide text-ink-secondary">
                      {format(day, 'EEE', { locale: es })}
                    </p>
                    <p className="text-sm font-semibold text-ink-primary">{format(day, 'd')}</p>
                    <div className="mt-2 space-y-1.5">
                      {dayAppointments.length === 0 ? (
                        <p className="text-[11px] text-ink-secondary">Sin turnos</p>
                      ) : (
                        dayAppointments.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={(e) => {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                              if (weekPopover?.apptId === a.id) { setWeekPopover(null) }
                              else setWeekPopover({ apptId: a.id, top: rect.bottom + 4, left: rect.left })
                            }}
                            className={`w-full text-left rounded-lg border px-2 py-1 transition-opacity hover:opacity-90 ${a.profile_type === 'nutritionist' ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-blue-500/40 bg-blue-500/10'}`}
                          >
                            <p className="text-xs font-medium text-ink-primary truncate">{a.title}</p>
                            <p className="text-[11px] text-ink-secondary">
                              {format(parseISO(a.starts_at), 'HH:mm')} · {a.student?.full_name ?? 'Paciente'}
                            </p>
                          </button>
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
                  <div key={a.id} className="rounded-xl border border-surface-border bg-surface-elevated px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink-primary">{a.title}</p>
                        <p className="text-xs text-ink-secondary">
                          {a.student?.full_name ?? 'Paciente'} · {new Date(a.starts_at).toLocaleString('es-AR')}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-full border uppercase tracking-wide ${STATUS_BADGE[a.status]}`}>
                        {a.status}
                      </span>
                    </div>
                    {completingId === a.id ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          autoFocus
                          rows={3}
                          value={completingNote}
                          onChange={(e) => setCompletingNote(e.target.value)}
                          placeholder="Notas de la sesión (opcional)..."
                          className="w-full rounded-xl bg-surface-input border border-brand-primary/40 text-ink-primary text-xs px-3 py-2 resize-none focus:outline-none focus:border-brand-primary"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await updateStatus(a.id, 'completed', completingNote)
                              setCompletingId(null)
                              setCompletingNote('')
                            }}
                            className="text-[11px] px-3 py-1.5 rounded-lg bg-brand-primary text-white font-medium hover:bg-brand-primary/90"
                          >
                            Guardar y completar
                          </button>
                          <button
                            type="button"
                            onClick={() => { setCompletingId(null); setCompletingNote('') }}
                            className="text-[11px] px-2 py-1 rounded-lg border border-surface-border text-ink-secondary hover:text-ink-primary"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateStatus(a.id, 'confirmed')}
                          className="text-[11px] px-2 py-1 rounded-lg border border-surface-border text-ink-secondary hover:text-ink-primary"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => { setCompletingId(a.id); setCompletingNote('') }}
                          className="text-[11px] px-2 py-1 rounded-lg border border-surface-border text-ink-secondary hover:text-ink-primary"
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
                          className="text-[11px] px-2 py-1 rounded-lg border border-emerald-600/40 text-emerald-700 dark:text-emerald-300 bg-emerald-600/10 hover:bg-emerald-600/15 inline-flex items-center gap-1"
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
        </Card>

        <Card>
          <CardTitle className="mb-3">Historial reciente</CardTitle>
          {history.length === 0 ? (
            <p className="text-sm text-ink-secondary">Todavía no hay turnos completados o cerrados.</p>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 8).map((a) => (
                <div key={a.id} className="rounded-xl border border-surface-border bg-surface-elevated px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink-primary">{a.title}</p>
                    <span className={`text-[10px] px-2 py-1 rounded-full border uppercase tracking-wide ${STATUS_BADGE[a.status]}`}>
                      {a.status}
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
                      className="mt-2 text-[11px] px-2 py-1 rounded-lg border border-emerald-600/40 text-emerald-700 dark:text-emerald-300 bg-emerald-600/10 hover:bg-emerald-600/15 inline-flex items-center gap-1"
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

      {/* ── Week view appointment popover ── */}
      {weekPopover && (() => {
        const appt = appointments.find((a) => a.id === weekPopover.apptId)
        if (!appt) return null
        return (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setWeekPopover(null)} />
            <div
              style={{ position: 'fixed', top: weekPopover.top, left: weekPopover.left }}
              className="z-[9999] w-52 rounded-2xl border border-surface-border bg-surface-card shadow-2xl p-3 space-y-2"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs font-semibold text-ink-primary truncate">{appt.title}</p>
              <p className="text-[11px] text-ink-muted">
                {format(parseISO(appt.starts_at), 'HH:mm')} · {appt.student?.full_name ?? '—'}
              </p>
              {(appt.status === 'scheduled' || appt.status === 'confirmed') && (
                <div className="space-y-1 pt-1 border-t border-surface-border">
                  <button
                    type="button"
                    onClick={() => { void updateStatus(appt.id, 'confirmed'); setWeekPopover(null) }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-ink-secondary hover:bg-surface-elevated hover:text-ink-primary transition-colors"
                  >
                    ✓ Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCompletingId(appt.id); setCompletingNote(''); setWeekPopover(null) }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-ink-secondary hover:bg-surface-elevated hover:text-ink-primary transition-colors"
                  >
                    ✓ Completar (con nota)
                  </button>
                  <button
                    type="button"
                    onClick={() => { openAppointmentConfirmationWa(appt); setWeekPopover(null) }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors inline-flex items-center gap-1.5"
                  >
                    <MessageCircle className="h-3 w-3" /> WhatsApp confirmación
                  </button>
                  <button
                    type="button"
                    onClick={() => { void updateStatus(appt.id, 'cancelled'); setWeekPopover(null) }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-status-expired hover:bg-status-expired/10 transition-colors"
                  >
                    ✕ Cancelar
                  </button>
                </div>
              )}
            </div>
          </>
        )
      })()}
    </div>
  )
}
