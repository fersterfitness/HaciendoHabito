/** Número con coma o punto decimal */

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

export function pctKcalMacros(t: MacroTotals): { p: number; c: number; f: number } | null {
  const kcalFromMacros = t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9
  if (kcalFromMacros <= 0) return null
  return {
    p: (100 * t.proteinG * 4) / kcalFromMacros,
    c: (100 * t.carbsG * 4) / kcalFromMacros,
    f: (100 * t.fatG * 9) / kcalFromMacros,
  }
}
