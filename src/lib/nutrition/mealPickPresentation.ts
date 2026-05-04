import type { MealPreparationChoice } from '@/lib/nutrition/planningWorkbookTypes'
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

/** Una línea compacta para PDF o pantalla: gramos + cdas + preparación. */
export function buildStudentQuantitySummaryLines(opts: {
  gramsStr: string
  nameSnapshot: string
  hint?: string
  preparation?: MealPreparationChoice
  /** PDF compacto: menos texto en la línea de gramos (sigue mostrando cdas. orientativas). */
  compact?: boolean
}): { gramsLine: string; prepLine: string | null } {
  const g = parseLocaleNumberOrZero(opts.gramsStr)
  const withSpoons = shouldAppendCucharadasEquivalence(opts.nameSnapshot, opts.hint)
  const cdas = approxCucharadasSoperasLabel(g)
  const gramsPart =
    g > 0
      ? withSpoons
        ? opts.compact
          ? `${fmtGramOrDash(g)} g · ~${cdas} (~${GRAMOS_POR_CUCHARADA_SOPERA} g/cda.)`
          : `${fmtGramOrDash(g)} g · ~${cdas} cdas. sopera (≈${GRAMOS_POR_CUCHARADA_SOPERA} g/cda., orientativo)`
        : opts.compact
          ? `${fmtGramOrDash(g)} g`
          : `${fmtGramOrDash(g)} g · en plato`
      : 'Cantidad: indicá gramos en el plan con tu entrenador.'
  const prepLine = preparacionElegidaLine(opts.preparation, opts.nameSnapshot, opts.hint)
  return { gramsLine: gramsPart, prepLine }
}
