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
  const cdas = approxCucharadasSoperasLabel(g)
  const gramsPart =
    g > 0
      ? opts.compact
        ? `${fmtGramOrDash(g)} g · ~${cdas} (~${GRAMOS_POR_CUCHARADA_SOPERA} g/cda.)`
        : `${fmtGramOrDash(g)} g · ~${cdas} cdas. sopera (≈${GRAMOS_POR_CUCHARADA_SOPERA} g/cda., orientativo)`
      : 'Cantidad: indicá gramos en el plan con tu entrenador.'
  const prepLine = preparacionElegidaLine(opts.preparation, opts.nameSnapshot, opts.hint)
  return { gramsLine: gramsPart, prepLine }
}
