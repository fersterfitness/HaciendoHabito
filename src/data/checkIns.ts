/**
 * Check-ins: formularios, invitaciones, respuestas y recordatorios semanales.
 * Cada función devuelve la consulta de Supabase tal cual ({ data, error }).
 */

import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

const RESPONSE_COLUMNS =
  'id, invite_id, submitted_at, responses, testimonial_consent, responder_email, email_verified, trainer_replied_at, trainer_note'

export type CheckInFormPayload = {
  owner_id: string
  title: string
  intro: string | null
  questions: Json
  is_active: boolean
}

export type CheckInSchedulePayload = {
  owner_id: string
  form_id: string
  day_of_week: number
  timezone: string
  prefer_group_whatsapp: boolean
  is_enabled: boolean
}

export const checkInRepo = {
  listForms: (ownerId: string) =>
    supabase.from('check_in_forms').select('*').eq('owner_id', ownerId).order('updated_at', { ascending: false }),

  createForm: (payload: CheckInFormPayload) => supabase.from('check_in_forms').insert(payload).select('*').single(),

  updateForm: (id: string, ownerId: string, payload: CheckInFormPayload) =>
    supabase.from('check_in_forms').update(payload).eq('id', id).eq('owner_id', ownerId),

  deleteForm: (id: string, ownerId: string) => supabase.from('check_in_forms').delete().eq('id', id).eq('owner_id', ownerId),

  listActiveStudents: (ownerId: string) =>
    supabase.from('students').select('*').eq('owner_id', ownerId).eq('status', 'activo').order('full_name'),

  listStudentRoutines: (ownerId: string) =>
    supabase.from('routines').select('id, student_id, name, start_date, end_date').eq('owner_id', ownerId).not('student_id', 'is', null),

  listSchedules: (ownerId: string) =>
    supabase
      .from('check_in_send_schedules')
      .select('*, form:check_in_forms(title)')
      .eq('owner_id', ownerId)
      .order('day_of_week', { ascending: true }),

  createSchedule: (payload: CheckInSchedulePayload) => supabase.from('check_in_send_schedules').insert(payload),

  deleteSchedule: (id: string, ownerId: string) =>
    supabase.from('check_in_send_schedules').delete().eq('id', id).eq('owner_id', ownerId),

  setScheduleEnabled: (id: string, ownerId: string, enabled: boolean) =>
    supabase.from('check_in_send_schedules').update({ is_enabled: enabled }).eq('id', id).eq('owner_id', ownerId),

  /** Invitaciones de varios formularios, con nombre del alumno y título del formulario. */
  invitesForForms: (formIds: string[]) =>
    supabase
      .from('check_in_invites')
      .select('id, form_id, student_id, student:students(full_name), form:check_in_forms(title)')
      .in('form_id', formIds),

  /** Invitaciones de un formulario, con el link (token) y datos del alumno. */
  invitesForForm: (formId: string) =>
    supabase.from('check_in_invites').select('id, token, student_id, student:students(full_name, email)').eq('form_id', formId),

  invitedStudentIds: (formId: string, studentIds: string[]) =>
    supabase.from('check_in_invites').select('student_id').eq('form_id', formId).in('student_id', studentIds),

  createInvites: (rows: { form_id: string; student_id: string }[]) => supabase.from('check_in_invites').insert(rows),

  responsesForInvites: (inviteIds: string[], newestFirst = false) => {
    const q = supabase.from('check_in_responses').select(RESPONSE_COLUMNS).in('invite_id', inviteIds)
    return newestFirst ? q.order('submitted_at', { ascending: false }) : q
  },

  /** Marca una respuesta como contestada (o no) y guarda la nota privada del entrenador. */
  setResponseTrainerStatus: (responseId: string, replied: boolean, note: string | null) =>
    supabase.rpc('set_check_in_response_trainer_status', { p_response_id: responseId, p_replied: replied, p_note: note }),
}
