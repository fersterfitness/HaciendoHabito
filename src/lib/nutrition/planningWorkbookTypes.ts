import type { Json } from '@/types/database'

/** Estado serializado en nutrition_planning_workbooks.data */

export interface PlanningFoodRowState {
  id: string
  name: string
  /** Sugerencia (ej. unidad → gramos orientativos) */
  hint?: string
  /** Cantidad en gramos para el cómputo */
  qtyG: string
  /** Referencia manual por 100 g (usuario/plantilla) */
  refCarbs: string
  refProt: string
  refFat: string
  refKcal: string
}

export interface PlanningSectionState {
  key: string
  title: string
  quantityColumnHint: string
  rows: PlanningFoodRowState[]
}

export interface PlanningWorkbookStateV1 {
  version: 1
  macroGuide: {
    proteinPerKgHint: string
    carbPerKgHint: string
    fatPerKgHint: string
    contextNote: string
  }
  /** Texto fijo de la plantilla (guía por objetivo) */
  objectivesGuide: {
    superavitCal: string
    deficitCal: string
    recomposicion: string
    longevidad: string
    proteinasPorObjetivo: string
    grasasPorObjetivo: string
    carbosPorObjetivo: string
    pctDistribicion: string
  }
  person: {
    tdeeMale: string
    tdeeFemale: string
    sex: '' | 'M' | 'F'
    weightKg: string
  }
  /** Alumno/paciente usado solo para rellenar referencia (peso, sexo, etc.). null = plantilla genérica. */
  personReferenceStudentId?: string | null
  objectives: string
  proposedKcal: string
  macroInputs: {
    proteinGPerKg: string
    carbGPerKg: string
    fatGPerKg: string
  }
  sections: PlanningSectionState[]
}

export function isPlanningWorkbookData(x: unknown): x is PlanningWorkbookStateV1 {
  return (
    !!x &&
    typeof x === 'object' &&
    (x as PlanningWorkbookStateV1).version === 1 &&
    Array.isArray((x as PlanningWorkbookStateV1).sections)
  )
}

export function planningDataToJson(d: PlanningWorkbookStateV1): Json {
  return d as unknown as Json
}

export function parsePlanningData(raw: Json | undefined): PlanningWorkbookStateV1 | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.version !== 1 || !Array.isArray(o.sections)) return null
  return o as unknown as PlanningWorkbookStateV1
}
