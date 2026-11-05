import { supabase } from '@/lib/supabase'
import { supabasePublic } from '@/lib/supabasePublic'
import type { WeeklyPlanGridJson } from '@/lib/nutrition/weeklyPlanGrid'

/** Lo que devuelve `get_shared_nutrition_plan`: sólo lo que ve el paciente (sin datos clínicos). */
export interface SharedMealPlan {
  patient_first_name: string
  professional_name: string | null
  professional_phone: string | null
  plan: {
    title: string | null
    objective: string | null
    merge_weekends: boolean
    grid: WeeklyPlanGridJson | unknown
    total_kcal: number | null
    next_consultation_date: string | null
    notes: string | null
    updated_at: string
  } | null
}

export function sharedMealPlanUrl(token: string): string {
  return `${window.location.origin}/plan/${token}`
}

/** El paciente abre el link sin sesión: va por el cliente anónimo. */
export async function fetchSharedMealPlan(token: string): Promise<SharedMealPlan | null> {
  const { data, error } = await supabasePublic.rpc('get_shared_nutrition_plan', { p_token: token })
  if (error) throw new Error(error.message)
  return (data as SharedMealPlan | null) ?? null
}

/** Token del link del paciente; lo crea la primera vez. */
export async function ensureMealPlanShareToken(ownerId: string, studentId: string): Promise<string> {
  const { data: found, error: readErr } = await supabase
    .from('nutrition_plan_shares')
    .select('token')
    .eq('owner_id', ownerId)
    .eq('student_id', studentId)
    .maybeSingle()
  if (readErr) throw new Error(readErr.message)
  if (found?.token) return found.token as string
  const { data, error } = await supabase
    .from('nutrition_plan_shares')
    .insert({ owner_id: ownerId, student_id: studentId })
    .select('token')
    .single()
  if (error) throw new Error(error.message)
  return data.token as string
}

/** Link nuevo: el anterior deja de funcionar. */
export async function regenerateMealPlanShareToken(ownerId: string, studentId: string): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, '')
  const { data, error } = await supabase
    .from('nutrition_plan_shares')
    .upsert(
      { owner_id: ownerId, student_id: studentId, token, updated_at: new Date().toISOString() },
      { onConflict: 'owner_id,student_id' },
    )
    .select('token')
    .single()
  if (error) throw new Error(error.message)
  return data.token as string
}

export function sharedMealPlanMessage(firstName: string, url: string): string {
  const hi = firstName.trim() ? `Hola ${firstName.trim()}!` : 'Hola!'
  return `${hi} Te paso tu plan alimentario. Lo podés abrir desde el celu cuando quieras y siempre va a estar actualizado:\n\n${url}`
}
