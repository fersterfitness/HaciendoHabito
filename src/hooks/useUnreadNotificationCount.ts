import { useEffect, useState } from 'react'
import {
  fetchUnreadNotificationCount,
  subscribeNotificationChanges,
} from '@/lib/notificationsRealtime'
import { useAuthStore } from '@/stores/authStore'

/** Cantidad de notificaciones sin leer (comparte un único canal Realtime por usuario). */
export function useUnreadNotificationCount(): number {
  const { user } = useAuthStore()
  const [count, setCount] = useState(0)

  useEffect(() => {
    const userId = user?.id
    if (!userId) {
      setCount(0)
      return
    }

    let cancelled = false

    async function refresh() {
      const unread = await fetchUnreadNotificationCount(userId)
      if (!cancelled) setCount(unread)
    }

    void refresh()
    const unsubscribe = subscribeNotificationChanges(userId, () => { void refresh() })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [user?.id])

  return count
}
