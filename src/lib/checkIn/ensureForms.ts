import { supabase } from '@/lib/supabase'
import {
  isMonthlyTemplate,
  isWeeklyTemplate,
  monthlyFormDefaults,
  parseQuestions,
  weekStatusFromAnswers,
  weeklyFormDefaults,
  type CheckInQuestion,
} from '@/lib/checkIn/questions'
import { syncMenstrualCycleFromCheckIn } from '@/lib/checkIn/syncCycle'
import type { CheckInForm, Json } from '@/types/database'

export async function syncCheckInSideEffects(params: {
  ownerId: string
  studentId: string
  questions: CheckInQuestion[]
  responses: Record<string, unknown>
}): Promise<void> {
  await syncMenstrualCycleFromCheckIn(params)
  const st = weekStatusFromAnswers(params.questions, params.responses)
  if (!st.finished) return
  const { data } = await supabase
    .from('routines')
    .select('id, status')
    .eq('student_id', params.studentId)
    .eq('owner_id', params.ownerId)
    .in('status', ['activa', 'por_vencer'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data?.id) return
  await supabase.from('routines').update({ status: 'completada' }).eq('id', data.id)
}

export async function ensureDefaultCheckInForms(
  ownerId: string,
  forms: CheckInForm[],
): Promise<{ forms: CheckInForm[]; didChange: boolean; message?: string }> {
  let next = [...forms]
  let didChange = false
  let message: string | undefined

  const weekly = next.find((f) => isWeeklyTemplate(parseQuestions(f.questions)))
  const monthly = next.find((f) => isMonthlyTemplate(parseQuestions(f.questions)))

  if (!weekly) {
    const tpl = weeklyFormDefaults()
    const candidate = next
      .filter((f) => f.is_active && !isMonthlyTemplate(parseQuestions(f.questions)))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
    if (candidate) {
      const { data, error } = await supabase
        .from('check_in_forms')
        .update({
          title: candidate.title.trim() || tpl.title,
          intro: tpl.intro,
          questions: tpl.questions as unknown as Json,
        })
        .eq('id', candidate.id)
        .eq('owner_id', ownerId)
        .select('*')
        .single()
      if (!error && data) {
        next = next.map((f) => (f.id === candidate.id ? (data as CheckInForm) : f))
        didChange = true
        message = 'Actualizamos el formulario semanal a la plantilla nueva.'
      }
    } else {
      const { data, error } = await supabase
        .from('check_in_forms')
        .insert({
          owner_id: ownerId,
          title: tpl.title,
          intro: tpl.intro,
          questions: tpl.questions as unknown as Json,
          is_active: true,
        })
        .select('*')
        .single()
      if (!error && data) {
        next = [data as CheckInForm, ...next]
        didChange = true
        message = 'Creamos el check-in semanal con la plantilla pedida.'
      }
    }
  }

  if (!monthly) {
    const tpl = monthlyFormDefaults()
    const { data, error } = await supabase
      .from('check_in_forms')
      .insert({
        owner_id: ownerId,
        title: tpl.title,
        intro: tpl.intro,
        questions: tpl.questions as unknown as Json,
        is_active: true,
      })
      .select('*')
      .single()
    if (!error && data) {
      next = [data as CheckInForm, ...next]
      didChange = true
      message = message
        ? `${message} También el de feedback mensual.`
        : 'Creamos el formulario de feedback mensual.'
    }
  }

  return { forms: next, didChange, message }
}
