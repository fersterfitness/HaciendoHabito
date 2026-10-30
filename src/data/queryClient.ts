import { QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Caché de datos del servidor. Las listas se muestran al instante desde la caché y se
 * revalidan en segundo plano (`staleTime: 0`), así nunca quedan desactualizadas.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Al cerrar sesión (o cambiar de usuario) se vacía la caché: en una compu compartida
// no tienen que quedar alumnos ni rutinas de otra cuenta.
let currentUserId: string | null = null
supabase.auth.onAuthStateChange((event, session) => {
  const nextUserId = session?.user?.id ?? null
  if (event === 'SIGNED_OUT' || (currentUserId && nextUserId !== currentUserId)) {
    queryClient.clear()
  }
  currentUserId = nextUserId
})
