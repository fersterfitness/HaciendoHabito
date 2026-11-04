/**
 * Versión nueva de la interfaz bajo `/v2`. Es la misma app con otro diseño: el router usa `/v2`
 * como base, así que todos los links internos se quedan dentro de la versión que se eligió.
 * Cambiar de versión recarga la página (se decide una vez, al arrancar).
 */

const STORAGE_KEY = 'hh-ui-version'
export const V2_BASE = '/v2'

function pathIsV2(pathname: string): boolean {
  return pathname === V2_BASE || pathname.startsWith(`${V2_BASE}/`)
}

/** Esta carga de la página es de la versión nueva. */
export const IS_V2 = typeof window !== 'undefined' && pathIsV2(window.location.pathname)

// El tema de la v2 (colores, esquinas, botones) cuelga de esta clase en <html>; ver index.css.
if (IS_V2) document.documentElement.classList.add('ui-v2')

export function routerBasename(): string | undefined {
  return IS_V2 ? V2_BASE : undefined
}

/**
 * La dirección decide la versión: con `/v2` se ve la nueva y sin `/v2` la actual. No se recuerda
 * la elección entre visitas (antes se guardaba y redirigía sola a `/v2`, y la versión actual
 * quedaba inaccesible). Se borra la preferencia vieja que haya quedado guardada.
 * Devuelve true si redirige (hoy nunca).
 */
export function applyPreferredUiVersion(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* sin storage: nada que limpiar */
  }
  return false
}

export function enterV2() {
  const { pathname, search } = window.location
  window.location.assign(`${V2_BASE}${pathname === '/' ? '/dashboard' : pathname}${search}`)
}

export function leaveV2() {
  const { pathname, search } = window.location
  window.location.assign(`${pathname.replace(/^\/v2/, '') || '/dashboard'}${search}`)
}
