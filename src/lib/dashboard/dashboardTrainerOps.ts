import { supabase } from '@/lib/supabase'
import {
  buildResourceShareMessage,
  checkInGroupMessage,
  buildWhatsAppGroupPickUrl,
  buildWhatsAppUrl,
  normalizePhoneForWhatsApp,
} from '@/lib/whatsapp'
import type { CheckInSendSchedule, TrainerResourceSendSchedule } from '@/types/database'

export type DashboardCheckInQuickSend = {
  scheduleId: string
  formId: string
  formTitle: string
  publicToken: string | null
  intro: string | null
}

export type DashboardResourceQuickSend = {
  scheduleId: string
  label: string
  message: string
}

export type DashboardMissingCheckInStudent = {
  id: string
  full_name: string
  phone: string | null
}

export function checkInSharedPublicUrl(publicToken: string): string {
  return `${window.location.origin}/form/check-in/compartido/${publicToken}`
}

export function checkInPersonalUrl(token: string): string {
  return `${window.location.origin}/form/check-in/${token}`
}

export function openCheckInGroupWhatsApp(send: DashboardCheckInQuickSend): void {
  if (!send.publicToken) return
  const msg = checkInGroupMessage({
    formTitle: send.formTitle,
    intro: send.intro,
    sharedUrl: checkInSharedPublicUrl(send.publicToken),
    entries: [],
  })
  window.open(buildWhatsAppGroupPickUrl(msg), '_blank', 'noopener,noreferrer')
}

export function openResourceGroupWhatsApp(send: DashboardResourceQuickSend): void {
  window.open(buildWhatsAppGroupPickUrl(send.message), '_blank', 'noopener,noreferrer')
}

export function openMissingStudentCheckInReminder(params: {
  studentName: string
  phone: string | null | undefined
  formTitle: string
  sharedUrl: string
  intro?: string | null
}): boolean {
  const digits = normalizePhoneForWhatsApp(params.phone)
  if (!digits) return false
  const first = params.studentName.trim().split(/\s+/)[0] || params.studentName.trim()
  const msg = [
    `Hola ${first},`,
    '',
    `Te falta completar el check-in «${params.formTitle.trim()}».`,
    '',
    params.intro?.trim() ?? '',
    params.sharedUrl.trim(),
    '',
    'Cuando puedas, completalo. ¡Gracias!',
  ]
    .filter(Boolean)
    .join('\n')
  window.open(buildWhatsAppUrl(digits, msg), '_blank', 'noopener,noreferrer')
  return true
}

/** Alumnos activos sin respuesta de check-in en los últimos `days` días (cualquier formulario del owner). */
export async function loadStudentsMissingCheckIn(
  ownerId: string,
  days = 7,
): Promise<DashboardMissingCheckInStudent[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const [stuRes, formsRes] = await Promise.all([
    supabase
      .from('students')
      .select('id, full_name, phone, email')
      .eq('owner_id', ownerId)
      .eq('status', 'activo')
      .order('full_name'),
    supabase.from('check_in_forms').select('id').eq('owner_id', ownerId),
  ])

  if (stuRes.error || formsRes.error) return []
  const students = stuRes.data ?? []
  const formIds = (formsRes.data ?? []).map((f) => f.id)
  if (!students.length || !formIds.length) {
    return students.map((s) => ({ id: s.id, full_name: s.full_name, phone: s.phone ?? null }))
  }

  const { data: invites } = await supabase
    .from('check_in_invites')
    .select('id, student_id')
    .in('form_id', formIds)

  const inviteRows = invites ?? []
  const inviteIds = inviteRows.map((i) => i.id)
  const inviteStudentById = new Map(inviteRows.map((i) => [i.id, i.student_id]))
  const submittedStudentIds = new Set<string>()

  if (inviteIds.length) {
    const { data: responses } = await supabase
      .from('check_in_responses')
      .select('invite_id, responder_email')
      .in('invite_id', inviteIds)
      .gte('submitted_at', since.toISOString())

    const emailToStudentId = new Map<string, string>()
    for (const s of students) {
      const em = s.email?.trim().toLowerCase()
      if (em) emailToStudentId.set(em, s.id)
    }

    for (const r of responses ?? []) {
      const sid = inviteStudentById.get(r.invite_id)
      if (sid) submittedStudentIds.add(sid)
      const em = r.responder_email?.trim().toLowerCase()
      if (em) {
        const matched = emailToStudentId.get(em)
        if (matched) submittedStudentIds.add(matched)
      }
    }
  }

  return students
    .filter((s) => !submittedStudentIds.has(s.id))
    .map((s) => ({ id: s.id, full_name: s.full_name, phone: s.phone ?? null }))
}

export async function loadDashboardQuickSends(
  ownerId: string,
  dueCheckInSchedules: Array<CheckInSendSchedule & { form: { title: string } | null }>,
  dueResourceSchedules: Array<
    TrainerResourceSendSchedule & {
      resource: { title: string; url: string; description: string | null } | null
      template: { title: string; body: string } | null
    }
  >,
): Promise<{
  checkInSends: DashboardCheckInQuickSend[]
  resourceSends: DashboardResourceQuickSend[]
}> {
  const checkInSends: DashboardCheckInQuickSend[] = []
  const resourceSends: DashboardResourceQuickSend[] = []

  const checkInFormIds = [...new Set(dueCheckInSchedules.map((s) => s.form_id))]
  if (checkInFormIds.length) {
    const { data: forms } = await supabase
      .from('check_in_forms')
      .select('id, title, intro, public_token')
      .in('id', checkInFormIds)
    const byId = new Map((forms ?? []).map((f) => [f.id, f]))
    for (const sch of dueCheckInSchedules) {
      const f = byId.get(sch.form_id)
      if (!f) continue
      checkInSends.push({
        scheduleId: sch.id,
        formId: f.id,
        formTitle: f.title,
        publicToken: f.public_token ?? null,
        intro: f.intro ?? null,
      })
    }
  }

  for (const sch of dueResourceSchedules) {
    if (sch.template?.body?.trim()) {
      resourceSends.push({
        scheduleId: sch.id,
        label: sch.template.title,
        message: sch.template.body.trim(),
      })
    } else if (sch.resource?.url) {
      resourceSends.push({
        scheduleId: sch.id,
        label: sch.resource.title,
        message: buildResourceShareMessage(
          sch.resource.title,
          sch.resource.url,
          sch.resource.description?.trim() || null,
        ),
      })
    }
  }

  if (checkInSends.length === 0) {
    const { data: fallbackForm } = await supabase
      .from('check_in_forms')
      .select('id, title, intro, public_token')
      .eq('owner_id', ownerId)
      .eq('is_active', true)
      .not('public_token', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (fallbackForm?.public_token) {
      checkInSends.push({
        scheduleId: 'default-checkin',
        formId: fallbackForm.id,
        formTitle: fallbackForm.title,
        publicToken: fallbackForm.public_token,
        intro: fallbackForm.intro ?? null,
      })
    }
  }

  if (resourceSends.length === 0) {
    const { data: sched } = await supabase
      .from('trainer_resource_send_schedules')
      .select(
        'id, resource_id, template_id, resource:trainer_resources(title, url, description), template:trainer_message_templates(title, body)',
      )
      .eq('owner_id', ownerId)
      .eq('is_enabled', true)
      .order('day_of_week', { ascending: true })
      .limit(1)
      .maybeSingle()

    const row = sched as TrainerResourceSendSchedule & {
      resource: { title: string; url: string; description: string | null } | null
      template: { title: string; body: string } | null
    } | null

    if (row?.template?.body?.trim()) {
      resourceSends.push({
        scheduleId: row.id,
        label: row.template.title,
        message: row.template.body.trim(),
      })
    } else if (row?.resource?.url) {
      resourceSends.push({
        scheduleId: row.id,
        label: row.resource.title,
        message: buildResourceShareMessage(
          row.resource.title,
          row.resource.url,
          row.resource.description?.trim() || null,
        ),
      })
    } else {
      const { data: tpl } = await supabase
        .from('trainer_message_templates')
        .select('id, title, body')
        .eq('owner_id', ownerId)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (tpl?.body?.trim()) {
        resourceSends.push({
          scheduleId: `template-${tpl.id}`,
          label: tpl.title,
          message: tpl.body.trim(),
        })
      } else {
        const { data: res } = await supabase
          .from('trainer_resources')
          .select('id, title, url, description')
          .eq('owner_id', ownerId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (res?.url) {
          resourceSends.push({
            scheduleId: `resource-${res.id}`,
            label: res.title,
            message: buildResourceShareMessage(
              res.title,
              res.url,
              res.description?.trim() || null,
            ),
          })
        }
      }
    }
  }

  return { checkInSends, resourceSends }
}
