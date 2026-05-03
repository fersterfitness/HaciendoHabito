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

export type MealSlotKey =
  | 'desayuno'
  | 'mediaManana'
  | 'almuerzo'
  | 'mediaTarde'
  | 'merienda'
  | 'cena'

export const MEAL_SLOT_KEYS: MealSlotKey[] = [
  'desayuno',
  'mediaManana',
  'almuerzo',
  'mediaTarde',
  'merienda',
  'cena',
]

export const MEAL_SLOT_LABELS: Record<MealSlotKey, string> = {
  desayuno: 'Desayuno',
  mediaManana: 'Media mañana',
  almuerzo: 'Almuerzo',
  mediaTarde: 'Media tarde',
  merienda: 'Merienda',
  cena: 'Cena',
}

/** Cómo mostrar la referencia cruda/cocida en PDF y vista alumno. */
export type MealPreparationChoice = 'infer' | 'crudo' | 'cocido'

/** Ítem agregado a un momento del día desde las tablas del plan o desde Mi lista. */
export type MealSlotPick =
  | {
      id: string
      kind: 'plan_row'
      secKey: string
      rowId: string
      qtyG: string
      nameSnapshot: string
      /** Copia de la sugerencia de la fila al agregar (unidades, crudo/cocido en texto). */
      hintSnapshot?: string
      /** infer = deducir desde nombre/hint; crudo/cocido = forzar leyenda. */
      preparation?: MealPreparationChoice
    }
  | {
      id: string
      kind: 'library'
      libraryFoodId: string
      qtyG: string
      nameSnapshot: string
      hintSnapshot?: string
      preparation?: MealPreparationChoice
    }

export function newMealPickId(): string {
  return `mp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`
}

/** Qué alimentos incluir en cada momento del día (texto libre + selección desde tablas; visible en PDF / alumno). */
export interface MealDistributionState {
  includeMidMorning: boolean
  includeMidAfternoon: boolean
  desayuno: string
  mediaManana: string
  almuerzo: string
  mediaTarde: string
  merienda: string
  cena: string
  /** Alimentos elegidos por momento (referencia a fila del plan o a Mi lista). */
  picksByMeal?: Partial<Record<MealSlotKey, MealSlotPick[]>>
}

export const DEFAULT_MEAL_DISTRIBUTION: MealDistributionState = {
  includeMidMorning: false,
  includeMidAfternoon: false,
  desayuno: '',
  mediaManana: '',
  almuerzo: '',
  mediaTarde: '',
  merienda: '',
  cena: '',
  picksByMeal: {},
}

export function normalizePicksByMeal(raw: unknown): MealDistributionState['picksByMeal'] {
  if (!raw || typeof raw !== 'object') return {}
  const src = raw as Record<string, unknown>
  const out: NonNullable<MealDistributionState['picksByMeal']> = {}
  for (const key of MEAL_SLOT_KEYS) {
    const arr = src[key]
    if (!Array.isArray(arr)) continue
    const picks: MealSlotPick[] = []
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      const id = typeof o.id === 'string' && o.id ? o.id : newMealPickId()
      const qtyG = typeof o.qtyG === 'string' ? o.qtyG : ''
      const nameSnapshot = typeof o.nameSnapshot === 'string' ? o.nameSnapshot : ''
      const kind = o.kind === 'library' ? 'library' : 'plan_row'
      const hintSnapshot = typeof o.hintSnapshot === 'string' ? o.hintSnapshot : undefined
      const prepRaw = o.preparation
      const preparation: MealPreparationChoice | undefined =
        prepRaw === 'crudo' || prepRaw === 'cocido' || prepRaw === 'infer' ? prepRaw : undefined
      if (kind === 'library') {
        const libraryFoodId = typeof o.libraryFoodId === 'string' ? o.libraryFoodId : ''
        if (!libraryFoodId || !nameSnapshot) continue
        picks.push({
          id,
          kind: 'library',
          libraryFoodId,
          qtyG,
          nameSnapshot,
          ...(hintSnapshot !== undefined ? { hintSnapshot } : {}),
          ...(preparation ? { preparation } : {}),
        })
      } else {
        const secKey = typeof o.secKey === 'string' ? o.secKey : ''
        const rowId = typeof o.rowId === 'string' ? o.rowId : ''
        if (!secKey || !rowId || !nameSnapshot) continue
        picks.push({
          id,
          kind: 'plan_row',
          secKey,
          rowId,
          qtyG,
          nameSnapshot,
          ...(hintSnapshot !== undefined ? { hintSnapshot } : {}),
          ...(preparation ? { preparation } : {}),
        })
      }
    }
    if (picks.length) out[key] = picks
  }
  return Object.keys(out).length ? out : {}
}

export function normalizeMealDistribution(x: Partial<MealDistributionState> | undefined): MealDistributionState {
  if (!x || typeof x !== 'object') return { ...DEFAULT_MEAL_DISTRIBUTION }
  return {
    ...DEFAULT_MEAL_DISTRIBUTION,
    ...x,
    includeMidMorning: Boolean(x.includeMidMorning),
    includeMidAfternoon: Boolean(x.includeMidAfternoon),
    desayuno: typeof x.desayuno === 'string' ? x.desayuno : '',
    mediaManana: typeof x.mediaManana === 'string' ? x.mediaManana : '',
    almuerzo: typeof x.almuerzo === 'string' ? x.almuerzo : '',
    mediaTarde: typeof x.mediaTarde === 'string' ? x.mediaTarde : '',
    merienda: typeof x.merienda === 'string' ? x.merienda : '',
    cena: typeof x.cena === 'string' ? x.cena : '',
    picksByMeal: normalizePicksByMeal(x.picksByMeal),
  }
}

/** Hay ítems seleccionados desde tablas / Mi lista en algún momento del día. */
export function mealDistributionHasMealPicks(md: MealDistributionState): boolean {
  const p = md.picksByMeal
  if (!p) return false
  return MEAL_SLOT_KEYS.some((k) => (p[k]?.length ?? 0) > 0)
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
  /** Gramos por ítem de Mi lista en la tabla «Alimentos personalizados» (id biblioteca → texto cantidad). */
  libraryQtyDraft?: Record<string, string>
  /** Macros por 100 g guardados por id de biblioteca (para totales/PDF sin volver a cargar la Guía). */
  libraryFoodRefsById?: Record<string, { c: number; p: number; f: number; k: number }>
  /** Momentos del día y sugerencias de alimentos (visible en PDF / alumno). */
  mealDistribution?: MealDistributionState
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
  const wb = o as unknown as PlanningWorkbookStateV1

  /** jsonb a veces devuelve números u omite tipos; normalizamos para que los gramos persistan al cargar. */
  const qtyRaw = o.libraryQtyDraft
  let libraryQtyDraft: Record<string, string> = {}
  if (qtyRaw && typeof qtyRaw === 'object' && !Array.isArray(qtyRaw)) {
    for (const [k, v] of Object.entries(qtyRaw)) {
      if (typeof v === 'string') libraryQtyDraft[k] = v
      else if (typeof v === 'number' && Number.isFinite(v)) libraryQtyDraft[k] = String(v)
    }
  }

  const refsRaw = o.libraryFoodRefsById
  let libraryFoodRefsById = wb.libraryFoodRefsById ?? {}
  if (refsRaw && typeof refsRaw === 'object' && !Array.isArray(refsRaw)) {
    libraryFoodRefsById = refsRaw as PlanningWorkbookStateV1['libraryFoodRefsById']
  }

  const mealDistribution = normalizeMealDistribution(
    o.mealDistribution as Partial<MealDistributionState> | undefined,
  )

  return {
    ...wb,
    libraryQtyDraft,
    libraryFoodRefsById,
    mealDistribution,
  }
}
