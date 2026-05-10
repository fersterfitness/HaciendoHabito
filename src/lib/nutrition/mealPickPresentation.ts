import type {
  MealPreparationChoice,
  MealSlotPick,
  PlanningWorkbookStateV1,
  QtyPresentationMode,
} from '@/lib/nutrition/planningWorkbookTypes'
import type { NutritionFoodMacroQtyPresentation } from '@/types/database'
import { parseLocaleNumberOrZero } from '@/lib/nutrition/planningCalculations'

/** Orientativo HH: ~15 g por cucharada sopera (varía por alimento). */
export const GRAMOS_POR_CUCHARADA_SOPERA = 15

export function fmtGramOrDash(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}

/** Texto corto para equivalente en cucharadas soperas. */
export function approxCucharadasSoperasLabel(grams: number): string {
  if (!Number.isFinite(grams) || grams <= 0) return '—'
  const n = grams / GRAMOS_POR_CUCHARADA_SOPERA
  if (n < 0.35) return '< ½ cda.'
  if (n < 1) return '~1 cda.'
  const rounded = Math.round(n)
  return `~${rounded} cdas.`
}

/**
 * Cucharadas orientativas tienen sentido para untables, líquidos chicos, etc.
 * En carnes / pescado / huevo en porción resulta confuso; ahí solo gramos + tip de la fila.
 */
export function shouldAppendCucharadasEquivalence(name: string, hint?: string): boolean {
  const combined = `${name} ${hint ?? ''}`
  if (/cucharada|cuchara\s+(sopera|t[eé])|\bcdas?\b\.?\s*(sopera)?|\(cda|sopera\s*\)/i.test(combined)) {
    return true
  }
  if (/\(ml\)|\bml\s*%|\bml\)/i.test(name)) return false
  if (/\bwhey\b/i.test(name)) return false

  const t = name.toLowerCase()
  const meatFishPortion =
    /\b(suprema|pollo|lomo|bife|vaca|cerdo|vacuno|pescado|at[uú]n|salm[oó]n|merluza|filet|filete|cuadril|nalga|roast|bondiola|entrañ|entrana|jam[oó]n|picad[oa]|churrasco|milanesa|calamar|raba|huevos?\b|clara\b|yema\b|colita|morrillo|tapa\b|soja\s+textur)\b/i
  if (meatFishPortion.test(t)) return false

  return true
}

/** Texto amigable sobre referencia cruda/cocida a partir del nombre y la nota de plantilla. */
export function preparacionAlumnoLine(name: string, hint?: string): string | null {
  const t = `${name} ${hint ?? ''}`.toLowerCase()
  const hasCrudo = /\bcrudo\b/.test(t)
  const hasCocido = /\bcocido\b/.test(t)
  if (hasCrudo && hasCocido) return 'Referencia: podés usarlo crudo o cocido según cómo lo prepares.'
  if (hasCrudo) return 'Referencia: cantidad pensada en crudo (si cocinás, el peso puede variar).'
  if (hasCocido) return 'Referencia: cantidad pensada cocida.'
  return null
}

export function preparacionElegidaLine(
  choice: MealPreparationChoice | undefined,
  name: string,
  hint?: string,
): string | null {
  const c = choice ?? 'infer'
  if (c === 'crudo') return 'Referencia: cantidad en crudo.'
  if (c === 'cocido') return 'Referencia: cantidad cocida.'
  return preparacionAlumnoLine(name, hint)
}

/** Unifica lectura por gramos / unidades / ml en picks (fila activa del plan si aplica). */
export function resolveMealPickQtyPresentation(
  p: MealSlotPick,
  wb: PlanningWorkbookStateV1,
  libraryFoods?: readonly { id: string; macro_qty_presentation?: NutritionFoodMacroQtyPresentation | null }[],
): { qtyPresentation?: QtyPresentationMode; unitsLabel?: string } {
  const ulSnap = p.unitsLabel?.trim()
  if (p.kind === 'library') {
    if (p.qtyPresentation === 'volume') return { qtyPresentation: 'volume', unitsLabel: ulSnap || undefined }
    if (p.qtyPresentation === 'units') return { qtyPresentation: 'units', unitsLabel: ulSnap || undefined }
    if (p.qtyPresentation === 'grams') return { qtyPresentation: 'grams' }
    const lib = libraryFoods?.find((f) => f.id === p.libraryFoodId)
    const fb = lib?.macro_qty_presentation
    if (fb === 'volume') return { qtyPresentation: 'volume', unitsLabel: ulSnap || undefined }
    if (fb === 'units') return { qtyPresentation: 'units', unitsLabel: ulSnap || undefined }
    if (fb === 'grams') return { qtyPresentation: 'grams' }
    return {}
  }
  const sec = wb.sections.find((s) => s.key === p.secKey)
  const row = sec?.rows.find((r) => r.id === p.rowId)
  const ulRow = row?.unitsLabel?.trim()
  const rpm = row?.qtyPresentation
  if (rpm === 'grams') return { qtyPresentation: 'grams' }
  if (rpm === 'volume' || p.qtyPresentation === 'volume') {
    return { qtyPresentation: 'volume', unitsLabel: ulSnap || ulRow || undefined }
  }
  if (rpm === 'units' || p.qtyPresentation === 'units') {
    return { qtyPresentation: 'units', unitsLabel: ulSnap || ulRow || undefined }
  }
  if (p.qtyPresentation === 'grams') return { qtyPresentation: 'grams' }
  return {}
}

/** Una línea compacta para PDF o pantalla: gramos + cdas + preparación. */
export function buildStudentQuantitySummaryLines(opts: {
  gramsStr: string
  nameSnapshot: string
  hint?: string
  preparation?: MealPreparationChoice
  qtyPresentation?: QtyPresentationMode
  unitsLabel?: string
  /** PDF compacto: menos texto en la línea de gramos (sigue mostrando cdas. orientativas). */
  compact?: boolean
}): { gramsLine: string; prepLine: string | null } {
  const g = parseLocaleNumberOrZero(opts.gramsStr)
  const withSpoons = shouldAppendCucharadasEquivalence(opts.nameSnapshot, opts.hint)
  const cdas = approxCucharadasSoperasLabel(g)
  const units = opts.unitsLabel?.trim()

  let gramsPart: string
  if (opts.qtyPresentation === 'volume') {
    if (units) {
      gramsPart =
        g > 0
          ? opts.compact
            ? `${units} ml (~${fmtGramOrDash(g)} g)`
            : `${units} ml · equivalente en gramos para el plan ~${fmtGramOrDash(g)} g (bebidas: ~1 ml ≈ 1 g si no indica otra cosa).`
          : `${units} ml · cargá también gramos equivalentes para el cómputo.`
    } else {
      gramsPart =
        g > 0
          ? opts.compact
            ? `${fmtGramOrDash(g)} g — cargá ml en «Mililitros»`
            : `Modo mililitros: cargá los ml en el plan · masa orientativa ~${fmtGramOrDash(g)} g.`
          : 'Mililitros: indicá ml y gramos equivalentes en el plan (para bebidas suele ser similar).'
    }
  } else if (opts.qtyPresentation === 'units') {
    if (units) {
      gramsPart =
        g > 0
          ? opts.compact
            ? `${units} u. (~${fmtGramOrDash(g)} g)`
            : `${units} unidad(es) · equivalente orientativo ~${fmtGramOrDash(g)} g`
          : `${units} u. · cargá también gramos equiv. para el cómputo energético.`
    } else {
      gramsPart =
        g > 0
          ? opts.compact
            ? `Por unidades — cargá cant. en «Uds.» (${fmtGramOrDash(g)} g equiv. en tabla)`
            : `Este ítem se registra por unidades: cargá cantidad en «Uds.» del plan · masa equiv. orientativa ~${fmtGramOrDash(g)} g`
          : 'Por unidades: cargá cantidad en «Uds.» del plan y gramos equivalentes.'
    }
  } else {
    gramsPart =
      g > 0
        ? withSpoons
          ? opts.compact
            ? `${fmtGramOrDash(g)} g · ~${cdas} (~${GRAMOS_POR_CUCHARADA_SOPERA} g/cda.)`
            : `${fmtGramOrDash(g)} g · ~${cdas} cdas. sopera (≈${GRAMOS_POR_CUCHARADA_SOPERA} g/cda., orientativo)`
          : opts.compact
            ? `${fmtGramOrDash(g)} g`
            : `${fmtGramOrDash(g)} g · en plato`
        : 'Cantidad: indicá gramos en el plan con tu entrenador.'
  }
  const prepLine = preparacionElegidaLine(opts.preparation, opts.nameSnapshot, opts.hint)
  return { gramsLine: gramsPart, prepLine }
}
