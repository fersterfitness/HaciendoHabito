import { useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { CalendarClock, ChevronLeft, ChevronRight, Grid2x2, List } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { Appointment, Student, AppointmentStatus } from '@/types/database'
import toast from 'react-hot-toast'
import { addDays, addWeeks, format, isSameDay, parseISO, startOfWeek } from 'date-fns'
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

type AppointmentRow = Appointment & { student?: Pick<Student, 'full_name'> | null }
type ViewMode = 'week' | 'agenda'

const STATUS_BADGE: Record<AppointmentStatus, string> = {
  scheduled: 'bg-blue-500/10 text-blue-300 border-blue-500/40',
  confirmed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
  completed: 'bg-violet-500/10 text-violet-300 border-violet-500/40',
  cancelled: 'bg-rose-500/10 text-rose-300 border-rose-500/40',
  no_show: 'bg-amber-500/10 text-amber-300 border-amber-500/40',
}

export function NutritionAppointmentsPage() {
  const { user, profile } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [form, setForm] = useState({
    student_id: '',
    starts_at: '',
    ends_at: '',
    title: '',
    location: '',
    notes: '',
  })

  const profileType = profile?.role === 'nutritionist' ? 'nutritionist' : 'trainer'

  useEffect(() => {
    if (!user) return
    ;(async () => {
      setLoading(true)
      const [{ data: stData, error: stErr }, { data: apData, error: apErr }] = await Promise.all([
        supabase.from('students').select('*').eq('owner_id', user.id).order('full_name'),
        supabase
          .from('appointments')
          .select('*, student:students(full_name)')
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
  const weekAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.status !== 'cancelled')
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [appointments]
  )

  async function createAppointment() {
    if (!user) return
    if (!form.student_id || !form.starts_at || !form.title.trim()) {
      toast.error('Completá paciente, fecha/hora y título')
      return
    }
    setCreating(true)
    try {
      const startsAtIso = new Date(form.starts_at).toISOString()
      const endsAtIso = form.ends_at ? new Date(form.ends_at).toISOString() : null
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
        .select('*, student:students(full_name)')
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
      setForm({ student_id: '', starts_at: '', ends_at: '', title: '', location: '', notes: '' })
      if (!calendarData?.googleEventId && !calendarError) {
        toast.success('Turno agendado')
      }
    } finally {
      setCreating(false)
    }
  }

  async function updateStatus(id: string, status: AppointmentStatus) {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id)
    if (error) {
      toast.error(error.message)
      return
    }
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
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
              Fin (opcional)
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm((prev) => ({ ...prev, ends_at: e.target.value }))}
                className="mt-1 w-full rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary px-3 py-2.5"
              />
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
          <div className="mt-3">
            <Button size="sm" onClick={createAppointment} loading={creating}>
              Guardar turno
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
                  Semana del {format(weekAnchor, "d 'de' MMMM", { locale: es })}
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
                  onClick={() => setViewMode('agenda')}
                  className={`px-2 py-1.5 text-xs flex items-center gap-1 ${viewMode === 'agenda' ? 'bg-brand-primary/15 text-brand-primary' : 'text-ink-secondary'}`}
                >
                  <List className="h-3.5 w-3.5" /> Agenda
                </button>
              </div>
              <button
                type="button"
                onClick={() => setWeekAnchor((prev) => addWeeks(prev, -1))}
                className="p-1.5 rounded-lg border border-surface-border text-ink-secondary hover:text-ink-primary"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setWeekAnchor((prev) => addWeeks(prev, 1))}
                className="p-1.5 rounded-lg border border-surface-border text-ink-secondary hover:text-ink-primary"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {viewMode === 'week' ? (
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
                          <div
                            key={a.id}
                            className={`rounded-lg border px-2 py-1 ${a.profile_type === 'nutritionist' ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-blue-500/40 bg-blue-500/10'}`}
                          >
                            <p className="text-xs font-medium text-ink-primary truncate">{a.title}</p>
                            <p className="text-[11px] text-ink-secondary">
                              {format(parseISO(a.starts_at), 'HH:mm')} · {a.student?.full_name ?? 'Paciente'}
                            </p>
                          </div>
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
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateStatus(a.id, 'confirmed')}
                        className="text-[11px] px-2 py-1 rounded-lg border border-surface-border text-ink-secondary hover:text-ink-primary"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(a.id, 'completed')}
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
                    </div>
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
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
