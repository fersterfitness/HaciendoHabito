import { supabase } from '@/lib/supabase'
import { parsePlanningData, planningDataToJson } from '@/lib/nutrition/planningWorkbookTypes'
import type { Json, NutritionPlanningWorkbookTemplate } from '@/types/database'

export async function fetchPlanningWorkbookTemplates(): Promise<NutritionPlanningWorkbookTemplate[]> {
  const { data, error } = await supabase
    .from('nutrition_planning_workbook_templates')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as NutritionPlanningWorkbookTemplate[]
}

export async function insertPlanningWorkbookTemplate(
  name: string,
  description: string | null,
  data: ReturnType<typeof planningDataToJson>,
): Promise<NutritionPlanningWorkbookTemplate> {
  const { data: userRes } = await supabase.auth.getUser()
  const uid = userRes.user?.id
  if (!uid) throw new Error('No hay sesión')

  const trimmed = name.trim()
  if (!trimmed) throw new Error('Elegí un nombre para la plantilla')

  const { data: row, error } = await supabase
    .from('nutrition_planning_workbook_templates')
    .insert({
      owner_id: uid,
      name: trimmed.slice(0, 200),
      description: description?.trim() ? description.trim().slice(0, 500) : null,
      data,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return row as NutritionPlanningWorkbookTemplate
}

export async function deletePlanningWorkbookTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('nutrition_planning_workbook_templates').delete().eq('id', id)

  if (error) throw new Error(error.message)
}

/** Interpreta JSON guardado como workbook; lanza si no reconoce el formato. */
export function workbookFromTemplateData(raw: Json) {
  const wb = parsePlanningData(raw)
  if (!wb) throw new Error('Plantilla con formato inválido')
  return wb
}
