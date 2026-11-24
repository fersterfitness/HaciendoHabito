import { describe, expect, it } from 'vitest'
import { noteItemsFor, type CoachNoteItem } from './coachNotes'

const base = { created_at: '2026-11-24T10:00:00Z', seen_at: null }
const items: CoachNoteItem[] = [
  { ...base, id: '1', exercise_id: 'sentadilla-sem2', day_id: null, circuit_group: null, note: 'Bajá lento' },
  { ...base, id: '2', exercise_id: 'sentadilla-sem2', day_id: null, circuit_group: null, note: 'Subí 2,5 kg' },
  { ...base, id: '3', exercise_id: 'sentadilla-sem1', day_id: null, circuit_group: null, note: 'Otra semana' },
  { ...base, id: '4', exercise_id: null, day_id: 'dia-a', circuit_group: 7, note: 'Descanso 2 min entre vueltas' },
  { ...base, id: '5', exercise_id: null, day_id: 'dia-b', circuit_group: 7, note: 'Otro día' },
]

describe('notas para el alumno por semana y circuito', () => {
  it('trae todas las notas del ejercicio de esa semana y ninguna de otra', () => {
    expect(noteItemsFor(items, { exerciseId: 'sentadilla-sem2' }).map((n) => n.id)).toEqual(['1', '2'])
  })
  it('las del circuito son del día y del grupo', () => {
    expect(noteItemsFor(items, { dayId: 'dia-a', circuitGroup: 7 }).map((n) => n.id)).toEqual(['4'])
  })
  it('sin la migración no hay notas', () => {
    expect(noteItemsFor(null, { exerciseId: 'x' })).toEqual([])
  })
})
