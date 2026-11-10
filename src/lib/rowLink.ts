import type { MouseEvent } from 'react'

/**
 * Link dentro de una fila clickeable. El clic común lo sigue manejando la fila (abre el panel o
 * navega); con Ctrl, ⌘ o Mayús, y con el botón del medio, el navegador abre el link en otra pestaña.
 * Así la fila tiene una URL real y se alcanza con Tab.
 */
export function rowLinkClick(e: MouseEvent) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) e.stopPropagation()
  else e.preventDefault()
}
