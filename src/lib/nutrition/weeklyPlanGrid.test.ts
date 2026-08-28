import { describe, expect, it } from 'vitest'
import {
  createEmptyWeeklyGrid,
  dayAccent,
  filledMealCountForDay,
  compactMealLabel,
  mealContentLines,
  mealRowLineChunks,
  chunkLines,
  wrapLongLines,
} from '@/lib/nutrition/weeklyPlanGrid'

describe('weeklyPlanGrid presentation', () => {
  it('colorea cada día y el fin de semana unificado', () => {
    expect(dayAccent(0, false).color).toBe('#F97316')
    expect(dayAccent(6, false).color).toBe('#22C55E')
    expect(dayAccent(5, true).color).toBe('#6366F1')
  })

  it('cuenta comidas con contenido por día', () => {
    const grid = createEmptyWeeklyGrid(false)
    grid.mealRows[0].columns[0] = 'Tostadas'
    grid.mealRows[1].columns[0] = 'Pollo'
    grid.mealRows[1].columns[1] = 'Pescado'
    expect(filledMealCountForDay(grid, 0)).toBe(2)
    expect(filledMealCountForDay(grid, 1)).toBe(1)
    expect(filledMealCountForDay(grid, 2)).toBe(0)
  })

  it('parte el menú en líneas y limpia viñetas', () => {
    expect(mealContentLines('- Tostadas\n\n• Infusión\n')).toEqual(['Tostadas', 'Infusión'])
  })

  it('envuelve párrafos largos y arma bandas por día', () => {
    expect(wrapLongLines(['abcdefghijklmnop'], 8)).toEqual(['abcdefgh', 'ijklmnop'])
    expect(chunkLines(['a', 'b', 'c', 'd'], 2)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
    const bands = mealRowLineChunks(['uno\ndos\ntres\ncuatro', 'solo'], 2, { maxChars: 80, maxLines: 2 })
    expect(bands).toHaveLength(2)
    expect(bands[0][0]).toEqual(['uno', 'dos'])
    expect(bands[0][1]).toEqual(['solo'])
    expect(bands[1][0]).toEqual(['tres', 'cuatro'])
    expect(bands[1][1]).toEqual([])
  })

  it('abrevia colaciones largas a un renglón', () => {
    expect(compactMealLabel('Colación de media mañana')).toBe('Colación AM')
    expect(compactMealLabel('Colación de media tarde')).toBe('Colación PM')
    expect(compactMealLabel('Desayuno')).toBe('Desayuno')
  })
})
