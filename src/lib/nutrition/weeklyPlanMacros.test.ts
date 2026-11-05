import { describe, expect, it } from 'vitest'
import {
  cleanMacros,
  copyMealCell,
  dayMacroTotals,
  formatMacros,
  normalizeWeeklyGrid,
  reshapeGrid,
  type WeeklyPlanGridJson,
} from '@/lib/nutrition/weeklyPlanGrid'

const row = (macros?: unknown[]) => ({ id: 'r', label: 'Desayuno', approxTime: '8:00', columns: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], macros })

describe('macros por comida', () => {
  it('limpia valores: coma decimal, vacíos y negativos', () => {
    expect(cleanMacros({ kcal: '450', p: '12,5', c: '', g: -3 })).toEqual({ kcal: 450, p: 12.5, c: null, g: null })
    expect(cleanMacros({ kcal: '', p: null })).toBeNull()
    expect(cleanMacros('basura')).toBeNull()
  })

  it('normalizar conserva macros, rellena días y saca la clave si no hay ninguno', () => {
    const g = normalizeWeeklyGrid({ mealRows: [row([{ kcal: 300 }])] }, false)
    expect(g.mealRows[0].macros).toHaveLength(7)
    expect(g.mealRows[0].macros?.[0]).toEqual({ kcal: 300, p: null, c: null, g: null })
    expect(g.mealRows[0].macros?.[6]).toBeNull()
    const empty = normalizeWeeklyGrid({ mealRows: [row([{ kcal: '' }])] }, false)
    expect('macros' in empty.mealRows[0]).toBe(false)
  })

  it('suma los macros del día', () => {
    const grid: WeeklyPlanGridJson = normalizeWeeklyGrid(
      {
        mealRows: [
          { ...row([{ kcal: 300, p: 20, c: null, g: 10 }]), id: 'a' },
          { ...row([{ kcal: 450.5, p: 30, c: 50, g: null }]), id: 'b' },
          { ...row(), id: 'c' },
        ],
      },
      false,
    )
    expect(dayMacroTotals(grid, 0)).toEqual({ kcal: 750.5, p: 50, c: 50, g: 10 })
    expect(dayMacroTotals(grid, 3)).toBeNull()
  })

  it('al unir el finde quedan los del sábado; al separar se copian a los dos días', () => {
    const seven = normalizeWeeklyGrid({ mealRows: [row([null, null, null, null, null, { kcal: 500 }, { kcal: 700 }])] }, false)
    const merged = reshapeGrid(seven, false, true)
    expect(merged.mealRows[0].macros?.[5]?.kcal).toBe(500)
    const split = reshapeGrid(merged, true, false)
    expect(split.mealRows[0].macros?.[5]?.kcal).toBe(500)
    expect(split.mealRows[0].macros?.[6]?.kcal).toBe(500)
  })

  it('copia menú y macros a los días elegidos sin tocar el resto', () => {
    const g = normalizeWeeklyGrid({ mealRows: [row([{ kcal: 380, p: 18 }])] }, false)
    const out = copyMealCell(g, 0, 0, [1, 2, 0, 9])
    expect(out.mealRows[0].columns.slice(0, 4)).toEqual(['a', 'a', 'a', 'd'])
    expect(out.mealRows[0].macros?.[2]).toEqual({ kcal: 380, p: 18, c: null, g: null })
    expect(out.mealRows[0].macros?.[3]).toBeNull()
    expect(g.mealRows[0].columns[1]).toBe('b')
  })

  it('formatea sólo lo cargado', () => {
    expect(formatMacros({ kcal: 450, p: 30, c: null, g: 12.5 })).toBe('450 kcal · P 30 g · G 12,5 g')
  })
})
