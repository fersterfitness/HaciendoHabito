import type { Json, TrainerStudentMealPlan } from '@/types/database'
import { createInitialPlanningWorkbook } from '@/lib/nutrition/planningWorkbookFactory'
import { parsePlanningData } from '@/lib/nutrition/planningWorkbookTypes'

/** Descarga el PDF del plan asignado (datos JSON del alumno). */
export async function downloadTrainerStudentMealPlanPdf(
  plan: Pick<TrainerStudentMealPlan, 'data' | 'title' | 'id'>,
  options?: { professionalName?: string | null; studentName?: string | null },
): Promise<void> {
  const wb = parsePlanningData(plan.data as Json) ?? createInitialPlanningWorkbook()
  // El generador de PDF (@react-pdf, ~1,4 MB) se carga recién al descargar.
  const { downloadPlanningWorkbookPdf } = await import('@/lib/nutrition/downloadPlanningWorkbookPdf')
  const safe = plan.title.replace(/\s+/g, '-').replace(/[^\w\s\-_.áéíóúÁÉÍÓÚñÑ]/g, '').trim().slice(0, 60)
  await downloadPlanningWorkbookPdf(wb, {
    professionalName: options?.professionalName,
    studentName: options?.studentName,
    fileBaseName: safe || `plan-${plan.id.slice(0, 8)}`,
  })
}
