import { describe, expect, it, vi } from 'vitest'
import { createElement as h, Fragment, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { useDialogLayer } from './dialogLayer'

function Layer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useDialogLayer(open, onClose, ref)
  return h('div', { ref, tabIndex: -1 })
}

describe('useDialogLayer', () => {
  it('Escape cierra solo la de arriba y el scroll vuelve al cerrar todas', () => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const closeBottom = vi.fn()
    const closeTop = vi.fn()
    const render = (top: boolean) =>
      act(() => {
        root.render(h(Fragment, null, h(Layer, { open: true, onClose: closeBottom }), h(Layer, { open: top, onClose: closeTop })))
      })
    render(true)
    expect(document.body.style.overflow).toBe('hidden')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(closeTop).toHaveBeenCalledTimes(1)
    expect(closeBottom).not.toHaveBeenCalled()
    render(false)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(closeBottom).toHaveBeenCalledTimes(1)
    act(() => root.unmount())
    expect(document.body.style.overflow).toBe('')
  })
})
