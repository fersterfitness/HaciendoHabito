/** Evento para abrir la búsqueda global (⌘K / botón en header). */
export const GLOBAL_SEARCH_OPEN_EVENT = 'hh:open-global-search'

export function openGlobalSearch(): void {
  window.dispatchEvent(new CustomEvent(GLOBAL_SEARCH_OPEN_EVENT))
}
