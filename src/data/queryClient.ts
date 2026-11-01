import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { supabase } from '@/lib/supabase'
import { AUTH_STORAGE_KEY, QUERY_CACHE_STORAGE_KEY } from '@/lib/authSession'

/** Cuánto vale una copia guardada en el navegador antes de descartarla. */
const PERSIST_MAX_AGE_MS = 24 * 60 * 60_000

/**
 * Caché de datos del servidor. Las listas se muestran al instante desde la caché y se
 * revalidan en segundo plano (`staleTime: 0`), así nunca quedan desactualizadas.
 * `gcTime` igual a la vida de la copia guardada: si fuera menor, lo restaurado se tiraría enseguida.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: PERSIST_MAX_AGE_MS,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

/**
 * La caché se guarda en el navegador: al refrescar, las listas aparecen al instante con lo último
 * que se vio y se actualizan por detrás. Se borra al cerrar sesión.
 */
export const queryPersister = createSyncStoragePersister({
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  key: QUERY_CACHE_STORAGE_KEY,
  throttleTime: 1000,
})

function storedUserId(): string {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    return raw ? ((JSON.parse(raw) as { user?: { id?: string } }).user?.id ?? '') : ''
  } catch {
    return ''
  }
}

export const queryPersistOptions = {
  persister: queryPersister,
  maxAge: PERSIST_MAX_AGE_MS,
  // Atada al usuario de la sesión guardada: la copia de otra cuenta nunca se restaura.
  buster: `v1:${storedUserId()}`,
}

// Al cerrar sesión (o cambiar de usuario) se vacía la caché: en una compu compartida
// no tienen que quedar alumnos ni rutinas de otra cuenta.
let currentUserId: string | null = null
supabase.auth.onAuthStateChange((event, session) => {
  const nextUserId = session?.user?.id ?? null
  if (event === 'SIGNED_OUT' || (currentUserId && nextUserId !== currentUserId)) {
    queryClient.clear()
    void queryPersister.removeClient()
  }
  currentUserId = nextUserId
})
