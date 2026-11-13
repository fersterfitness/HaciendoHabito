import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PublicRoutinePage } from './PublicRoutinePage'
import { fetchSharedRoutine, type SharedRoutine } from '@/lib/routine/sharedRoutine'
import {
  EMPTY_DAY_LOG,
  fetchSharedExtras,
  saveSharedDayCheckin,
  saveSharedDayStatus,
  saveSharedExerciseFeedback,
  type TrainingExtras,
} from '@/lib/routine/studentTrainingLog'

vi.mock('@/lib/routine/sharedRoutine', async (original) => ({
  ...(await original<typeof import('@/lib/routine/sharedRoutine')>()),
  fetchSharedRoutine: vi.fn(),
  saveSharedSet: vi.fn(),
}))
vi.mock('@/lib/routine/studentTrainingLog', async (original) => ({
  ...(await original<typeof import('@/lib/routine/studentTrainingLog')>()),
  fetchSharedExtras: vi.fn(),
  saveSharedDayCheckin: vi.fn(),
  saveSharedDayStatus: vi.fn(),
  saveSharedExerciseFeedback: vi.fn(),
  sendSharedUrgentMessage: vi.fn(),
}))

const routine: SharedRoutine = {
  student_first_name: 'Alumno',
  student_gender: 'M',
  professional_name: 'Tomás Coach',
  professional_phone: null,
  feedback: null,
  routine: {
    name: 'Entrenamiento',
    objective: null,
    start_date: null,
    end_date: null,
    updated_at: null,
    blocks: [
      {
        id: 'block',
        name: 'Semana 1',
        start_date: null,
        end_date: null,
        days: [
          {
            id: 'day',
            day_name: 'Día A',
            muscle_focus: null,
            warmup_notes: null,
            exercises: [
              {
                id: 'ex', name: 'Sentadilla', sets: 2, reps_min: 8, reps_max: 8, reps_scheme: null, weight_kg: null, rir: null, rpe: null,
                rest_seconds: null, tempo: null, percent_rm: null, technical_notes: null, is_superset: false, superset_group: null,
                video_url: null, image_url: null, logs: [],
              },
            ],
          },
        ],
      },
    ],
  },
}

describe('registro del alumno en la rutina por link', () => {
  let host: HTMLDivElement
  let root: Root
  let fontStub: HTMLLinkElement

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    vi.clearAllMocks()
    vi.mocked(fetchSharedRoutine).mockResolvedValue(routine)
    vi.mocked(saveSharedDayCheckin).mockResolvedValue(undefined)
    vi.mocked(saveSharedDayStatus).mockResolvedValue(undefined)
    vi.mocked(saveSharedExerciseFeedback).mockResolvedValue(undefined)
    fontStub = document.createElement('link')
    fontStub.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
    document.head.append(fontStub)
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    host.remove()
    fontStub.remove()
  })

  async function open(extras: TrainingExtras | null) {
    vi.mocked(fetchSharedExtras).mockResolvedValue(extras)
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={['/rutina/test-token']}>
          <Routes>
            <Route path="/rutina/:token" element={<PublicRoutinePage />} />
          </Routes>
        </MemoryRouter>,
      ),
    )
  }
  const button = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement | undefined
  const click = (el: Element | undefined | null) => act(async () => (el as HTMLElement).click())

  it('sin la migración la página queda como antes: sin chequeo, cierre ni consulta urgente', async () => {
    await open(null)
    expect(host.querySelector('.hhr-ex-head')).not.toBeNull()
    expect(host.querySelector('.hhr-checkin')).toBeNull()
    expect(button('Terminé este entrenamiento')).toBeUndefined()
    expect(button('Consulta urgente')).toBeUndefined()
  })

  it('pide el chequeo antes de mostrar los ejercicios y lo guarda', async () => {
    await open({ exercises: {}, days: {} })
    expect(host.querySelector('.hhr-checkin')).not.toBeNull()
    expect(host.querySelector('.hhr-ex-head')).toBeNull()
    expect(button('Comenzar entreno')!.disabled).toBe(true)

    // Un valor en cada una de las cuatro escalas (4, 3, 2, 1).
    const scales = [...host.querySelectorAll('.hhr-checkin .hhr-scale')]
    for (const [i, s] of scales.entries()) await click(s.querySelectorAll('button')[3 - i])
    await click(button('Comenzar entreno'))

    expect(saveSharedDayCheckin).toHaveBeenCalledWith('test-token', 'day', { sleep: 4, energy: 3, stress: 2, soreness: 1, checkin_note: '' })
    expect(host.querySelector('.hhr-checkin')).toBeNull()
    expect(host.querySelector('.hhr-ex-head')).not.toBeNull()
    expect(host.querySelector('.hhr-checkin-line')?.textContent).toContain('Sueño 4/5')
  })

  it('«Responder después» deja entrenar sin el chequeo', async () => {
    await open({ exercises: {}, days: {} })
    await click(button('Responder después'))
    expect(host.querySelector('.hhr-ex-head')).not.toBeNull()
    expect(saveSharedDayCheckin).not.toHaveBeenCalled()
  })

  it('cierra el día como terminado con el esfuerzo de la sesión', async () => {
    await open({ exercises: {}, days: { day: { ...EMPTY_DAY_LOG, sleep: 4, checkin_at: '2026-11-13T10:00:00Z' } } })
    await click(button('Terminé este entrenamiento'))
    expect(button('Guardar y terminar')!.disabled).toBe(true)
    await click(host.querySelectorAll('.hhr-close-form .hhr-scale button')[6])
    await click(button('Guardar y terminar'))
    expect(saveSharedDayStatus).toHaveBeenCalledWith('test-token', 'day', expect.objectContaining({ status: 'done', effort: 7 }))
    expect(host.querySelector('.hhr-close.is-done')?.textContent).toContain('Entrenamiento terminado')
  })

  it('marca un día como no entrenado con el motivo', async () => {
    await open({ exercises: {}, days: { day: { ...EMPTY_DAY_LOG, sleep: 4, checkin_at: '2026-11-13T10:00:00Z' } } })
    await click(button('No pude entrenar este día'))
    await click(button('Marcar como no entrenado'))
    expect(saveSharedDayStatus).toHaveBeenCalledWith('test-token', 'day', expect.objectContaining({ status: 'missed' }))
    expect(host.querySelector('.hhr-close.is-missed')).not.toBeNull()
  })

  it('guarda el esfuerzo de un ejercicio y muestra la nota que ya había dejado', async () => {
    await open({ exercises: { ex: { note: 'Me molestó la rodilla', effort: null } }, days: { day: { ...EMPTY_DAY_LOG, sleep: 4, checkin_at: '2026-11-13T10:00:00Z' } } })
    await click(host.querySelector('.hhr-ex-head'))
    expect((host.querySelector('.hhr-exfb textarea') as HTMLTextAreaElement).value).toBe('Me molestó la rodilla')
    await click(host.querySelectorAll('.hhr-exfb .hhr-scale button')[7])
    expect(saveSharedExerciseFeedback).toHaveBeenCalledWith('test-token', 'ex', { note: 'Me molestó la rodilla', effort: 8 })
  })
})
