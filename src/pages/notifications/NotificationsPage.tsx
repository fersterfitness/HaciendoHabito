import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { notificationHref } from '@/lib/notifications'
import { subscribeNotificationChanges } from '@/lib/notificationsRealtime'
import { NOTIFICATION_TYPE_LABELS } from '@/lib/notificationLabels'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { cn, formatDate } from '@/lib/utils'
import type { Notification } from '@/types/database'
import toast from 'react-hot-toast'

const HISTORY_LIMIT = 100

export function NotificationsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const loadNotifications = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT)
    if (!error) setNotifications(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (!user) return
    setLoading(true)
    void loadNotifications()
    return subscribeNotificationChanges(user.id, () => { void loadNotifications() })
  }, [user, loadNotifications])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  async function markAllRead() {
    if (!user) return
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_read', false)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    toast.success('Todas marcadas como leídas')
  }

  async function markRead(id: string) {
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
  }

  async function openNotification(n: Notification) {
    if (!n.is_read) await markRead(n.id)
    const href = notificationHref(n)
    if (href) navigate(href)
  }

  return (
    <div>
      <Header
        title="Notificaciones"
        actions={
          notifications.some((n) => !n.is_read) ? (
            <Button variant="ghost" size="sm" icon={<Check className="h-4 w-4" />} onClick={() => void markAllRead()}>
              Marcar todas
            </Button>
          ) : undefined
        }
      />

      <div className="px-4 lg:px-6 py-6">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-8 w-8" />}
            title="Sin notificaciones"
            description="Cuando llegue un formulario o un pago, lo vas a ver acá."
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 border-b border-surface-border/70 px-4 py-3 bg-surface-elevated/20">
              <p className="text-sm text-ink-secondary">
                <span className="font-medium text-ink-primary">{notifications.length}</span>
                {' '}en el historial
                {unreadCount > 0 && (
                  <>
                    {' · '}
                    <span className="font-medium text-brand-primary">{unreadCount}</span>
                    {' '}sin leer
                  </>
                )}
              </p>
              <p className="text-xs text-ink-muted shrink-0">Más recientes primero</p>
            </div>

            <ul className="divide-y divide-surface-border/70" role="list">
              {notifications.map((n) => {
                const href = notificationHref(n)
                const typeLabel = NOTIFICATION_TYPE_LABELS[n.type as keyof typeof NOTIFICATION_TYPE_LABELS] ?? n.type

                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => void openNotification(n)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors',
                        'hover:bg-surface-elevated/45 focus-visible:bg-surface-elevated/45 outline-none',
                        n.is_read ? 'opacity-75' : 'bg-brand-primary/[0.03]',
                      )}
                    >
                      <span className="flex w-2 shrink-0 justify-center" aria-hidden>
                        {!n.is_read ? (
                          <span className="size-2 rounded-full bg-brand-primary" title="Sin leer" />
                        ) : (
                          <span className="size-2 rounded-full bg-transparent" />
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                          {typeLabel}
                        </span>
                        <span className="mt-0.5 block text-sm font-semibold text-ink-primary leading-snug">
                          {n.title}
                        </span>
                        {n.body ? (
                          <span className="mt-0.5 block text-xs text-ink-secondary line-clamp-2">
                            {n.body}
                          </span>
                        ) : null}
                      </span>

                      <span className="shrink-0 text-right">
                        <span className="block text-xs tabular-nums text-ink-muted whitespace-nowrap">
                          {formatDate(n.created_at, 'dd/MM/yy')}
                        </span>
                        <span className="block text-[11px] tabular-nums text-ink-muted/80">
                          {formatDate(n.created_at, 'HH:mm')}
                        </span>
                      </span>

                      {href ? (
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                      ) : (
                        <span className="w-4 shrink-0" aria-hidden />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}
