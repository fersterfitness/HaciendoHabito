import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { alertKeys, newMonitorAlerts } from './monitorAlerts'
import type { MonitorCurrent, MonitorRow } from './trainingMonitor'

const NOW = new Date(2026, 10, 16, 18, 0, 0)

const ex = (patch: Partial<MonitorCurrent>): MonitorCurrent => ({
  exerciseId: 'ex1',
  name: 'Sentadilla',
  setsDone: 1,
  setsPlanned: 3,
  weightKg: 60,
  reps: 8,
  plannedKg: 60,
  restSeconds: 90,
  effort: null,
  note: '',
  ...patch,
})

const row = (patch: Partial<MonitorRow>): MonitorRow => ({
  routineId: 'r1',
  studentId: 's1',
  studentName: 'Briana Cardozo',
  avatarPath: null,
  state: 'idle',
  dayLabel: 'Día 2 · Piernas',
  detail: '',
  pct: null,
  lastAt: null,
  ...patch,
})

const kinds = (prev: MonitorRow[], next: MonitorRow[]) => newMonitorAlerts(next, alertKeys(prev, NOW), NOW).map((a) => a.kind)

describe('newMonitorAlerts', () => {
  it('la primera lectura sirve de punto de partida: lo que ya estaba no se avisa', () => {
    const live = row({ state: 'live', startedAt: '2026-11-16T20:00:00.000Z', exercises: [ex({})] })
    expect(kinds([live], [live])).toEqual([])
  })

  it('avisa cuando alguien empieza a entrenar', () => {
    const live = row({ state: 'live', startedAt: '2026-11-16T20:00:00.000Z', exercises: [ex({})] })
    const alerts = newMonitorAlerts([live], alertKeys([row({})], NOW), NOW)
    expect(alerts).toMatchObject([{ kind: 'started', title: 'Briana empezó a entrenar', important: false }])
  })

  it('una serie nueva por debajo de lo planificado avisa una vez por serie', () => {
    const before = row({ state: 'live', startedAt: 'x', exercises: [ex({ setsDone: 1 })] })
    const after = row({ state: 'live', startedAt: 'x', exercises: [ex({ setsDone: 2, weightKg: 50 })] })
    const [a] = newMonitorAlerts([after], alertKeys([before], NOW), NOW)
    expect(a).toMatchObject({ kind: 'below', important: true, detail: 'Sentadilla: 50 kg × 8 (planificado 60 kg)' })
    expect(kinds([after], [after])).toEqual([])
  })

  it('Borg alto, chequeo con molestias, día terminado y falta; lo importante primero', () => {
    const before = row({ state: 'live', startedAt: 'x', exercises: [ex({})] })
    const after = [
      row({ state: 'done', closed: true, pct: 100, dayEffort: 8, startedAt: 'x', exercises: [ex({ effort: 9, note: 'me dolió' })] }),
      row({ routineId: 'r2', studentName: 'Juliana Caivano', state: 'missed', detail: 'Viaje' }),
      row({ routineId: 'r3', studentName: 'Lucio Casanave', state: 'live', startedAt: 'y', checkin: { sleep: 2, energy: 4, stress: 2, soreness: 4, note: '' } }),
    ]
    const alerts = newMonitorAlerts(after, alertKeys([before], NOW), NOW)
    expect(alerts.map((a) => a.kind).sort()).toEqual(['checkin', 'effort', 'finished', 'missed', 'started'])
    expect(alerts.find((a) => a.kind === 'checkin')!.title).toBe('Lucio llegó con sueño 2/5, molestias 4/5')
    expect(alerts.find((a) => a.kind === 'finished')!.detail).toBe('Día 2 · Piernas · 100 % · esfuerzo 8/10')
    // Los importantes van antes que «empezó» y «terminó» sin desvíos.
    expect(alerts.slice(-2).map((a) => a.kind).sort()).toEqual(['finished', 'started'])
  })

  it('al día siguiente el mismo hecho vuelve a avisar', () => {
    const live = row({ state: 'live', startedAt: 'x' })
    const tomorrow = new Date(2026, 10, 17, 9, 0, 0)
    expect(newMonitorAlerts([live], alertKeys([live], NOW), tomorrow).map((a) => a.kind)).toEqual(['started'])
  })
})
