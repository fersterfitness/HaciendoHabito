import { useEffect, useState } from 'react'
import { Bell, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'
import type { Notification } from '@/types/database'
import toast from 'react-hot-toast'

const TYPE_LABELS: Record<string, string> = {
  rutina_por_vencer: '⚠️ Rutina por vencer',
  form_recibido: '📋 Formulario recibido',
  pdf_generado: '📄 PDF generado',
  consulta_recibida: '💬 Consulta recibida',
  feedback_enviado: '✅ Feedback enviado',
  pago_pendiente: '💰 Pago pendiente',
  sistema: '🔔 Sistema',
}

export function NotificationsPage() {
  const { user } = useAuthStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setNotifications(data ?? [])
        setLoading(false)
      })
  }, [user])

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
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n))
  }

  return (
    <div>
      <Header
        title="Notificaciones"
        actions={
          <Button variant="ghost" size="sm" icon={<Check className="h-4 w-4" />} onClick={markAllRead}>
            Marcar todas
          </Button>
        }
      />

      <div className="px-4 lg:px-6 py-6 space-y-3 max-w-2xl">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-8 w-8" />}
            title="Sin notificaciones"
            description="No tenés notificaciones por el momento."
          />
        ) : (
          notifications.map((n) => (
            <Card
              key={n.id}
              hover
              onClick={() => markRead(n.id)}
              className={`flex gap-3 ${n.is_read ? 'opacity-60' : ''}`}
            >
              {!n.is_read && (
                <div className="w-2 h-2 rounded-full bg-brand-primary mt-1.5 shrink-0" />
              )}
              <div className={`flex-1 min-w-0 ${n.is_read ? 'pl-5' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-ink-muted">{TYPE_LABELS[n.type] ?? n.type}</p>
                    <p className="text-sm font-semibold text-ink-primary">{n.title}</p>
                    <p className="text-xs text-ink-secondary mt-0.5">{n.body}</p>
                  </div>
                  <p className="text-xs text-ink-muted shrink-0">{formatDate(n.created_at, 'dd/MM HH:mm')}</p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
