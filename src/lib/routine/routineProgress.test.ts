import { describe, expect, it } from 'vitest'
import { progressWeekIndex, startDayIndex } from './routineProgress'

const day = (id: string) => ({ id, exercises: [{ id: `${id}-e` }] })
const blocks = [1, 2, 3].map((w) => ({ days: ['a', 'b'].map((d) => day(`w${w}${d}`)) }))

function input(status: Record<string, 'done' | 'missed'>, sets: string[] = []) {
  return { statusOf: (id: string) => status[id], hasSets: (d: { id: string }) => sets.includes(d.id) }
}

describe('progressWeekIndex', () => {
  it('sin actividad arranca en la primera semana', () => {
    expect(progressWeekIndex(blocks, input({}))).toBe(0)
  })
  it('se queda en la semana con días abiertos y pasa a la siguiente cuando la cierra', () => {
    expect(progressWeekIndex(blocks, input({ w1a: 'done' }))).toBe(0)
    expect(progressWeekIndex(blocks, input({ w1a: 'done', w1b: 'missed' }))).toBe(1)
  })
  it('toma la última semana con actividad aunque las anteriores no tengan cierres (rutinas viejas)', () => {
    expect(progressWeekIndex(blocks, input({}, ['w2a']))).toBe(1)
  })
  it('en la última semana cerrada se queda ahí', () => {
    const all = Object.fromEntries(blocks.flatMap((b) => b.days.map((d) => [d.id, 'done' as const])))
    expect(progressWeekIndex(blocks, input(all))).toBe(2)
  })
})

describe('startDayIndex', () => {
  it('lleva al día con series hechas que no cerró', () => {
    expect(startDayIndex(blocks, 0, input({ w1a: 'done' }, ['w1b']))).toBe(1)
  })
  it('si no, al primer día sin cerrar', () => {
    expect(startDayIndex(blocks, 0, input({ w1a: 'done' }))).toBe(1)
    expect(startDayIndex(blocks, 0, input({}))).toBe(0)
  })
})
