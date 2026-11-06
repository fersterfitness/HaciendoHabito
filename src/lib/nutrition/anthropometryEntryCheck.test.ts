import { describe, expect, it } from 'vitest'
import { checkAnthroValue, previousControlValues } from './anthropometryEntryCheck'
import type { NutritionMeasurement } from '@/types/database'

const m = (id: string, measured_at: string, medians: Record<string, number>, weight_kg: number | null = null) =>
  ({ id, measured_at, weight_kg, height_cm: null, detail: { medians } }) as unknown as NutritionMeasurement

describe('checkAnthroValue', () => {
  it('no marca valores normales', () => {
    expect(checkAnthroValue('peso_bruto_kg', 71.2, 70)).toBeNull()
    expect(checkAnthroValue('triceps_mm', 14, 11, [13.5])).toBeNull()
    expect(checkAnthroValue('cintura_min_cm', 80, null)).toBeNull()
  })
  it('detecta la coma corrida', () => {
    expect(checkAnthroValue('peso_bruto_kg', 7.1, 70)).toMatch(/coma/i)
    expect(checkAnthroValue('cintura_min_cm', 805, 80)).toMatch(/coma/i)
  })
  it('detecta valores fuera de rango, lejos de las otras series o del control anterior', () => {
    expect(checkAnthroValue('triceps_mm', 150, null)).toMatch(/esperable/)
    expect(checkAnthroValue('cintura_min_cm', 92, null, [80, 80.5])).toMatch(/series/)
    expect(checkAnthroValue('peso_bruto_kg', 90, 70)).toMatch(/anterior/)
  })
  it('no marca el valor bueno por culpa de una serie con la coma corrida', () => {
    expect(checkAnthroValue('peso_bruto_kg', 82.4, 83, [8.25])).toBeNull()
  })
})

describe('previousControlValues', () => {
  const list = [m('a', '2026-09-01', { cintura_min_cm: 82 }, 70), m('b', '2026-10-01', { cintura_min_cm: 80 }), m('c', '2026-08-01', {})]
  it('toma el control más nuevo', () => {
    expect(previousControlValues(list).cintura_min_cm).toBe(80)
  })
  it('al editar, toma el anterior al editado y completa el peso de la columna resumen', () => {
    const p = previousControlValues(list, 'b')
    expect(p.cintura_min_cm).toBe(82)
    expect(p.peso_bruto_kg).toBe(70)
  })
})
