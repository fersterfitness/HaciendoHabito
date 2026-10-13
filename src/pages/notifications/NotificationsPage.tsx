import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, ChevronRight, ClipboardCheck, Clock, FileText, KeyRound, MessageCircle, Send, Trash2, Wallet, type LucideIcon } from 'lucide-react'
import { deleteNotification, notificationHref } from '@/lib/notifications'
import { subscribeNotificationChanges } from '@/lib/notificationsRealtime'
import { NOTIFICATION_TYPE_LABELS } from '@/lib/notificationLabels'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { cn, formatDate } from '@/lib/utils'
import type { Notification } from '@/types/database'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

const HISTORY_LIMIT = 100


/** Ícono y tono por tipo: la lista se lee de un vistazo. */
const TYPE_STYLE: Record<string, { icon: LucideIcon; tone: string }> = {
  rutina_por_vencer: { icon: Clock, tone: 'bg-amber-500/12 text-amber-600 dark:text-amber-400' },
  form_recibido: { icon: ClipboardCheck, tone: 'bg-brand-primary/12 text-brand-primary' },
  pdf_generado: { icon: FileText, tone: 'bg-sky-500/12 text-sky-600 dark:text-sky-400' },
  consulta_recibida: { icon: MessageCircle, tone: 'bg-violet-500/12 text-violet-600 dark:text-violet-400' },
  feedback_enviado: { icon: Send, tone: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' },
  pago_pendiente: { icon: Wallet, tone: 'bg-amber-500/12 text-amber-600 dark:text-amber-400' },
  pago_registrado: { icon: Wallet, tone: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' },
  intake_acceso_solicitado: { icon: KeyRound, tone: 'bg-brand-primary/12 text-brand-primary' },
}
const DEFAULT_TYPE_STYLE = { icon: Bell, tone: 'bg-surface-elevated text-ink-muted' }

export function NotificationsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  async function removeNotification(id: string) {
    setDeletingId(id)
    const ok = await deleteNotification(id)
    setDeletingId(null)
    if (!ok) {
      toast.error('No se pudo eliminar la notificación')
      return
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    toast.success('Notificación eliminada')
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
          <div className="overflow-hidden rounded-xl border border-surface-border/60 bg-surface-card">
            <div className="flex items-center justify-between gap-3 border-b border-surface-border/50 px-3 py-2">
              <p className="text-xs text-ink-muted">
                {notifications.length} en el historial
                {unreadCount > 0 ? ` · ${unreadCount} sin leer` : ''}
              </p>
              <p className="text-2xs text-ink-muted/80 shrink-0">Más recientes primero</p>
            </div>

            <ul className="divide-y divide-surface-border/40" role="list">
              {notifications.map((n) => {
                const href = notificationHref(n)
                const typeLabel = NOTIFICATION_TYPE_LABELS[n.type as keyof typeof NOTIFICATION_TYPE_LABELS] ?? n.type
                const isDeleting = deletingId === n.id
                const typeStyle = TYPE_STYLE[n.type] ?? DEFAULT_TYPE_STYLE
                const TypeIcon = typeStyle.icon

                return (
                  <li
                    key={n.id}
                    className={cn(
                      'group relative flex items-center gap-3 px-3 py-2.5 transition-colors',
                      'hover:bg-surface-elevated/40',
                      !n.is_read && 'bg-brand-primary/[0.04]',
                      isDeleting && 'opacity-50 pointer-events-none',
                    )}
                  >
                    {!n.is_read ? (
                      <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand-gradient" />
                    ) : null}
                    <span
                      aria-hidden
                      className={cn(
                        'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                        typeStyle.tone,
                        n.is_read && 'opacity-60',
                      )}
                    >
                      <TypeIcon className="h-4 w-4" strokeWidth={2} />
                      {!n.is_read ? (
                        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-brand-primary ring-2 ring-surface-card" title="Sin leer" />
                      ) : null}
                    </span>

                    <button
                      type="button"
                      onClick={() => void openNotification(n)}
                      className={cn(
                        'min-w-0 flex-1 text-left outline-none',
                        'focus-visible:ring-1 focus-visible:ring-surface-border rounded-sm',
                      )}
                    >
                      <span className="flex items-baseline gap-2 min-w-0">
                        <span
                          className={cn(
                            'truncate text-body-sm leading-tight',
                            n.is_read ? 'font-normal text-ink-secondary' : 'font-medium text-ink-primary',
                          )}
                        >
                          {n.title}
                        </span>
                        <span className="shrink-0 text-2xs tabular-nums text-ink-muted/70">
                          {formatDate(n.created_at, 'dd/MM HH:mm')}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-2xs text-ink-muted leading-tight">
                        {typeLabel}
                        {n.body ? ` · ${n.body}` : ''}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void removeNotification(n.id)
                      }}
                      disabled={isDeleting}
                      aria-label="Eliminar notificación"
                      className={cn(
                        'shrink-0 rounded-md p-1.5 text-ink-muted/35 transition-colors',
                        'hover:bg-surface-elevated/60 hover:text-ink-secondary',
                        'sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100',
                        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-surface-border',
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    {href ? (
                      <button
                        type="button"
                        onClick={() => void openNotification(n)}
                        aria-label="Abrir"
                        className="shrink-0 rounded-md p-1 text-ink-muted/40 hover:text-ink-muted transition-colors"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span className="w-[22px] shrink-0" aria-hidden />
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
