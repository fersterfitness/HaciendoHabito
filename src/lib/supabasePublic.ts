import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

/**
 * Cliente sin sesión de usuario. Los formularios públicos tienen que ir como `anon`;
 * si se reutiliza el cliente logueado, un JWT de entrenador/alumno puede devolver 401
 * o abortar el envío al crear la notificación del check-in.
 */
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
  },
  global: {
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  },
})

// ───────────── Vista previa del entrenador (feedback nov3) ─────────────
// En /rutina/:token?vista=entrenador, abierto por el dueño del link, nada se manda a la base: las RPC que no
// son de lectura (`get_*`) responden «ok» sin salir del navegador. Así puede grabar el video explicativo sin
// completar el chequeo del alumno ni tocar sus datos.
let previewMode = false

export function setPublicPreview(on: boolean): void {
  previewMode = on
}

export const isPublicPreview = (): boolean => previewMode

const realRpc = supabasePublic.rpc.bind(supabasePublic)
supabasePublic.rpc = ((fn: string, args?: Record<string, unknown>, options?: Record<string, unknown>) => {
  if (previewMode && !fn.startsWith('get_')) {
    return Promise.resolve({ data: { ok: true }, error: null, count: null, status: 200, statusText: 'OK' })
  }
  return realRpc(fn as never, args as never, options as never)
}) as unknown as typeof supabasePublic.rpc
