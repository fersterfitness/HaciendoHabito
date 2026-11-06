import { supabase } from '@/lib/supabase'
import type { Appointment } from '@/types/database'

/**
 * Agenda un turno como lo hace la Agenda: controla que no se pise con otro, crea los recordatorios
 * (app 24 h antes, mail 2 h antes) e intenta pasarlo a Google Calendar.
 */
export async function bookAppointment({
  ownerId,
  studentId,
  profileType,
  startsAt,
  durationMin,
  title,
}: {
  ownerId: string
  studentId: string
  profileType: Appointment['profile_type']
  startsAt: Date
  durationMin: number
  title: string
}): Promise<{ appointment: Appointment | null; error: string | null; googleSynced: boolean }> {
  const startMs = startsAt.getTime()
  const endMs = startMs + durationMin * 60_000
  const dayStart = new Date(startMs - 24 * 3_600_000).toISOString()
  const dayEnd = new Date(endMs).toISOString()

  const { data: around, error: aroundError } = await supabase
    .from('appointments')
    .select('title, starts_at, ends_at, status')
    .eq('owner_id', ownerId)
    .neq('status', 'cancelled')
    .gte('starts_at', dayStart)
    .lt('starts_at', dayEnd)
  if (aroundError) return { appointment: null, error: aroundError.message, googleSynced: false }
  const clash = ((around ?? []) as Pick<Appointment, 'title' | 'starts_at' | 'ends_at'>[]).find((a) => {
    const s = new Date(a.starts_at).getTime()
    const e = a.ends_at ? new Date(a.ends_at).getTime() : s + 45 * 60_000
    return startMs < e && endMs > s
  })
  if (clash) {
    const hh = new Date(clash.starts_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    return { appointment: null, error: `Ese horario se pisa con «${clash.title}» (${hh}).`, googleSynced: false }
  }

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      owner_id: ownerId,
      student_id: studentId,
      profile_type: profileType,
      starts_at: new Date(startMs).toISOString(),
      ends_at: new Date(endMs).toISOString(),
      title,
      location: null,
      notes: null,
      status: 'scheduled',
    })
    .select('*')
    .single()
  if (error) return { appointment: null, error: error.message, googleSynced: false }
  const appointment = data as Appointment

  await supabase.from('appointment_reminders').insert([
    { owner_id: ownerId, appointment_id: appointment.id, channel: 'app', scheduled_for: new Date(startMs - 24 * 3_600_000).toISOString(), status: 'pending' },
    { owner_id: ownerId, appointment_id: appointment.id, channel: 'email', scheduled_for: new Date(startMs - 2 * 3_600_000).toISOString(), status: 'pending' },
  ])

  const { data: g, error: gError } = await supabase.functions.invoke('create-google-calendar-event', { body: { appointmentId: appointment.id } })
  const googleSynced = !gError && Boolean((g as { googleEventId?: string } | null)?.googleEventId)
  return { appointment, error: null, googleSynced }
}
