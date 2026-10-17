import { supabase } from '@/lib/supabase'

/** Sin control antropométrico hace más de esto → «control atrasado». */
export const NUTRITION_CONTROL_OVERDUE_DAYS = 42

export type NutritionOpsPatient = { id: string; full_name: string; detail: string }

export type NutritionistOps = {
  upcoming: { id: string; student_id: string; full_name: string; starts_at: string }[]
  overdueControls: NutritionOpsPatient[]
  withoutPlan: NutritionOpsPatient[]
  pendingAnamnesis: NutritionOpsPatient[]
}

const DAY = 86_400_000

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY)
}

/**
 * Pendientes del día a día del nutricionista: consultas de la semana, controles atrasados,
 * pacientes sin plan y anamnesis enviadas sin completar. Solo pacientes activos propios.
 */
export async function loadNutritionistOps(ownerId: string): Promise<NutritionistOps> {
  const now = new Date()
  const inAWeek = new Date(now.getTime() + 7 * DAY)

  const [stuRes, apptRes, measRes, planRes, mealRes, anamRes] = await Promise.all([
    supabase.from('students').select('id, full_name').eq('owner_id', ownerId).eq('status', 'activo').order('full_name'),
    supabase
      .from('appointments')
      .select('id, student_id, starts_at, student:students(full_name)')
      .eq('owner_id', ownerId)
      .in('status', ['scheduled', 'confirmed'])
      .gte('starts_at', now.toISOString())
      .lte('starts_at', inAWeek.toISOString())
      .order('starts_at', { ascending: true })
      .limit(8),
    supabase.from('nutrition_measurements').select('student_id, measured_at').eq('owner_id', ownerId),
    supabase.from('nutrition_patient_plan_versions').select('student_id').eq('owner_id', ownerId).eq('is_active', true),
    supabase.from('trainer_student_meal_plans').select('student_id').eq('owner_id', ownerId).is('completed_at', null),
    supabase
      .from('nutrition_anamnesis')
      .select('student_id, public_link_issued_at, public_submitted_at')
      .eq('owner_id', ownerId)
      .not('public_link_issued_at', 'is', null)
      .is('public_submitted_at', null),
  ])

  const students = (stuRes.data ?? []) as { id: string; full_name: string }[]
  const nameById = new Map(students.map((s) => [s.id, s.full_name]))

  const lastMeasure = new Map<string, string>()
  for (const m of (measRes.data ?? []) as { student_id: string; measured_at: string }[]) {
    const prev = lastMeasure.get(m.student_id)
    if (!prev || m.measured_at > prev) lastMeasure.set(m.student_id, m.measured_at)
  }

  const withPlan = new Set<string>([
    ...((planRes.data ?? []) as { student_id: string }[]).map((r) => r.student_id),
    ...((mealRes.data ?? []) as { student_id: string }[]).map((r) => r.student_id),
  ])

  const overdueControls: NutritionOpsPatient[] = []
  for (const s of students) {
    const last = lastMeasure.get(s.id)
    if (!last) overdueControls.push({ id: s.id, full_name: s.full_name, detail: 'Sin controles cargados' })
    else if (daysAgo(last) > NUTRITION_CONTROL_OVERDUE_DAYS) {
      overdueControls.push({ id: s.id, full_name: s.full_name, detail: `Último control hace ${Math.round(daysAgo(last) / 7)} sem.` })
    }
  }

  type ApptRow = { id: string; student_id: string; starts_at: string; student?: { full_name?: string } | { full_name?: string }[] | null }
  const upcoming = ((apptRes.data ?? []) as ApptRow[]).map((a) => {
    const st = Array.isArray(a.student) ? a.student[0] : a.student
    return { id: a.id, student_id: a.student_id, starts_at: a.starts_at, full_name: st?.full_name ?? nameById.get(a.student_id) ?? 'Paciente' }
  })

  const pendingAnamnesis = ((anamRes.data ?? []) as { student_id: string; public_link_issued_at: string }[])
    .filter((r) => nameById.has(r.student_id))
    .map((r) => ({
      id: r.student_id,
      full_name: nameById.get(r.student_id)!,
      detail: `Link enviado hace ${daysAgo(r.public_link_issued_at)} días`,
    }))

  return {
    upcoming,
    overdueControls,
    withoutPlan: students.filter((s) => !withPlan.has(s.id)).map((s) => ({ id: s.id, full_name: s.full_name, detail: 'Sin plan activo' })),
    pendingAnamnesis,
  }
}
