import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { format, subDays } from 'date-fns'
import type { User } from '@supabase/supabase-js'
import { EMPTY_DAY_LOG } from '@/lib/routine/studentTrainingLog'
import { loadStudentAppProgress } from '@/lib/checkIn/studentAppProgress'
import { useAuthStore } from '@/stores/authStore'
import { StudentAppProgressPanel } from './StudentAppProgressPanel'

vi.mock('@/lib/checkIn/studentAppProgress', async (original) => ({
  ...(await original<typeof import('@/lib/checkIn/studentAppProgress')>()),
  loadStudentAppProgress: vi.fn(),
}))

describe('Progreso de la ficha (respuestas de la app)', () => {
  let host: HTMLDivElement
  let root: Root
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    useAuthStore.setState({ user: { id: 'owner' } as User })
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    host.remove()
  })

  it('muestra los totales del período y las aclaraciones del alumno', async () => {
    const d = (n: number) => format(subDays(new Date(), n), 'yyyy-MM-dd')
    vi.mocked(loadStudentAppProgress).mockResolvedValue({
      days: [
        { date: d(2), routineName: 'R', log: { ...EMPTY_DAY_LOG, status: 'done', effort: 8, energy: 4 } },
        { date: d(1), routineName: 'R', log: { ...EMPTY_DAY_LOG, status: 'missed', missed_reason: 'Viaje' } },
      ],
      notes: [{ date: d(1), kind: 'missed', title: 'No entrenó', text: 'Viaje' }],
    })
    await act(async () => root.render(<StudentAppProgressPanel studentId="s1" />))
    expect(loadStudentAppProgress).toHaveBeenCalledWith('owner', 's1')
    const text = host.textContent ?? ''
    expect(text).toContain('Días entrenados1')
    expect(text).toContain('Días sin entrenar1')
    expect(text).toContain('8/10')
    expect(text).toContain('Viaje')
  })

  it('sin respuestas avisa que todavía no respondió nada', async () => {
    vi.mocked(loadStudentAppProgress).mockResolvedValue({ days: [], notes: [] })
    await act(async () => root.render(<StudentAppProgressPanel studentId="s1" />))
    expect(host.textContent).toContain('Todavía no respondió nada en su link')
  })
})
