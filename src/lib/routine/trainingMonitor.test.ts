import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { checkinFlags, pickMonitorRoutines, monitorFeed, weekMatrix, buildTrainingMonitor, fetchAllPages, monitorSummary, weekActivity, type MonitorDayLog, type MonitorRoutine, type MonitorSetLog } from './trainingMonitor'

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
    expect(sum.volumePrevKg).toBeNull()
  })

  it('compara los kilos con el mismo día de la semana pasada hasta esta misma hora', () => {
    const a = routine('a', 'Ana')
    const weekAgo = (h: number) => new Date(NOW.getTime() - 7 * 86_400_000 - h * 3_600_000).toISOString()
    const setLogs: MonitorSetLog[] = [
      ...sets('a-w1-d0-press', 2, 50, minsAgo(10)).map((l) => ({ ...l, reps: 10 })),
      ...sets('a-w0-d0-press', 2, 40, weekAgo(1)).map((l) => ({ ...l, reps: 10 })),
      // Más tarde que la hora actual, la semana pasada: no entra en la comparación.
      ...sets('a-w0-d0-remo', 3, 30, weekAgo(-2)).map((l) => ({ ...l, reps: 10 })),
    ]
    const rows = buildTrainingMonitor({ routines: [a], setLogs, dayLogs: [], now: NOW })
    expect(monitorSummary({ rows, setLogs, now: NOW })).toMatchObject({ volumeKg: 1000, volumePrevKg: 800, setsToday: 2 })
  })
})

describe('ejercicio en curso', () => {
  it('trae el último ejercicio anotado con su carga y la planificada', () => {
    const setLogs = [
      ...sets('a-w1-d0-press', 3, 40, minsAgo(20)),
      ...sets('a-w1-d0-remo', 2, 30, minsAgo(3)).map((l, i) => ({ ...l, reps: 8, updated_at: minsAgo(3 - i) })),
    ]
    const [row] = run([routine('a', 'Juan')], setLogs)
    expect(row!.current).toEqual({ exerciseId: 'a-w1-d0-remo', name: 'Ejercicio', setsDone: 2, setsPlanned: 3, weightKg: 30, reps: 8, plannedKg: null, restSeconds: null, effort: null, note: '' })
    expect(row!.exercises?.map((e) => [e.exerciseId, e.setsDone])).toEqual([
      ['a-w1-d0-press', 3],
      ['a-w1-d0-remo', 2],
    ])
    const [press] = run([routine('a', 'Juan')], sets('a-w1-d0-press', 1, 35, minsAgo(2)))
    expect(press!.current).toMatchObject({ setsDone: 1, setsPlanned: 3, weightKg: 35, plannedKg: 40 })
  })

  it('suma inicio de sesión, descanso planificado, feedback y chequeo de hoy', () => {
    const r = routine('a', 'Juan')
    r.blocks[1]!.days[0]!.exercises[0]!.rest_seconds = 90
    const setLogs = [...sets('a-w1-d0-press', 1, 40, minsAgo(30)), ...sets('a-w1-d0-press', 2, 40, minsAgo(2)).slice(1)]
    const feedback = [
      { routine_exercise_id: 'a-w1-d0-press', note: ' me molestó el hombro ', effort: 9, updated_at: minsAgo(1) },
      // De otra sesión: no cuenta.
      { routine_exercise_id: 'a-w1-d0-remo', note: 'viejo', effort: 5, updated_at: '2026-11-09T20:00:00.000Z' },
    ]
    const dayLogs: MonitorDayLog[] = [
      { routine_day_id: 'a-w1-d0', status: null, status_date: null, missed_reason: '', sleep: 2, energy: 4, stress: 3, soreness: 5, checkin_note: 'dormí poco', checkin_at: minsAgo(35) },
    ]
    const [row] = buildTrainingMonitor({ routines: [r], setLogs, dayLogs, feedback, now: NOW })
    expect(row).toMatchObject({ state: 'live', startedAt: minsAgo(30) })
    expect(row!.current).toMatchObject({ restSeconds: 90, effort: 9, note: 'me molestó el hombro' })
    expect(row!.exercises![1]).toMatchObject({ effort: null, note: '' })
    expect(row!.checkin).toEqual({ sleep: 2, energy: 4, stress: 3, soreness: 5, note: 'dormí poco' })
    expect(checkinFlags(row!.checkin!)).toEqual(['sleep', 'soreness'])
  })

  it('un chequeo de otro día no se muestra', () => {
    const dayLogs: MonitorDayLog[] = [{ routine_day_id: 'a-w1-d0', status: null, status_date: null, missed_reason: '', sleep: 1, checkin_at: '2026-11-09T12:00:00.000Z' }]
    const [row] = run([routine('a', 'Juan')], sets('a-w1-d0-press', 1, 40, minsAgo(2)), dayLogs)
    expect(row!.checkin).toBeUndefined()
  })

  it('las series que quedaron de otra sesión no cuentan para el avance de hoy', () => {
    // Una fila por número de serie: la 1 y la 2 son de hace 3 días, hoy solo pisó la 3.
    const old = new Date(NOW.getTime() - 3 * 86_400_000).toISOString()
    const setLogs = [...sets('a-w1-d0-press', 3, 40, old).slice(0, 2), { ...sets('a-w1-d0-press', 3, 40, minsAgo(5))[2]! }]
    const [row] = run([routine('a', 'Juan')], setLogs)
    expect(row).toMatchObject({ state: 'live', doneSets: 1, plannedSets: 6, pct: 17, detail: 'Serie 1 de 6' })
    expect(row!.current).toMatchObject({ setsDone: 1, setsPlanned: 3 })
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

describe('monitorFeed', () => {
  it('agrupa las series seguidas de un ejercicio y ordena de lo más nuevo a lo más viejo', () => {
    const r = routine('a', 'Juan')
    r.blocks[1]!.days[0]!.exercises[0]!.name = 'Press de banca'
    const events = monitorFeed({
      routines: [r],
      setLogs: [
        { routine_exercise_id: 'a-w1-d0-press', set_number: 1, weight_kg: 40, reps: 10, completed: true, updated_at: minsAgo(20) },
        { routine_exercise_id: 'a-w1-d0-press', set_number: 2, weight_kg: 40, reps: 10, completed: true, updated_at: minsAgo(16) },
        { routine_exercise_id: 'a-w1-d0-press', set_number: 3, weight_kg: 42.5, reps: 8, completed: true, updated_at: minsAgo(12) },
        { routine_exercise_id: 'a-w1-d0-remo', set_number: 1, weight_kg: null, reps: 12, completed: true, updated_at: minsAgo(3) },
        { routine_exercise_id: 'a-w1-d0-remo', set_number: 2, weight_kg: 30, reps: 12, completed: false, updated_at: minsAgo(1) },
      ] as never,
      dayLogs: [],
      now: NOW,
    })
    expect(events.map((e) => [e.title, e.detail])).toEqual([
      ['Ejercicio', '1 serie · 12 repeticiones'],
      ['Press de banca', '3 series · 42,5 kg × 8'],
    ])
  })

  it('suma los cierres del día y los avisos de «no entreno» de hoy', () => {
    const events = monitorFeed({
      routines: [routine('a', 'Sofía'), routine('b', 'Lucía')],
      setLogs: [],
      dayLogs: [
        { ...closed('a-w1-d0', 'done'), updated_at: minsAgo(30) },
        { ...closed('b-w1-d1', 'missed', 'Me quedé sin tiempo'), updated_at: minsAgo(5) },
        { routine_day_id: 'a-w1-d1', status: 'done', status_date: '2026-11-15', missed_reason: '', updated_at: '2026-11-15T20:00:00.000Z' },
      ],
      now: NOW,
    })
    expect(events.map((e) => [e.studentName, e.kind, e.title, e.detail])).toEqual([
      ['Lucía', 'missed', 'Día 2 · Pierna', 'Me quedé sin tiempo'],
      ['Sofía', 'done', 'Día 1 · Torso', 'Cerró el día'],
    ])
  })
})

describe('weekMatrix', () => {
  it('marca por día: entrenó, avisó que no, le toca hoy, lo debe y lo que falta', () => {
    // NOW es lunes 16; se mira el jueves 19 de esa semana.
    const thursday = new Date(2026, 10, 19, 18, 0, 0)
    const r = routine('a', 'Ana')
    for (const b of r.blocks) {
      b.days[0]!.day_of_week = 2 // martes
      b.days[1]!.day_of_week = 4 // jueves
    }
    const other = routine('b', 'Bruno')
    const rows = weekMatrix({
      routines: [r, other],
      setLogs: sets('b-w1-d0-press', 3, 40, new Date(2026, 10, 16, 19, 0, 0).toISOString()),
      dayLogs: [{ routine_day_id: 'b-w1-d1', status: 'missed', status_date: '2026-11-18', missed_reason: '' }],
      now: thursday,
    })
    expect(rows.map((x) => x.studentName)).toEqual(['Bruno', 'Ana'])
    expect(rows[0]!.cells).toEqual(['trained', 'none', 'missed', 'none', 'future', 'future', 'future'])
    expect(rows[1]!.cells).toEqual(['none', 'owed', 'none', 'due', 'future', 'future', 'future'])
  })
})

describe('pickMonitorRoutines', () => {
  const c = (id: string, student_id: string, status: string, start_date: string | null, student_status = 'activo') => ({ id, student_id, status, start_date, created_at: '2026-01-01T00:00:00Z', student_status })

  it('elige por alumno la misma rutina que muestra su link', () => {
    const ids = pickMonitorRoutines([
      // Ana: la activa le gana a una pausada más nueva.
      c('ana-activa', 'ana', 'activa', '2026-10-01'),
      c('ana-pausada', 'ana', 'pausada', '2026-11-01'),
      // Agustín: sin activa, el link avisa «rutina en pausa» y no deja anotar → no entra.
      c('agus-completada', 'agus', 'completada', '2026-11-10'),
      c('agus-pausada', 'agus', 'pausada', '2026-10-20'),
      // Sofía: solo completadas → no entra.
      c('sofi-completada', 'sofi', 'completada', '2026-11-01'),
      // Mía: activa aunque el alumno figure inactivo → entra, como antes.
      c('mia-activa', 'mia', 'activa', '2026-11-01', 'inactivo'),
    ])
    expect(ids.sort()).toEqual(['ana-activa', 'mia-activa'])
  })
})

describe('día marcado «no entrené» con series después', () => {
  it('si anotó series después de marcarlo, cuenta como entrenando', () => {
    const missed: MonitorDayLog = { routine_day_id: 'a-w1-d0', status: 'missed', status_date: TODAY, missed_reason: '', updated_at: minsAgo(30) }
    const [after] = run([routine('a', 'Agustín')], sets('a-w1-d0-press', 1, 40, minsAgo(2)), [missed])
    expect(after!.state).toBe('live')
    const [before] = run([routine('a', 'Agustín')], sets('a-w1-d0-press', 1, 40, minsAgo(40)), [missed])
    expect(before!.state).toBe('missed')
  })
})
