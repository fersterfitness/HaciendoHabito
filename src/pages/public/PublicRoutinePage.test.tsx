import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PublicRoutinePage } from './PublicRoutinePage'
import { fetchSharedRoutine, saveSharedSet, type SharedRoutine, type SharedSetLog } from '@/lib/routine/sharedRoutine'

vi.mock('@/lib/routine/sharedRoutine', async (original) => ({
  ...await original<typeof import('@/lib/routine/sharedRoutine')>(),
  fetchSharedRoutine: vi.fn(), saveSharedSet: vi.fn(),
}))

const routine = (logs: SharedSetLog[] = [], name = 'Plancha', reps_scheme = '20 s'): SharedRoutine => ({
  student_first_name: 'Alumno', student_gender: 'M', professional_name: null, professional_phone: null, feedback: null,
  routine: { name: 'Entrenamiento', objective: null, start_date: null, end_date: null, updated_at: null,
    blocks: [{ id: 'block', name: 'Semana 1', start_date: null, end_date: null,
      days: [{ id: 'day', day_name: 'Día A', muscle_focus: null, warmup_notes: null,
        exercises: [{ id: 'ex', name, sets: 2, reps_min: null, reps_max: null, reps_scheme,
          weight_kg: null, rir: null, rpe: null, rest_seconds: null, tempo: null, percent_rm: null,
          technical_notes: null, is_superset: false, superset_group: null, video_url: null, image_url: null, logs }],
      }],
    }],
  },
})

describe('public routine completion controls', () => {
  let host: HTMLDivElement
  let root: Root
  let fontStub: HTMLLinkElement
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    vi.clearAllMocks()
    vi.mocked(saveSharedSet).mockResolvedValue(undefined)
    // Prevent external font requests during isolated component tests.
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
  async function open(logs: SharedSetLog[] = [], name?: string, scheme?: string) {
    vi.mocked(fetchSharedRoutine).mockResolvedValue(routine(logs, name, scheme))
    await act(async () => root.render(<MemoryRouter initialEntries={['/rutina/test-token']}><Routes><Route path="/rutina/:token" element={<PublicRoutinePage />} /></Routes></MemoryRouter>))
    await act(async () => (host.querySelector('.hhr-ex-head') as HTMLButtonElement).click())
  }
  const check = () => host.querySelector('.hhr-setcheck') as HTMLButtonElement

  it('completes and reloads a bodyweight set without inventing kg', async () => {
    await open()
    await act(async () => check().click())
    expect(saveSharedSet).toHaveBeenCalledWith('test-token', 'ex', 1, null, true, null)
    expect(check().getAttribute('aria-pressed')).toBe('true')
    expect(host.querySelector('.hhr-ex .hhr-progress-label')?.textContent).toBe('1/2 series')
    expect((host.querySelector('.hhr-kgfield input') as HTMLInputElement).value).toBe('')
    await act(async () => (host.querySelector('.hhr-ex-head') as HTMLButtonElement).click())
    await act(async () => (host.querySelector('.hhr-ex-head') as HTMLButtonElement).click())
    expect(check().getAttribute('aria-pressed')).toBe('true')
  })
  it('does not ask for reps on a timed exercise', async () => {
    await open()
    expect(host.querySelector('.hhr-repsfield input')).toBeNull()
  })
  it('saves reps with the check and restores them from the server', async () => {
    await open([], 'Sentadilla', '8-10')
    const reps = host.querySelector('.hhr-repsfield input') as HTMLInputElement
    expect(reps.placeholder).toBe('8')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    await act(async () => {
      setter.call(reps, '9')
      reps.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => check().click())
    expect(saveSharedSet).toHaveBeenLastCalledWith('test-token', 'ex', 1, null, true, 9)
    await act(async () => root.unmount())
    root = createRoot(host)
    await open([{ set: 1, weight_kg: 60, reps: 8, completed: true }], 'Sentadilla', '8-10')
    expect((host.querySelector('.hhr-repsfield input') as HTMLInputElement).value).toBe('8')
  })
  it('restores completion with no weight from the server', async () => {
    await open([{ set: 1, weight_kg: null, reps: null, completed: true }])
    expect(check().getAttribute('aria-pressed')).toBe('true')
    expect(host.querySelector('.hhr-ex .hhr-progress-label')?.textContent).toBe('1/2 series')
  })
  it('unchecks without deleting weight', async () => {
    await open([{ set: 1, weight_kg: 25, reps: null, completed: true }])
    await act(async () => check().click())
    expect(saveSharedSet).toHaveBeenCalledWith('test-token', 'ex', 1, 25, false, null)
    expect(check().getAttribute('aria-pressed')).toBe('false')
    expect((host.querySelector('.hhr-kgfield input') as HTMLInputElement).value).toBe('25')
  })
  it('does not show saved completion when the server rejects it and allows retry', async () => {
    vi.mocked(saveSharedSet).mockRejectedValueOnce(new Error('Sin conexión'))
    await open()
    await act(async () => check().click())
    expect(check().getAttribute('aria-pressed')).toBe('false')
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Sin conexión')
    await act(async () => (host.querySelector('.hhr-row-error button') as HTMLButtonElement).click())
    expect(check().getAttribute('aria-pressed')).toBe('true')
  })
})
