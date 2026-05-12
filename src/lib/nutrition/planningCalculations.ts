/** Número con coma o punto decimal */

import {
  MEAL_SLOT_KEYS,
  normalizeMealDistribution,
  type PlanningWorkbookStateV1,
} from '@/lib/nutrition/planningWorkbookTypes'
import type { NutritionFoodLibrary } from '@/types/database'

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

export const DEFAULT_MACRO_REF_BASIS_G = 100

export function coerceMacroRefBasisG(n: number | undefined | null): number {
  if (n == null || !Number.isFinite(n) || n <= 0) return DEFAULT_MACRO_REF_BASIS_G
  return Math.min(10000, n)
}

/** Base de referencia en la Guía (g por fila; bebidas en ml siguen usando 100 ml en la práctica). */
export function libraryMacroRefBasisG(lib: Pick<NutritionFoodLibrary, 'macro_qty_presentation' | 'macro_ref_basis_g'>): number {
  const mq = lib.macro_qty_presentation ?? 'grams'
  if (mq === 'volume') return DEFAULT_MACRO_REF_BASIS_G
  return coerceMacroRefBasisG(lib.macro_ref_basis_g)
}

export function scaledFromRefs(
  qtyG: number,
  ref: { carbs: number; protein: number; fat: number; kcal: number },
  refBasisG: number = DEFAULT_MACRO_REF_BASIS_G,
): MacroTotals {
  const basis = coerceMacroRefBasisG(refBasisG)
  const m = qtyG / basis
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
      const rowBasis = coerceMacroRefBasisG(parseLocaleNumberOrZero(r.refBasisG ?? ''))
      acc = sumTotals(
        acc,
        scaledFromRefs(
          q,
          {
            carbs: parseLocaleNumberOrZero(r.refCarbs),
            protein: parseLocaleNumberOrZero(r.refProt),
            fat: parseLocaleNumberOrZero(r.refFat),
            kcal: parseLocaleNumberOrZero(r.refKcal),
          },
          rowBasis,
        ),
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
      scaledFromRefs(
        q,
        {
          carbs: ref.c,
          protein: ref.p,
          fat: ref.f,
          kcal: ref.k,
        },
        coerceMacroRefBasisG(ref.b),
      ),
    )
  }
  return acc
}

/** Macros de los ítems con gramos en la distribución del día (PDF/alumno). */
export function mealDistributionPicksTotals(wb: PlanningWorkbookStateV1): MacroTotals {
  let acc = ZERO_TOTALS
  const md = normalizeMealDistribution(wb.mealDistribution)
  const picksByMeal = md.picksByMeal ?? {}
  for (const slot of MEAL_SLOT_KEYS) {
    const picks = picksByMeal[slot]
    if (!picks?.length) continue
    for (const p of picks) {
      const q = parseLocaleNumberOrZero(p.qtyG)
      if (q <= 0) continue
      if (p.kind === 'plan_row') {
        const sec = wb.sections.find((s) => s.key === p.secKey)
        const row = sec?.rows.find((r) => r.id === p.rowId)
        if (!row) continue
        const rowBasis = coerceMacroRefBasisG(parseLocaleNumberOrZero(row.refBasisG ?? ''))
        acc = sumTotals(
          acc,
          scaledFromRefs(
            q,
            {
              carbs: parseLocaleNumberOrZero(row.refCarbs),
              protein: parseLocaleNumberOrZero(row.refProt),
              fat: parseLocaleNumberOrZero(row.refFat),
              kcal: parseLocaleNumberOrZero(row.refKcal),
            },
            rowBasis,
          ),
        )
      } else {
        const ref = wb.libraryFoodRefsById?.[p.libraryFoodId]
        if (!ref) continue
        acc = sumTotals(
          acc,
          scaledFromRefs(
            q,
            {
              carbs: ref.c,
              protein: ref.p,
              fat: ref.f,
              kcal: ref.k,
            },
            coerceMacroRefBasisG(ref.b),
          ),
        )
      }
    }
  }
  return acc
}

/** Tablas + borradores de Mi lista + momentos del día con gramos cargados (armado integrado del plan). */
export function plannedNutritionTotalsFromWorkbook(wb: PlanningWorkbookStateV1): MacroTotals {
  return sumTotals(grandTotalsFromWorkbook(wb), mealDistributionPicksTotals(wb))
}

export function diffTotals(a: MacroTotals, b: MacroTotals): MacroTotals {
  return {
    carbsG: a.carbsG - b.carbsG,
    proteinG: a.proteinG - b.proteinG,
    fatG: a.fatG - b.fatG,
    kcal: a.kcal - b.kcal,
  }
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
