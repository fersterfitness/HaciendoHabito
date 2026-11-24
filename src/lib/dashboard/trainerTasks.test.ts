import { describe, expect, it } from 'vitest'
import { splitTrainerTasks, type TrainerTask } from './trainerTasks'

const t = (id: string, created_at: string, done_at: string | null = null): TrainerTask => ({ id, student_id: null, text: id, created_at, done_at })

describe('tareas del entrenador', () => {
  const now = new Date('2026-11-24T12:00:00Z')
  const list = [
    t('nueva', '2026-11-23T10:00:00Z'),
    t('vieja', '2026-11-01T10:00:00Z'),
    t('hecha-ayer', '2026-11-20T10:00:00Z', '2026-11-23T10:00:00Z'),
    t('hecha-hoy', '2026-11-20T10:00:00Z', '2026-11-24T09:00:00Z'),
    t('hecha-hace-un-mes', '2026-10-01T10:00:00Z', '2026-10-20T10:00:00Z'),
  ]
  it('pendientes de la más vieja a la más nueva', () => {
    expect(splitTrainerTasks(list, now).pending.map((x) => x.id)).toEqual(['vieja', 'nueva'])
  })
  it('las hechas de la última semana, la última primero; las anteriores no se muestran', () => {
    expect(splitTrainerTasks(list, now).done.map((x) => x.id)).toEqual(['hecha-hoy', 'hecha-ayer'])
  })
})
