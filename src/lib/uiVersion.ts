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

function remember(v2: boolean) {
  try {
    if (v2) localStorage.setItem(STORAGE_KEY, 'v2')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* sin storage: la elección vale solo para esta pestaña */
  }
}

function prefersV2(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'v2'
  } catch {
    return false
  }
}

/**
 * Al arrancar: quien eligió la versión nueva entra siempre por `/v2` (también desde links viejos o
 * favoritos). Los formularios públicos que abren los alumnos quedan afuera. Devuelve true si redirige.
 */
export function applyPreferredUiVersion(): boolean {
  const { pathname, search, hash } = window.location
  if (pathIsV2(pathname)) {
    remember(true)
    return false
  }
  if (prefersV2() && !pathname.startsWith('/form')) {
    window.location.replace(`${V2_BASE}${pathname === '/' ? '/dashboard' : pathname}${search}${hash}`)
    return true
  }
  return false
}

export function enterV2() {
  remember(true)
  const { pathname, search } = window.location
  window.location.assign(`${V2_BASE}${pathname === '/' ? '/dashboard' : pathname}${search}`)
}

export function leaveV2() {
  remember(false)
  const { pathname, search } = window.location
  window.location.assign(`${pathname.replace(/^\/v2/, '') || '/dashboard'}${search}`)
}
