import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { draftFromMenu, emptyMenuDraft, menuFromDraft } from './customMenus'
import { SEASONAL_MENU_TEMPLATES } from './seasonalMenuLibrary'
import { seasonalMenuMeals, seasonalMenuToReusablePlan } from './seasonalMenuToPlan'

describe('menús propios', () => {
  it('no deja guardar sin nombre, sin comidas o sin calorías', () => {
    expect(menuFromDraft(emptyMenuDraft()).error).toMatch(/nombre/)
    const d = { ...emptyMenuDraft(), title: 'Mi menú' }
    expect(menuFromDraft(d).error).toMatch(/al menos una comida/)
    d.meals[0] = { label: 'Desayuno', kcal: '', content: 'Café con leche' }
    expect(menuFromDraft(d).error).toMatch(/calorías de «Desayuno»/)
  })

  it('arma el menú con el formato de la biblioteca y suma las calorías', () => {
    const d = { ...emptyMenuDraft(), title: '  Mi menú  ', notes: 'Sin gluten' }
    d.meals = [
      { label: 'Desayuno', kcal: '300', content: 'Café con leche\n- Tostadas 2 unidades' },
      { label: 'Almuerzo', kcal: '550,4', content: 'Pollo 150 g' },
      { label: 'Merienda', kcal: '', content: '' },
    ]
    const { menu, error } = menuFromDraft(d)
    expect(error).toBeNull()
    expect(menu!.title).toBe('Mi menú')
    expect(menu!.approximateKcal).toBe(850)
    expect(menu!.bodyMd).toContain('### Desayuno (~300 kcal)\n- Café con leche\n- Tostadas 2 unidades')
    const asTemplate = { ...menu!, id: 'custom:x' }
    expect(seasonalMenuMeals(asTemplate).map((m) => [m.label, m.kcal])).toEqual([
      ['Desayuno', 300],
      ['Almuerzo', 550],
    ])
    const plan = seasonalMenuToReusablePlan(asTemplate)
    expect(plan.grid.mealRows[1]!.columns[0]).toBe('Pollo 150 g')
    expect(plan.notes).toContain('Sin gluten')
  })

  it('un menú de la app se puede copiar y volver a guardar sin perder comidas', () => {
    for (const original of SEASONAL_MENU_TEMPLATES) {
      const draft = draftFromMenu(original, true)
      expect(draft.id).toBeUndefined()
      expect(draft.title).toBe(`${original.title} (copia)`)
      const { menu, error } = menuFromDraft(draft)
      expect(error, original.id).toBeNull()
      const before = seasonalMenuMeals(original)
      const after = seasonalMenuMeals({ ...menu!, id: 'custom:x' })
      expect(after.map((m) => [m.label, m.kcal]), original.id).toEqual(before.map((m) => [m.label, m.kcal]))
    }
  })
})
