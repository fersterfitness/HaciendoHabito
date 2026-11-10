import type { KeyboardEvent } from 'react'

/**
 * Teclado de una lista de pestañas (`role="tablist"`): ← → recorren las pestañas y las activan,
 * Inicio y Fin van a la primera y a la última. Va en el `onKeyDown` del contenedor; las pestañas
 * llevan `tabIndex` 0 la elegida y -1 el resto (ver `tabIndexFor`), así Tab entra y sale de la lista
 * de un solo paso.
 */
export function onTabListKeyDown(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return
  const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'))
  const i = tabs.indexOf(document.activeElement as HTMLElement)
  if (i < 0 || tabs.length < 2) return
  e.preventDefault()
  const next =
    e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
  tabs[next].focus()
  tabs[next].click()
}

/** `tabIndex` de una pestaña: solo la elegida entra con Tab (si ninguna lo está, la primera). */
export function tabIndexFor(selected: boolean, index: number, anySelected = true) {
  return selected || (!anySelected && index === 0) ? 0 : -1
}
