import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type Listener = () => void

let channel: RealtimeChannel | null = null
let activeUserId: string | null = null
const listeners = new Set<Listener>()

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener()
    } catch (e) {
      console.error('[notificationsRealtime]', e)
    }
  }
}

function teardown() {
  if (channel) {
    void supabase.removeChannel(channel)
    channel = null
  }
  activeUserId = null
}

function ensureChannel(userId: string) {
  if (channel && activeUserId === userId) return

  teardown()
  activeUserId = userId

  channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      () => notifyListeners(),
    )
    .subscribe()
}

/**
 * Una sola suscripción Realtime por usuario (Header, Sidebar, lista, etc.).
 * Devuelve función para desuscribirse.
 */
export function subscribeNotificationChanges(userId: string, listener: Listener): () => void {
  ensureChannel(userId)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) teardown()
  }
}

export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) {
    console.error('[fetchUnreadNotificationCount]', error.message)
    return 0
  }
  return count ?? 0
}
