import { describe, expect, it } from 'vitest'
import { SEASONAL_MENU_TEMPLATES } from './seasonalMenuLibrary'
import { gridHasContent } from './planReuse'
import { seasonalMenuMeals, seasonalMenuToReusablePlan } from './seasonalMenuToPlan'
import { normalizeWeeklyGrid } from './weeklyPlanGrid'

describe('seasonalMenuToReusablePlan', () => {
  it('todos los menús de la biblioteca dan un plan con comidas', () => {
    for (const menu of SEASONAL_MENU_TEMPLATES) {
      const meals = seasonalMenuMeals(menu)
      expect(meals.length, menu.id).toBeGreaterThanOrEqual(3)
      const plan = seasonalMenuToReusablePlan(menu)
      expect(gridHasContent(plan.grid), menu.id).toBe(true)
      expect(plan.grid.mealRows.map((r) => r.label)).toEqual(meals.map((m) => m.label))
    }
  })

  it('pasa el texto llano, igual todos los días, con las calorías de cada comida', () => {
    const menu = SEASONAL_MENU_TEMPLATES.find((m) => m.id === 'invierno-base-digestivo')!
    const plan = seasonalMenuToReusablePlan(menu)
    const desayuno = plan.grid.mealRows[0]!
    expect(desayuno.label).toBe('Desayuno')
    expect(desayuno.approxTime).toBe('08:00')
    expect(desayuno.columns).toHaveLength(6)
    expect(new Set(desayuno.columns).size).toBe(1)
    expect(desayuno.columns[0]).not.toMatch(/\*\*|^- /m)
    expect(desayuno.columns[0]).toContain('Avena 40 g')
    expect(desayuno.macros?.[0]?.kcal).toBe(420)
    expect(plan.notes).toContain('Notas clínicas')
    expect(plan.notes).not.toContain('Desayuno')
  })

  it('sobrevive a la normalización que hace la carpeta al guardar', () => {
    const plan = seasonalMenuToReusablePlan(SEASONAL_MENU_TEMPLATES[0]!)
    const normalized = normalizeWeeklyGrid(plan.grid, true)
    expect(normalized.mealRows.map((r) => r.columns[0])).toEqual(plan.grid.mealRows.map((r) => r.columns[0]))
    expect(normalized.mealRows[0]!.macros?.[0]?.kcal).toBe(plan.grid.mealRows[0]!.macros?.[0]?.kcal)
  })
})
