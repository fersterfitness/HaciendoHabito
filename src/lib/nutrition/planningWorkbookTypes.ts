import type { Json } from '@/types/database'

/** Estado serializado en nutrition_planning_workbooks.data */

/** Cómo mostrar la cantidad al alumno/PDF. `grams` = solo g; `units` = porciones (uds.); `volume` = bebidas (ml). Siempre hace falta `qtyG` para el cómputo. */
export type QtyPresentationMode = 'grams' | 'units' | 'volume'

export interface PlanningFoodRowState {
  id: string
  name: string
  /** Sugerencia (ej. unidad → gramos orientativos) */
  hint?: string
  /** Cómo leer «Cantidad» para el texto al alumno/PDF. Siempre cargá gramos (`qtyG`) para totales. */
  qtyPresentation?: QtyPresentationMode
  /** Unidades (ej. «2») si `units`; mililitros (ej. «200») si `volume`. */
  unitsLabel?: string
  /** Cantidad en gramos para el cómputo */
  qtyG: string
  /** Gramos de la porción de referencia de HC/P/G/kcal (por defecto 100). */
  refBasisG?: string
  /** Referencia nutricional (P/G/HC/kcal) según `refBasisG` gramos; por defecto 100 g. */
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
      /** Copiado al agregar desde la fila; si no, se usa la fila viva. */
      qtyPresentation?: QtyPresentationMode
      unitsLabel?: string
    }
  | {
      id: string
      kind: 'library'
      libraryFoodId: string
      qtyG: string
      nameSnapshot: string
      hintSnapshot?: string
      preparation?: MealPreparationChoice
      qtyPresentation?: QtyPresentationMode
      unitsLabel?: string
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
      const qtyPresentationRaw = o.qtyPresentation
      const qtyPresentation: QtyPresentationMode | undefined =
        qtyPresentationRaw === 'units' || qtyPresentationRaw === 'grams' || qtyPresentationRaw === 'volume'
          ? qtyPresentationRaw
          : undefined
      const unitsLabel = typeof o.unitsLabel === 'string' ? o.unitsLabel : undefined
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
          ...(qtyPresentation ? { qtyPresentation } : {}),
          ...(unitsLabel !== undefined ? { unitsLabel } : {}),
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
          ...(qtyPresentation ? { qtyPresentation } : {}),
          ...(unitsLabel !== undefined ? { unitsLabel } : {}),
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
    /** cm — para Mifflin–St Jeor */
    heightCm: string
    /** años cumplidos */
    ageYears: string
    /** Multiplicador de actividad (ej. 1,5 — TDEE = TMB × factor) */
    activityFactor: string
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
  /** Macros guardados por id de biblioteca; `b` = gramos de referencia de esos valores (p. ej. 25). */
  libraryFoodRefsById?: Record<string, { c: number; p: number; f: number; k: number; b?: number }>
  /** Momentos del día y sugerencias de alimentos (visible en PDF / alumno). */
  mealDistribution?: MealDistributionState
  /**
   * Guía orientativa editable: grupos de hortalizas A/B, equivalencias visuales, alternativas de proteína,
   * marcas de ejemplo — no sustituye indicación profesional individual.
   */
  studentOrientativeGuide?: string
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

/** Texto inicial de la guía orientativa para el PDF (HORT A/B por ítem, equivalencias carnes/pescados, texto tipo guía 10). */
export const DEFAULT_STUDENT_ORIENTATIVE_GUIDE = [
  'HORTALIZAS A (bajo aporte energético · referencia por ítems)',
  '• Acelga · achicoria · apio · berenjena · berro · brócoli · coliflor · escarola · espárragos · espinaca · hinojo · hongos/champiñones · lechuga · pepino · pimiento · puerro · rabanito · rábano · radicheta · rúcula · repollo · repollitos de Bruselas · tomate · zapallito · alcachofa',
  '',
  'HORTALIZAS B (mayor aporte de carbohidratos · referencia por ítems)',
  '• Alcaucil/alcachofa · arvejas/guisantes frescas · brotes de soja · calabaza/zapallo · cebolla · cebolla de verdeo · chauchas (ejote/judía verde) frescas · nabo · palmitos · remolacha · zanahoria',
  '',
  'PROTEÍNAS · equivalencias sólo guía (porciones pensadas cocidas)',
  '• Vacuna/pechuga/suprema ~120–200 g típ.; nalga/cuadril/lomo bifes ~120–220 g; churrasco ancho puede ir ~180–280 g.',
  '• Cerdo magro (solomillo) ~130–200 g cocido.',
  '• Pescado filete/lomo ~120–200 g cocido.',
  '• Huevo: contalo por unidad; los gramos en tabla son sólo equivalente (~48–56 g/huevo mediano sin cáscara).',
  '',
  'Las marcas citadas en tu plan son ejemplos; cualquier equivalente de calidad similar sirve si lo acordamos.',
  '',
  '—',
  'INSTRUCCIONES ESPECÍFICAS DE TU GUÍA (número según plan acordado)',
  '',
  'PESADO DE ALIMENTOS',
  '→ Todos los pesos (gramos) serán pesados en cocido.',
  '',
  'VEGETALES OBLIGATORIOS',
  '→ Incluí SIEMPRE vegetales en almuerzo y cena (30% del plato mínimo).',
  '',
  'HORTALIZAS A (ejemplos)',
  '→ Acelga, apio, berenjena, brócoli, coliflor, espinaca, lechuga, pepino, pimiento, rábano, rúcula, tomate, zapallito, champiñones, repollo, alcachofa.',
  '',
  'HORTALIZAS B (ejemplos)',
  '→ Alcachofa, arveja (guisante) fresca, cebolla, chaucha (ejote/judía verde) fresca, nabo, puerro, zanahoria, remolacha, zapallo (calabaza).',
  '',
  'CONDIMENTOS',
  '→ A gusto personal (en muchos casos: orégano, cúrcuma, pimienta).',
  '',
  'ALTERNATIVAS DE PROTEÍNAS',
  '→ Pescados: atún fresco, salmón, jurel, caballa (frescos o enlatados al natural).',
  '→ Carnes: suprema, solomillo, lomo de vaca, colita de cuadril, roast beef, paleta, etc.',
  '',
  'MÉTODOS DE COCCIÓN RECOMENDADOS',
  '→ Al horno, a la plancha, hervido, al vapor, salteado con poca grasa.',
  '',
  'HIDRATACIÓN Y BEBIDAS',
  'Recomendado',
  '→ Agua: mínimo 2–3 litros diarios · infusiones sin azúcar · bebidas zero ocasionalmente.',
  '',
  'EVITAR ESTAS ACTITUDES',
  '→ Castigarte por comidas libres un fin de semana; un día no define tu cuerpo.',
  '→ Dejar de disfrutar el proceso.',
].join('\n')

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
  const libraryQtyDraft: Record<string, string> = {}
  if (qtyRaw && typeof qtyRaw === 'object' && !Array.isArray(qtyRaw)) {
    for (const [k, v] of Object.entries(qtyRaw)) {
      if (typeof v === 'string') libraryQtyDraft[k] = v
      else if (typeof v === 'number' && Number.isFinite(v)) libraryQtyDraft[k] = String(v)
    }
  }

  const refsRaw = o.libraryFoodRefsById
  let libraryFoodRefsById = wb.libraryFoodRefsById ?? {}
  if (refsRaw && typeof refsRaw === 'object' && !Array.isArray(refsRaw)) {
    libraryFoodRefsById =
      refsRaw as NonNullable<PlanningWorkbookStateV1['libraryFoodRefsById']>
  }

  const mealDistribution = normalizeMealDistribution(
    o.mealDistribution as Partial<MealDistributionState> | undefined,
  )

  const basePerson = {
    tdeeMale: '',
    tdeeFemale: '',
    sex: '' as PlanningWorkbookStateV1['person']['sex'],
    weightKg: '',
    heightCm: '',
    ageYears: '',
    activityFactor: '',
  }
  const pr = wb.person && typeof wb.person === 'object' ? wb.person : {}
  const person: PlanningWorkbookStateV1['person'] = {
    ...basePerson,
    ...pr,
    tdeeMale: typeof (pr as { tdeeMale?: unknown }).tdeeMale === 'string' ? (pr as { tdeeMale: string }).tdeeMale : '',
    tdeeFemale:
      typeof (pr as { tdeeFemale?: unknown }).tdeeFemale === 'string' ? (pr as { tdeeFemale: string }).tdeeFemale : '',
    sex:
      (pr as { sex?: unknown }).sex === 'M' || (pr as { sex?: unknown }).sex === 'F'
        ? ((pr as { sex: 'M' | 'F' }).sex as 'M' | 'F')
        : '',
    weightKg:
      typeof (pr as { weightKg?: unknown }).weightKg === 'string' ? (pr as { weightKg: string }).weightKg : '',
    heightCm:
      typeof (pr as { heightCm?: unknown }).heightCm === 'string' ? (pr as { heightCm: string }).heightCm : '',
    ageYears:
      typeof (pr as { ageYears?: unknown }).ageYears === 'string' ? (pr as { ageYears: string }).ageYears : '',
    activityFactor:
      typeof (pr as { activityFactor?: unknown }).activityFactor === 'string'
        ? (pr as { activityFactor: string }).activityFactor
        : '',
  }

  const studentOrientativeGuide =
    typeof o.studentOrientativeGuide === 'string'
      ? o.studentOrientativeGuide
      : DEFAULT_STUDENT_ORIENTATIVE_GUIDE

  return {
    ...wb,
    person,
    libraryQtyDraft,
    libraryFoodRefsById,
    mealDistribution,
    studentOrientativeGuide,
  }
}
