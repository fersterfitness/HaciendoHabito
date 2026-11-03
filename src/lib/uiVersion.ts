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

/** v2: ícono de pestaña con la marca en negro liso (la v1 sigue con el naranja de `index.html`). */
const V2_FAVICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="113 188 374 380"><rect x="113" y="188" width="374" height="380" rx="84" fill="#171719"/>' +
      '<path d="M188 325 262 248V368H300L188 498Z M412 248V425L340 498V368H300Z" fill="#fff"/></svg>',
  )
if (IS_V2) {
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')) {
    link.type = 'image/svg+xml'
    link.href = V2_FAVICON
  }
}

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
