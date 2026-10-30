import { act, createElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Student } from '@/types/database'

const fetchStudentList = vi.fn()

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } } }))
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 'u1' } }) }))
vi.mock('@/data/students', async () => {
  const { queryClient } = await import('@/data/queryClient')
  return {
    studentKeys: { all: ['students'], list: (u: string) => ['students', 'list', u] },
    fetchStudentList: () => fetchStudentList(),
    insertStudent: vi.fn(),
    patchStudent: vi.fn(),
    removeStudent: vi.fn(),
    invalidateStudents: () => queryClient.invalidateQueries({ queryKey: ['students'] }),
  }
})

const student = (id: string, full_name: string) => ({ id, full_name, email: null, phone: null, status: 'activo' }) as unknown as Student

async function renderHook<T>(hook: () => T, client: QueryClient) {
  const result = { current: undefined as T }
  function Probe() {
    result.current = hook()
    return null
  }
  const el = document.createElement('div')
  const root = createRoot(el)
  const wrap = (children: ReactNode) => createElement(QueryClientProvider, { client }, children)
  await act(async () => root.render(wrap(createElement(Probe))))
  return { result, unmount: () => act(() => root.unmount()) }
}

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

describe('useStudents', () => {
  beforeEach(() => {
    fetchStudentList.mockReset()
    fetchStudentList.mockResolvedValue([student('1', 'Ana Pérez'), student('2', 'Bruno Díaz')])
  })

  it('carga recién al pedirla, filtra sin volver a consultar y comparte la caché', { timeout: 30_000 }, async () => {
    const { queryClient } = await import('@/data/queryClient')
    queryClient.clear()
    const { useStudents } = await import('@/hooks/useStudents')

    const a = await renderHook(() => useStudents(), queryClient)
    await flush()
    expect(fetchStudentList).not.toHaveBeenCalled()

    await act(async () => { await a.result.current.fetchStudents() })
    await flush()
    expect(fetchStudentList).toHaveBeenCalledTimes(1)
    expect(a.result.current.students.map((s) => s.id)).toEqual(['1', '2'])

    await act(async () => { a.result.current.filterStudents('bruno') })
    expect(a.result.current.students.map((s) => s.id)).toEqual(['2'])
    expect(fetchStudentList).toHaveBeenCalledTimes(1)

    // Otra pantalla: ve los datos en caché al instante (y revalida en segundo plano).
    const b = await renderHook(() => useStudents(), queryClient)
    await act(async () => { await b.result.current.fetchStudents() })
    expect(b.result.current.students).toHaveLength(2)
    expect(b.result.current.loading).toBe(false)

    await a.unmount()
    await b.unmount()
  })
})
