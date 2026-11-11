import { create } from 'zustand'
import type { MarketplaceDuration, MarketplaceRole } from '@/lib/marketplace'

/**
 * «Tu equipo»: los planes que el cliente va eligiendo en la web pública, uno por profesional.
 * Se guarda en este navegador para que no se pierda al recargar o volver otro día.
 */
export type TeamItem = {
  planId: string
  professionalId: string
  slug: string
  nombre: string
  rol: MarketplaceRole
  titulo: string
  precio: number
  duracion: MarketplaceDuration
}

const STORAGE_KEY = 'hh-marketplace-team'

function read(): TeamItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is TeamItem =>
        !!x && typeof x === 'object' && typeof (x as TeamItem).planId === 'string' && typeof (x as TeamItem).professionalId === 'string',
    )
  } catch {
    return []
  }
}

function write(items: TeamItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* sin almacenamiento: dura hasta recargar */
  }
}

type TeamState = {
  items: TeamItem[]
  /** Agrega el plan; si ya había uno de ese profesional, lo reemplaza. */
  add: (item: TeamItem) => void
  remove: (professionalId: string) => void
  clear: () => void
}

export const useMarketplaceTeam = create<TeamState>((set, get) => ({
  items: read(),
  add: (item) => {
    const items = [...get().items.filter((i) => i.professionalId !== item.professionalId), item]
    write(items)
    set({ items })
  },
  remove: (professionalId) => {
    const items = get().items.filter((i) => i.professionalId !== professionalId)
    write(items)
    set({ items })
  },
  clear: () => {
    write([])
    set({ items: [] })
  },
}))

export const teamTotal = (items: TeamItem[]) => items.reduce((sum, i) => sum + i.precio, 0)
