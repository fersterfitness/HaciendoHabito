import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/errorReporting', () => ({ reportError: vi.fn() }))

describe('ErrorBoundary', () => {
  it('muestra el aviso si la pantalla falla y «Reintentar» la vuelve a dibujar', async () => {
    const { ErrorBoundary } = await import('@/components/ui/ErrorBoundary')
    const { reportError } = await import('@/lib/errorReporting')
    let shouldFail = true
    function Screen() {
      if (shouldFail) throw new Error('falla de prueba')
      return createElement('p', null, 'pantalla ok')
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const el = document.createElement('div')
    const root = createRoot(el)
    await act(async () => root.render(createElement(ErrorBoundary, null, createElement(Screen))))
    expect(el.textContent).toContain('Algo falló en esta pantalla')
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: 'falla de prueba' }), 'render')

    shouldFail = false
    const retry = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Reintentar'))!
    await act(async () => retry.click())
    expect(el.textContent).toContain('pantalla ok')
    spy.mockRestore()
    await act(async () => root.unmount())
  })
})
