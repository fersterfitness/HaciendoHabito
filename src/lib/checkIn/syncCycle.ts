import { supabase } from '@/lib/supabase'
import { menstrualDateFromAnswers, type CheckInQuestion } from '@/lib/checkIn/questions'

/** Fallback si el trigger de check-in aún no está aplicado: registra la fecha en seguimiento de ciclo. */
export async function syncMenstrualCycleFromCheckIn(params: {
  ownerId: string
  studentId: string
  questions: CheckInQuestion[]
  responses: Record<string, unknown>
}): Promise<void> {
  const date = menstrualDateFromAnswers(params.questions, params.responses)
  if (!date) return
  const { data: existing } = await supabase
    .from('menstrual_cycles')
    .select('id')
    .eq('student_id', params.studentId)
    .eq('cycle_start_date', date)
    .maybeSingle()
  if (existing) return
  await supabase.from('menstrual_cycles').insert({
    owner_id: params.ownerId,
    student_id: params.studentId,
    cycle_start_date: date,
    cycle_length: 28,
    notes: 'Desde check-in semanal',
  })
}
