import { type RefObject, useEffect, useRef } from 'react'

/** Diálogos abiertos, el último arriba: Escape cierra solo el de más arriba. */
const stack: symbol[] = []

/**
 * Comportamiento común de una ventana encima de la página: Escape la cierra (solo la de más arriba
 * si hay varias apiladas), el scroll del fondo queda bloqueado, el foco entra al panel al abrir y
 * vuelve a donde estaba al cerrar.
 */
export function useDialogLayer(open: boolean, onClose: () => void, panelRef: RefObject<HTMLElement | null>) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const id = Symbol('dialog')
    stack.push(id)
    const prevFocus = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || stack[stack.length - 1] !== id) return
      e.stopPropagation()
      onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      const i = stack.indexOf(id)
      if (i >= 0) stack.splice(i, 1)
      document.body.style.overflow = prevOverflow
      prevFocus?.focus?.()
    }
  }, [open, panelRef])
}
