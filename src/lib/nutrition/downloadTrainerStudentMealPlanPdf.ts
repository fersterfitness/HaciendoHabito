import type { Json, TrainerStudentMealPlan } from '@/types/database'
import { downloadPlanningWorkbookPdf } from '@/lib/nutrition/downloadPlanningWorkbookPdf'
import { createInitialPlanningWorkbook } from '@/lib/nutrition/planningWorkbookFactory'
import { parsePlanningData } from '@/lib/nutrition/planningWorkbookTypes'

/** Descarga el PDF del plan asignado (datos JSON del alumno). */
export async function downloadTrainerStudentMealPlanPdf(
  plan: Pick<TrainerStudentMealPlan, 'data' | 'title' | 'id'>,
  options?: { professionalName?: string | null },
): Promise<void> {
  const wb = parsePlanningData(plan.data as Json) ?? createInitialPlanningWorkbook()
  const safe = plan.title.replace(/\s+/g, '-').replace(/[^\w\s\-_.áéíóúÁÉÍÓÚñÑ]/g, '').trim().slice(0, 60)
  await downloadPlanningWorkbookPdf(wb, {
    professionalName: options?.professionalName,
    fileBaseName: safe || `plan-${plan.id.slice(0, 8)}`,
  })
}
