import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/supabasePublic', () => ({ supabasePublic: {} }))

import { buildWeekAlerts, feedbackWindowOpen, weekClose, weekCloseMessage, type AlertRoutine } from '@/lib/routine/trainingWeek'
import type { DayStatus } from '@/lib/routine/studentTrainingLog'

const at = (ymd: string) => new Date(`${ymd}T12:00:00`)
// 2026-11-09 es lunes; 13 viernes; 14 sábado; 15 domingo.

describe('feedbackWindowOpen', () => {
  const week = (open: number) => ({ total: 3, done: 3 - open, missed: 0, open })
  it('viernes, sábado y domingo siempre', () => {
    for (const d of ['2026-11-13', '2026-11-14', '2026-11-15']) expect(feedbackWindowOpen(at(d), week(3))).toBe(true)
  })
  it('entre semana solo si está en su último día de entrenamiento', () => {
    expect(feedbackWindowOpen(at('2026-11-10'), week(3))).toBe(false)
    expect(feedbackWindowOpen(at('2026-11-10'), week(2))).toBe(false)
    // Entrenó lunes y martes; el jueves le queda el último día: ya puede responder.
    expect(feedbackWindowOpen(at('2026-11-12'), week(1))).toBe(true)
    expect(feedbackWindowOpen(at('2026-11-12'), week(0))).toBe(true)
  })
})

describe('weekCloseMessage', () => {
  const close = (missed: number, open = 0) => ({ total: 3, done: 3 - missed - open, missed, open })
  it('no felicita si quedan días o falta el formulario', () => {
    expect(weekCloseMessage(close(0, 1), { feedbackDone: true, isLastWeek: false })).toBeNull()
    expect(weekCloseMessage(close(0), { feedbackDone: false, isLastWeek: false })).toBeNull()
  })
  it('semana completa lleva la frase del proyecto', () => {
    expect(weekCloseMessage(close(0), { feedbackDone: true, isLastWeek: false })?.body).toContain('A seguir haciéndolo hábito.')
  })
  it('con faltas el mensaje es motivador, no de felicitación', () => {
    const m = weekCloseMessage(close(1), { feedbackDone: true, isLastWeek: false })!
    expect(m.title).toBe('Semana cerrada')
    expect(m.body).toContain('seguir haciéndolo hábito')
  })
  it('la última semana avisa que terminó el mes', () => {
    expect(weekCloseMessage(close(0), { feedbackDone: true, isLastWeek: true })?.title).toContain('mes')
  })
})

describe('buildWeekAlerts', () => {
  const routine = (blocks: number): AlertRoutine => ({
    id: 'r',
    studentId: 's',
    studentName: 'Briana Cardozo',
    studentPhone: null,
    blocks: Array.from({ length: blocks }, (_, i) => ({
      id: `b${i}`,
      name: `Semana ${i + 1}`,
      // Semana 1 empieza el lunes 2026-11-09.
      start_date: new Date(Date.UTC(2026, 10, 9 + i * 7)).toISOString().slice(0, 10),
      end_date: new Date(Date.UTC(2026, 10, 15 + i * 7)).toISOString().slice(0, 10),
      dayIds: [`b${i}d1`, `b${i}d2`],
      loggedSets: 0,
    })),
  })
  const run = (r: AlertRoutine, status: Record<string, DayStatus>, ymd: string, missingForm = false) =>
    buildWeekAlerts({ routines: [r], statusOf: (id) => status[id], missingForm: new Set(missingForm ? ['s'] : []), today: at(ymd), todayYmd: ymd })

  it('semana terminada con formulario', () => {
    const a = run(routine(4), { b0d1: 'done', b0d2: 'missed' }, '2026-11-13')
    expect(a.map((x) => x.kind)).toEqual(['week_done'])
    expect(a[0]!.detail).toContain('Faltó 1 día')
  })
  it('sin formulario no avisa que terminó', () => {
    expect(run(routine(4), { b0d1: 'done', b0d2: 'done' }, '2026-11-13', true)).toEqual([])
  })
  it('al cerrar la anteúltima semana avisa que entra en la última', () => {
    const a = run(routine(4), { b2d1: 'done', b2d2: 'done' }, '2026-11-27')
    expect(a[0]!.kind).toBe('last_week')
  })
  it('al cerrar la última avisa que terminó el mes', () => {
    const a = run(routine(4), { b3d1: 'done', b3d2: 'done' }, '2026-12-04')
    expect(a[0]!.kind).toBe('month_done')
  })
  it('sábado sin nada registrado: aviso con recordatorio', () => {
    const a = run(routine(4), {}, '2026-11-14', true)
    expect(a[0]!.kind).toBe('no_record')
    expect(a[0]!.whatsapp).toContain('antes del lunes')
  })
  it('entre semana no reclama, y con kilos anotados tampoco', () => {
    expect(run(routine(4), {}, '2026-11-11', true)).toEqual([])
    const r = routine(4)
    r.blocks[0]!.loggedSets = 3
    expect(run(r, {}, '2026-11-14', true)).toEqual([])
  })
})

describe('weekClose', () => {
  it('cuenta terminados, no entrenados y abiertos', () => {
    const s: Record<string, DayStatus> = { a: 'done', b: 'missed' }
    expect(weekClose(['a', 'b', 'c'], (id) => s[id])).toEqual({ total: 3, done: 1, missed: 1, open: 1 })
  })
})
