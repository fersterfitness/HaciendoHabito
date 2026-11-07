import { describe, expect, it } from 'vitest'
import { gridHasContent, matchesPlanQuery, planPreviewLines, toReusablePlan } from './planReuse'
import { createEmptyWeeklyGrid } from './weeklyPlanGrid'

const grid = {
  mealRows: [
    { id: 'a', label: 'Desayuno', approxTime: '08:00', columns: ['', 'Yogur con avena\ny fruta', '', ''] },
    { id: 'b', label: 'Almuerzo', approxTime: '13:00', columns: ['Pollo con calabaza', '', '', ''] },
    { id: 'c', label: 'Cena', approxTime: '21:00', columns: ['', '', '', ''] },
  ],
}

describe('planReuse', () => {
  it('distingue una grilla vacía de una con algo escrito', () => {
    expect(gridHasContent(createEmptyWeeklyGrid(true))).toBe(false)
    expect(gridHasContent({ mealRows: [{ id: 'x', label: 'Cena', approxTime: '', columns: ['  ', ''] }] })).toBe(false)
    expect(gridHasContent(grid)).toBe(true)
  })

  it('resume cada comida con el primer día que tiene algo', () => {
    expect(planPreviewLines(grid)).toEqual([
      { label: 'Desayuno', text: 'Yogur con avena y fruta' },
      { label: 'Almuerzo', text: 'Pollo con calabaza' },
    ])
  })

  it('busca por nombre, objetivo o contenido, sin importar tildes ni mayúsculas', () => {
    const plan = toReusablePlan({ id: '1', source: 'template', name: 'Descenso 1800', subtitle: 'Pérdida de grasa', merge_weekends: true, grid, updated_at: '' })
    expect(matchesPlanQuery(plan, '')).toBe(true)
    expect(matchesPlanQuery(plan, 'perdida')).toBe(true)
    expect(matchesPlanQuery(plan, 'CALABAZA pollo')).toBe(true)
    expect(matchesPlanQuery(plan, 'vegano')).toBe(false)
  })
})
