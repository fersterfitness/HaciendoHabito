import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { buildTrainingMonitor, fetchAllPages, monitorSummary, weekActivity, type MonitorDayLog, type MonitorRoutine, type MonitorSetLog } from './trainingMonitor'

const NOW = new Date(2026, 10, 16, 18, 0, 0) // lunes 16/11/2026, 18:00 hora local
const TODAY = '2026-11-16'
const minsAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString()

/** Rutina de dos semanas; cada semana tiene «Día 1 · Torso» (2 ejercicios de 3 series) y «Día 2 · Pierna» (1 de 4). */
function routine(id: string, name: string, plannedKg: number | null = 40): MonitorRoutine {
  const week = (w: number, start: string, end: string) => ({
    id: `${id}-w${w}`,
    sort_order: w,
    start_date: start,
    end_date: end,
    days: [
      {
        id: `${id}-w${w}-d0`,
        day_name: 'Día 1',
        muscle_focus: 'Torso',
        sort_order: 0,
        exercises: [
          { id: `${id}-w${w}-d0-press`, exercise_id: 'press', sets: 3, weight_kg: plannedKg },
          { id: `${id}-w${w}-d0-remo`, exercise_id: 'remo', sets: 3, weight_kg: null },
        ],
      },
      { id: `${id}-w${w}-d1`, day_name: 'Día 2', muscle_focus: 'Pierna', sort_order: 1, exercises: [{ id: `${id}-w${w}-d1-sent`, exercise_id: 'sentadilla', sets: 4, weight_kg: null }] },
    ],
  })
  return { id, student_id: `s-${id}`, student_name: name, avatar_path: null, blocks: [week(0, '2026-11-09', '2026-11-15'), week(1, '2026-11-16', '2026-11-22')] }
}

const sets = (exerciseId: string, n: number, kg: number | null, at: string, completed = true): MonitorSetLog[] =>
  Array.from({ length: n }, (_, i) => ({ routine_exercise_id: exerciseId, set_number: i + 1, weight_kg: kg, completed, updated_at: at }))
const closed = (dayId: string, status: 'done' | 'missed', reason = ''): MonitorDayLog => ({ routine_day_id: dayId, status, status_date: TODAY, missed_reason: reason })

const run = (routines: MonitorRoutine[], setLogs: MonitorSetLog[] = [], dayLogs: MonitorDayLog[] = []) => buildTrainingMonitor({ routines, setLogs, dayLogs, now: NOW })

describe('buildTrainingMonitor', () => {
  it('entrenando ahora: anotó hace minutos y no cerró el día', () => {
    const [row] = run([routine('a', 'Juan')], [...sets('a-w1-d0-press', 3, 40, minsAgo(20)), ...sets('a-w1-d0-remo', 1, 30, minsAgo(4))])
    expect(row).toMatchObject({ state: 'live', dayLabel: 'Día 1 · Torso', detail: 'Serie 4 de 6', pct: 67 })
  })

  it('pasada la ventana sin cerrar el día, figura como que entrenó pero no cerró', () => {
    const [row] = run([routine('a', 'Juan')], [...sets('a-w1-d0-press', 3, 40, minsAgo(90)), ...sets('a-w1-d0-remo', 3, 30, minsAgo(70))])
    expect(row).toMatchObject({ state: 'done', pct: 100 })
    expect(row!.detail).toContain('todavía no cerró')
  })

  it('entrenó: cerró el día con todo hecho', () => {
    const [row] = run([routine('a', 'Sofía')], [...sets('a-w1-d0-press', 3, 40, minsAgo(120)), ...sets('a-w1-d0-remo', 3, 30, minsAgo(100))], [closed('a-w1-d0', 'done')])
    expect(row).toMatchObject({ state: 'done', detail: 'Cumplió el 100 % del día' })
  })

  it('con desvíos: salteó un ejercicio y levantó menos de lo planificado', () => {
    const [row] = run([routine('a', 'Martín')], sets('a-w1-d0-press', 3, 35, minsAgo(120)), [closed('a-w1-d0', 'done')])
    expect(row).toMatchObject({ state: 'deviated', pct: 50 })
    expect(row!.detail).toBe('Salteó 1 ejercicio · bajó cargas en 1 · hizo el 50 %')
  })

  it('sin kilos planificados, compara con el mismo ejercicio de la semana anterior', () => {
    const lastWeek = sets('a-w0-d1-sent', 4, 80, '2026-11-11T21:00:00.000Z')
    const [down] = run([routine('a', 'Martín')], [...lastWeek, ...sets('a-w1-d1-sent', 4, 70, minsAgo(60))], [closed('a-w1-d1', 'done')])
    expect(down).toMatchObject({ state: 'deviated', detail: 'Bajó cargas en 1 · hizo el 100 %' })
    const [same] = run([routine('a', 'Martín')], [...lastWeek, ...sets('a-w1-d1-sent', 4, 80, minsAgo(60))], [closed('a-w1-d1', 'done')])
    expect(same!.state).toBe('done')
  })

  it('las series marcadas como no hechas no cuentan', () => {
    const [row] = run([routine('a', 'Juan', null)], [...sets('a-w1-d0-press', 3, 40, minsAgo(60)), ...sets('a-w1-d0-remo', 3, null, minsAgo(50), false)], [closed('a-w1-d0', 'done')])
    expect(row).toMatchObject({ state: 'deviated', pct: 50 })
    expect(row!.detail).toContain('Salteó 1 ejercicio')
  })

  it('no entrenó: lo marcó hoy, con su motivo', () => {
    const [row] = run([routine('a', 'Lucía')], [], [closed('a-w1-d1', 'missed', 'Me quedé sin tiempo')])
    expect(row).toMatchObject({ state: 'missed', dayLabel: 'Día 2 · Pierna', detail: 'Me quedé sin tiempo' })
  })

  it('sin registro hoy: cuenta los días cerrados de la semana y dice cuál sigue', () => {
    const yesterday: MonitorDayLog = { routine_day_id: 'a-w1-d0', status: 'done', status_date: '2026-11-15', missed_reason: '' }
    const [row] = run([routine('a', 'Ana')], sets('a-w1-d0-press', 3, 40, '2026-11-15T20:00:00.000Z'), [yesterday])
    expect(row).toMatchObject({ state: 'idle', detail: '1 de 2 días esta semana · sigue Día 2 · Pierna' })
  })

  it('con día de la semana asignado: avisa qué le toca hoy y qué dejó sin hacer', () => {
    // NOW es lunes: Día 1 los lunes, Día 2 los jueves.
    const r = routine('a', 'Ana')
    for (const b of r.blocks) {
      b.days[0]!.day_of_week = 1
      b.days[1]!.day_of_week = 4
    }
    expect(run([r])[0]).toMatchObject({ state: 'due', dayLabel: 'Día 1 · Torso', detail: 'Todavía no registró nada' })

    // El jueves, sin haber hecho el del lunes: le toca el Día 2 y debe el Día 1.
    const thursday = new Date(2026, 10, 19, 18, 0, 0)
    const [row] = buildTrainingMonitor({ routines: [r], setLogs: [], dayLogs: [], now: thursday })
    expect(row).toMatchObject({ state: 'due', dayLabel: 'Día 2 · Pierna', detail: 'No hizo Día 1 · Torso (lunes)' })

    // El viernes no le toca nada: queda sin registro, con lo que debe.
    const friday = new Date(2026, 10, 20, 18, 0, 0)
    const [idle] = buildTrainingMonitor({ routines: [r], setLogs: [], dayLogs: [], now: friday })
    expect(idle!.state).toBe('idle')
    expect(idle!.detail).toBe('No hizo Día 1 · Torso (lunes), Día 2 · Pierna (jueves) · 0 de 2 días esta semana')
  })

  it('si ya cerró el día que le tocaba, no figura como pendiente', () => {
    const r = routine('a', 'Ana')
    for (const b of r.blocks) b.days[0]!.day_of_week = 1
    const [row] = run([r], [], [{ routine_day_id: 'a-w1-d0', status: 'done', status_date: '2026-11-15', missed_reason: '' }])
    expect(row!.state).toBe('idle')
  })

  it('ordena: entrenando ahora, con desvíos, no entrenó, entrenó, sin registro', () => {
    const rows = run(
      [routine('idle', 'Ana'), routine('done', 'Sofía'), routine('miss', 'Lucía'), routine('dev', 'Martín'), routine('live', 'Juan')],
      [
        ...sets('live-w1-d0-press', 1, 40, minsAgo(2)),
        ...sets('dev-w1-d0-press', 3, 30, minsAgo(100)),
        ...sets('done-w1-d0-press', 3, 40, minsAgo(200)),
        ...sets('done-w1-d0-remo', 3, 30, minsAgo(190)),
      ],
      [closed('dev-w1-d0', 'done'), closed('done-w1-d0', 'done'), closed('miss-w1-d0', 'missed')],
    )
    expect(rows.map((r) => r.state)).toEqual(['live', 'deviated', 'missed', 'done', 'idle'])
  })
})

describe('weekActivity', () => {
  it('cuenta alumnos distintos por día, de lunes a domingo', () => {
    const a = routine('a', 'Ana')
    const b = routine('b', 'Bruno')
    const week = weekActivity({
      routines: [a, b],
      setLogs: [...sets('a-w1-d0-press', 3, 40, minsAgo(60)), ...sets('b-w1-d0-press', 2, 40, minsAgo(30)), ...sets('b-w1-d0-remo', 1, null, minsAgo(20))],
      dayLogs: [{ routine_day_id: 'a-w1-d1', status: 'missed', status_date: '2026-11-17', missed_reason: '' }],
      now: NOW,
    })
    expect(week.map((d) => d.short).join('')).toBe('LMXJVSD')
    expect(week[0]).toMatchObject({ ymd: TODAY, trained: 2, missed: 0, isToday: true, isFuture: false })
    expect(week[1]).toMatchObject({ ymd: '2026-11-17', trained: 0, missed: 1, isFuture: true })
  })

  it('quien entrenó y además marcó «no entrené» ese día cuenta una sola vez, como entrenado', () => {
    const a = routine('a', 'Ana')
    const week = weekActivity({
      routines: [a],
      setLogs: sets('a-w1-d0-press', 1, 40, minsAgo(10)),
      dayLogs: [{ routine_day_id: 'a-w1-d1', status: 'missed', status_date: TODAY, missed_reason: '' }],
      now: NOW,
    })
    expect(week[0]).toMatchObject({ trained: 1, missed: 0 })
  })
})

describe('monitorSummary', () => {
  it('suma series, kilos movidos y avance promedio de hoy', () => {
    const a = routine('a', 'Ana')
    const setLogs: MonitorSetLog[] = [
      ...sets('a-w1-d0-press', 3, 40, minsAgo(5)).map((l) => ({ ...l, reps: 10 })),
      ...sets('a-w1-d0-remo', 1, null, minsAgo(4)),
      // De ayer: no cuenta.
      ...sets('a-w1-d1-sent', 2, 80, new Date(NOW.getTime() - 26 * 3_600_000).toISOString()).map((l) => ({ ...l, reps: 5 })),
    ]
    const rows = buildTrainingMonitor({ routines: [a], setLogs, dayLogs: [], now: NOW })
    const sum = monitorSummary({ rows, setLogs, now: NOW })
    expect(sum).toMatchObject({ setsToday: 4, volumeKg: 1200, doneToday: 4, plannedToday: 6, avgPct: 67, peakHour: 17 })
    expect(rows[0]).toMatchObject({ state: 'live', doneSets: 4, plannedSets: 6, volumeKg: 1200 })
  })
})

describe('fetchAllPages', () => {
  it('sigue pidiendo páginas hasta que una viene incompleta', async () => {
    const calls: [number, number][] = []
    const rows = await fetchAllPages<number>(async (from, to) => {
      calls.push([from, to])
      return { data: Array.from({ length: from === 2000 ? 300 : 1000 }, (_, i) => from + i), error: null }
    })
    expect(rows).toHaveLength(2300)
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })
})
