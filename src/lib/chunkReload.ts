/**
 * Cuando una pantalla no puede bajar su código (se publicó una versión nueva y los archivos viejos ya
 * no existen, o se reinició el servidor de desarrollo), recargar la página lo resuelve. Se recarga
 * una sola vez cada 30 s para no entrar en un bucle si el problema es otro (sin conexión).
 */

const KEY = 'hh-chunk-reload-at'
const WINDOW_MS = 30_000

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading (CSS )?chunk [\w-]+ failed|ChunkLoadError/i

export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err ?? '')
  return CHUNK_ERROR.test(msg)
}

/** Recarga la página si no se recargó por esto en los últimos 30 s. Devuelve si recargó. */
export function reloadOnceForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0)
    if (Date.now() - last < WINDOW_MS) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}
