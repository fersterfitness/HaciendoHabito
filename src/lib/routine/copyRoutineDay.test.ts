import { describe, expect, it } from 'vitest'
import { dayInsertPayload, exerciseInsertPayload, type DayCopySource } from '@/lib/routine/copyRoutineDay'
import type { RoutineExercise } from '@/types/database'

const source: DayCopySource = {
  id: 'd1',
  block_id: 'b1',
  day_name: 'Lunes fuerza',
  day_of_week: 1,
  muscle_focus: 'Pecho',
  warmup_notes: 'movilidad',
  sort_order: 0,
  exercises: [],
}

describe('copyRoutineDay helpers', () => {
  it('copia un día a otro bloque conservando nombre y foco', () => {
    const row = dayInsertPayload(source, 'b2', 3)
    expect(row.block_id).toBe('b2')
    expect(row.day_name).toBe('Lunes fuerza')
    expect(row.muscle_focus).toBe('Pecho')
    expect(row.sort_order).toBe(3)
  })

  it('permite sufijo al duplicar en la misma semana', () => {
    expect(dayInsertPayload(source, 'b1', 1, ' (copia)').day_name).toBe('Lunes fuerza (copia)')
  })

  it('copia prescripción de ejercicio al día destino', () => {
    const ex = {
      id: 'e1',
      day_id: 'd1',
      exercise_id: 'ex1',
      sort_order: 0,
      sets: 3,
      reps_min: 8,
      reps_max: 10,
      reps_scheme: null,
      weight_kg: 40,
      rir: 2,
      rpe: null,
      rest_seconds: 90,
      tempo: null,
      technical_notes: null,
      is_superset: false,
      superset_group: null,
    } as RoutineExercise
    const row = exerciseInsertPayload(ex, 'd2')
    expect(row.day_id).toBe('d2')
    expect(row.sets).toBe(3)
    expect(row.weight_kg).toBe(40)
  })
})
