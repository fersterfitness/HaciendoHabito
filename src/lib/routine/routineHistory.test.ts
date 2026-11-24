import { describe, expect, it } from 'vitest'
import { historyLine } from './routineHistory'

const day = (ymd: string | null) => (ymd ? ymd.slice(8, 10) + '/' + ymd.slice(5, 7) : null)
const base = { id: 'r', name: 'Fuerza', objective: null, status: 'completada' }

describe('historial de rutinas del alumno', () => {
  it('muestra las fechas y cuántos días entrenó', () => {
    expect(historyLine({ ...base, start_date: '2026-10-03', end_date: '2026-10-30', days_done: 12 }, day)).toBe('Del 03/10 al 30/10 · 12 días entrenados')
    expect(historyLine({ ...base, start_date: '2026-10-03', end_date: null, days_done: 1 }, day)).toBe('Desde el 03/10 · 1 día entrenado')
  })
  it('sin días o sin dato de días', () => {
    expect(historyLine({ ...base, start_date: null, end_date: null, days_done: 0 }, day)).toBe('Sin días entrenados')
    expect(historyLine({ ...base, start_date: '2026-10-03', end_date: '2026-10-30', days_done: -1 }, day)).toBe('Del 03/10 al 30/10')
  })
})
