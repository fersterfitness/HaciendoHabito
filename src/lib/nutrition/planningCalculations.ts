/** Número con coma o punto decimal */

import type { PlanningWorkbookStateV1 } from '@/lib/nutrition/planningWorkbookTypes'

export function parseLocaleNumber(raw: string): number {
  const t = raw.trim().replace(/\s+/g, '').replace(',', '.')
  if (!t) return NaN
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

export function parseLocaleNumberOrZero(raw: string): number {
  const n = parseLocaleNumber(raw)
  return Number.isNaN(n) ? 0 : n
}

export interface MacroTotals {
  carbsG: number
  proteinG: number
  fatG: number
  kcal: number
}

export function scaledFromRefs(
  qtyG: number,
  ref: { carbs: number; protein: number; fat: number; kcal: number },
): MacroTotals {
  const m = qtyG / 100
  return {
    carbsG: ref.carbs * m,
    proteinG: ref.protein * m,
    fatG: ref.fat * m,
    kcal: ref.kcal * m,
  }
}

export function sumTotals(a: MacroTotals, b: MacroTotals): MacroTotals {
  return {
    carbsG: a.carbsG + b.carbsG,
    proteinG: a.proteinG + b.proteinG,
    fatG: a.fatG + b.fatG,
    kcal: a.kcal + b.kcal,
  }
}

export const ZERO_TOTALS: MacroTotals = { carbsG: 0, proteinG: 0, fatG: 0, kcal: 0 }

/** Suma tablas del plan + ítems de Mi lista con gramos (`libraryQtyDraft` + refs guardadas). */
export function grandTotalsFromWorkbook(wb: PlanningWorkbookStateV1): MacroTotals {
  let acc = ZERO_TOTALS
  for (const sec of wb.sections) {
    for (const r of sec.rows) {
      const q = parseLocaleNumberOrZero(r.qtyG)
      if (q <= 0) continue
      acc = sumTotals(
        acc,
        scaledFromRefs(q, {
          carbs: parseLocaleNumberOrZero(r.refCarbs),
          protein: parseLocaleNumberOrZero(r.refProt),
          fat: parseLocaleNumberOrZero(r.refFat),
          kcal: parseLocaleNumberOrZero(r.refKcal),
        }),
      )
    }
  }
  const draft = wb.libraryQtyDraft ?? {}
  const libRefs = wb.libraryFoodRefsById ?? {}
  for (const [id, qtyStr] of Object.entries(draft)) {
    const q = parseLocaleNumberOrZero(qtyStr)
    if (q <= 0) continue
    const ref = libRefs[id]
    if (!ref) continue
    acc = sumTotals(
      acc,
      scaledFromRefs(q, {
        carbs: ref.c,
        protein: ref.p,
        fat: ref.f,
        kcal: ref.k,
      }),
    )
  }
  return acc
}

export function pctKcalMacros(t: MacroTotals): { p: number; c: number; f: number } | null {
  const kcalFromMacros = t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9
  if (kcalFromMacros <= 0) return null
  return {
    p: (100 * t.proteinG * 4) / kcalFromMacros,
    c: (100 * t.carbsG * 4) / kcalFromMacros,
    f: (100 * t.fatG * 9) / kcalFromMacros,
  }
}
