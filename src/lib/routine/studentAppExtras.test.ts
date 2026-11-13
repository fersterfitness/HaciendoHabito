import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/supabasePublic', () => ({ supabasePublic: {} }))

import { businessDaysBetween, cycleDay, cyclePhase, liftProgress, paymentNotice, weeklyProgress } from '@/lib/routine/studentAppExtras'
import { EMPTY_DAY_LOG } from '@/lib/routine/studentTrainingLog'
import type { SharedRoutineBlock, SharedRoutineExercise } from '@/lib/routine/sharedRoutine'

const ex = (id: string, name: string) => ({ id, name }) as SharedRoutineExercise
const block = (i: number, exercises: SharedRoutineExercise[]): SharedRoutineBlock => ({
  id: `b${i}`,
  name: `Semana ${i}`,
  start_date: null,
  end_date: null,
  days: [
    { id: `b${i}d1`, day_name: 'Día 1', muscle_focus: null, warmup_notes: null, exercises },
    { id: `b${i}d2`, day_name: 'Día 2', muscle_focus: null, warmup_notes: null, exercises: [] },
  ],
})

describe('paymentNotice', () => {
  const pay = (from: number | null, to: number | null, paid = false) => ({ day_from: from, day_to: to, paid_this_month: paid })
  it('avisa dentro de la ventana de pago', () => {
    expect(paymentNotice(pay(10, 10), '2026-11-10')?.title).toBe('Hoy es tu fecha de pago')
    expect(paymentNotice(pay(5, 10), '2026-11-07')?.level).toBe('due')
  })
  it('no avisa antes, ni si ya hay un cobro del mes, ni sin ventana cargada', () => {
    expect(paymentNotice(pay(10, 10), '2026-11-09')).toBeNull()
    expect(paymentNotice(pay(10, 10, true), '2026-11-10')).toBeNull()
    expect(paymentNotice(pay(null, null), '2026-11-10')).toBeNull()
  })
  it('recién insiste pasados más de 5 días hábiles', () => {
    // Vence el martes 10: 5 días hábiles después es el martes 17; el aviso fuerte sale el miércoles 18.
    expect(paymentNotice(pay(10, 10), '2026-11-17')).toBeNull()
    expect(paymentNotice(pay(10, 10), '2026-11-18')?.level).toBe('late')
  })
  it('un día 31 en un mes de 30 cae el último día', () => {
    expect(paymentNotice(pay(31, 31), '2026-11-30')?.level).toBe('due')
  })
})

describe('businessDaysBetween', () => {
  it('saltea sábados y domingos', () => {
    expect(businessDaysBetween('2026-11-13', '2026-11-16')).toBe(1) // viernes → lunes
    expect(businessDaysBetween('2026-11-10', '2026-11-17')).toBe(5)
  })
})

describe('ciclo', () => {
  it('cuenta el día del ciclo desde el último inicio', () => {
    expect(cycleDay(['2026-11-10', '2026-10-13'], '2026-11-13')).toBe(4)
    expect(cycleDay([], '2026-11-13')).toBeNull()
    expect(cycleDay(['2026-06-01'], '2026-11-13')).toBeNull()
  })
  it('etapas orientativas', () => {
    expect(cyclePhase(2)).toBe('Menstruación')
    expect(cyclePhase(15)).toBe('Ovulación')
    expect(cyclePhase(22)).toBe('Fase lútea')
  })
})

describe('progreso', () => {
  const blocks = [block(1, [ex('a1', 'Sentadilla'), ex('p1', 'Press banca')]), block(2, [ex('a2', 'SENTADILLA'), ex('p2', 'Press banca')])]
  it('promedia el chequeo y cuenta los días cerrados por semana', () => {
    const weeks = weeklyProgress(blocks, {
      exercises: {},
      days: {
        b1d1: { ...EMPTY_DAY_LOG, status: 'done', sleep: 4, energy: 3, effort: 7 },
        b1d2: { ...EMPTY_DAY_LOG, status: 'missed', sleep: 2, energy: 3 },
      },
    })
    expect(weeks[0]).toMatchObject({ total: 2, done: 1, missed: 1, effort: 7 })
    expect(weeks[0]!.averages.sleep).toBe(3)
    expect(weeks[0]!.averages.stress).toBeNull()
    expect(weeks[1]).toMatchObject({ done: 0, missed: 0 })
  })
  it('compara el mejor peso de la primera semana con el de la última, sin importar mayúsculas', () => {
    const kg: Record<string, number[]> = { a1: [80, 85], a2: [90], p1: [60] }
    const lifts = liftProgress(blocks, (id) => kg[id] ?? [])
    expect(lifts).toEqual([{ name: 'Sentadilla', firstKg: 85, lastKg: 90, firstLabel: 'Semana 1', lastLabel: 'Semana 2' }])
  })
})
