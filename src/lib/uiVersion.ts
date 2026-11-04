/**
 * Versión de la interfaz (actual o nueva). Se elige en Configuración → Apariencia y queda guardada
 * en este navegador y en la cuenta (así se mantiene en otros dispositivos). La dirección ya no
 * decide nada: es la misma app con otro diseño, y cambiar recarga la página (se decide una vez,
 * al arrancar).
 */

export type UiVersion = 'v1' | 'v2'

const STORAGE_KEY = 'hh-ui'
/** Clave vieja (cuando `/v2` en la dirección decidía): se borra. */
const LEGACY_KEY = 'hh-ui-version'
const LEGACY_BASE = '/v2'

function readStored(): UiVersion {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'v2' ? 'v2' : 'v1'
  } catch {
    return 'v1'
  }
}

function store(v: UiVersion) {
  try {
    localStorage.setItem(STORAGE_KEY, v)
  } catch {
    /* sin storage: dura hasta recargar */
  }
}

/**
 * Links viejos con `/v2` (favoritos, mensajes): eligen la versión nueva y se limpia la dirección
 * antes de que arranque el router.
 */
function migrateLegacyUrl(): UiVersion | null {
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* nada */
  }
  const { pathname, search, hash } = window.location
  if (pathname !== LEGACY_BASE && !pathname.startsWith(`${LEGACY_BASE}/`)) return null
  store('v2')
  window.history.replaceState(window.history.state, '', `${pathname.slice(LEGACY_BASE.length) || '/'}${search}${hash}`)
  return 'v2'
}

export const UI_VERSION: UiVersion = typeof window === 'undefined' ? 'v1' : (migrateLegacyUrl() ?? readStored())

/** Esta carga de la página es de la versión nueva. */
export const IS_V2 = UI_VERSION === 'v2'

// El tema de la v2 (colores, esquinas, botones) cuelga de esta clase en <html>; ver index.css.
if (IS_V2) document.documentElement.classList.add('ui-v2')

let saveToAccount: ((v: UiVersion) => Promise<unknown>) | null = null
/** La app registra cómo guardar la elección en la cuenta (así este módulo no depende de Supabase). */
export function registerUiVersionSaver(fn: (v: UiVersion) => Promise<unknown>) {
  saveToAccount = fn
}

/** Cambia de versión y recarga en la misma pantalla. */
export async function setUiVersion(v: UiVersion) {
  store(v)
  try {
    await saveToAccount?.(v)
  } catch {
    /* sin red: queda en este navegador */
  }
  window.location.reload()
}

/**
 * Al iniciar sesión: si la cuenta tiene otra versión elegida (desde otro dispositivo), se aplica.
 * Devuelve true si va a recargar.
 */
export function syncUiVersionFromAccount(accountValue: unknown): boolean {
  if (accountValue !== 'v1' && accountValue !== 'v2') return false
  if (accountValue === UI_VERSION) return false
  store(accountValue)
  // Sin storage no se puede aplicar: recargar daría vueltas para siempre.
  if (readStored() !== accountValue) return false
  window.location.reload()
  return true
}

export const enterV2 = () => void setUiVersion('v2')
export const leaveV2 = () => void setUiVersion('v1')
