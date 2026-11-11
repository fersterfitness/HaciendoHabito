import { create } from 'zustand'

/** Contador que el menú muestra al lado de un ítem (clave: el `href` del ítem). */
export type NavCount = { n: number; tone?: 'accent' | 'alert' }

const KEY = 'hh-v2-nav-counts'
const today = () => new Date().toISOString().slice(0, 10)

function read(): Record<string, NavCount> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { day?: string; counts?: Record<string, NavCount> } | null
    return raw?.day === today() && raw.counts ? raw.counts : {}
  } catch {
    return {}
  }
}

/**
 * Números del día para el menú (pendientes, feedback sin responder, cobros vencidos). Los calcula el
 * Inicio, que ya tiene esos datos; se guardan por el día para que sigan a la vista en otras pantallas.
 */
export const useNavCounts = create<{ counts: Record<string, NavCount>; setCounts: (next: Record<string, NavCount>) => void }>((set, get) => ({
  counts: read(),
  setCounts: (next) => {
    const cur = get().counts
    const same = Object.keys({ ...cur, ...next }).every((k) => cur[k]?.n === next[k]?.n && cur[k]?.tone === next[k]?.tone)
    if (same) return
    set({ counts: next })
    try {
      localStorage.setItem(KEY, JSON.stringify({ day: today(), counts: next }))
    } catch {
      /* sin almacenamiento: queda en memoria */
    }
  },
}))
