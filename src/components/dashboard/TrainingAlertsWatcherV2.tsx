import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast, { type Toast } from 'react-hot-toast'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AvatarV2 } from '@/components/v2/ui'
import { useTrainingMonitor } from '@/components/dashboard/TrainingMonitorCardV2'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { alertKeys, newMonitorAlerts, type MonitorAlert } from '@/lib/routine/monitorAlerts'
import { browserNotificationsGranted, useMonitorAlertPrefs } from '@/lib/routine/monitorAlertPrefs'
import { fetchUnreadUrgentMessages, urgentTitle } from '@/lib/routine/studentTrainingLog'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

/** Más que esto de golpe → un solo aviso que lo resume. */
const MAX_TOASTS = 3

const DOT: Record<MonitorAlert['kind'] | 'urgent', string> = {
  started: 'bg-status-ok',
  finished: 'bg-ink-primary',
  missed: 'bg-status-expired',
  below: 'bg-pastel-butter-accent',
  effort: 'bg-status-expired',
  checkin: 'bg-status-expired',
  urgent: 'bg-status-expired',
}

interface Notice {
  key: string
  kind: MonitorAlert['kind'] | 'urgent'
  title: string
  detail: string
  studentName: string
  avatarPath: string | null
  important: boolean
  /** A dónde lleva «Ver». */
  to: string
}

function AlertToast({ t, n, onOpen }: { t: Toast; n: Notice; onOpen: () => void }) {
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex w-[22rem] max-w-[calc(100vw-2rem)] items-start gap-3 rounded-2xl border bg-surface-card p-3 shadow-lg transition-[opacity,transform] duration-200',
        n.important ? 'border-status-expired/40' : 'border-surface-border',
        t.visible ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0',
      )}
    >
      <span className="relative mt-0.5 shrink-0">
        <AvatarV2 name={n.studentName} path={n.avatarPath} />
        <span className={cn('absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface-card', DOT[n.kind])} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug text-ink-primary">{n.title}</span>
        {n.detail ? <span className="mt-0.5 line-clamp-2 block text-xs text-ink-secondary">{n.detail}</span> : null}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-2 h-7"
          onClick={() => {
            toast.dismiss(t.id)
            onOpen()
          }}
        >
          Ver
        </Button>
      </span>
      <Button type="button" size="sm" variant="ghost" aria-label="Cerrar aviso" className="h-7 w-7 shrink-0 p-0" onClick={() => toast.dismiss(t.id)}>
        <X className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  )
}

/**
 * Avisos del monitor de entrenamiento en toda la app del entrenador: quién empezó o terminó, quién
 * avisó que no entrena, cargas por debajo de lo planificado, Borg muy alto, un chequeo con molestias o
 * poco sueño y las consultas urgentes. Con la pestaña a la vista salen como avisos de la app; si no, y
 * el entrenador dio permiso, como notificación del navegador.
 */
export function TrainingAlertsWatcherV2() {
  const userId = useAuthStore((s) => s.user?.id)
  const role = useAuthStore((s) => s.profile?.role)
  if (!userId || (role !== 'trainer' && role !== 'admin')) return null
  return <Watcher ownerId={userId} />
}

function Watcher({ ownerId }: { ownerId: string }) {
  const prefs = useMonitorAlertPrefs()
  const navigate = useAppNavigate()
  const { rows, loading, empty } = useTrainingMonitor(ownerId, { realtime: true })
  const urgentQ = useQuery({
    queryKey: ['v2', 'urgent-messages', ownerId],
    queryFn: () => fetchUnreadUrgentMessages(ownerId),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  const seen = useRef<Set<string> | null>(null)
  const seenUrgent = useRef<Set<string> | null>(null)
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs

  function deliver(list: Notice[]) {
    if (!prefsRef.current.enabled || list.length === 0) return
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
    if (hidden && prefsRef.current.browser && browserNotificationsGranted()) {
      const send = list.length > MAX_TOASTS ? [{ ...list[0]!, title: `${list.length} novedades en el monitor`, detail: list.map((n) => n.title).join(' · '), to: '/monitor', key: `sum:${list[0]!.key}` }] : list
      for (const n of send) {
        try {
          const notif = new Notification(n.title, { body: n.detail, tag: n.key, icon: '/app-icon-180.png' })
          notif.onclick = () => {
            window.focus()
            navigate(n.to)
            notif.close()
          }
        } catch {
          // Algunos navegadores solo notifican desde un service worker: queda el aviso de la app.
        }
      }
      return
    }
    const shown = list.slice(0, list.length > MAX_TOASTS ? MAX_TOASTS - 1 : MAX_TOASTS)
    for (const n of shown) {
      toast.custom((t) => <AlertToast t={t} n={n} onOpen={() => navigate(n.to)} />, { id: n.key, duration: n.important ? 10_000 : 6_000 })
    }
    const rest = list.length - shown.length
    if (rest > 0) {
      const sum: Notice = { ...list[shown.length]!, key: `sum:${list[shown.length]!.key}`, title: `${rest} novedades más en el monitor`, detail: list.slice(shown.length).map((n) => n.title).join(' · '), to: '/monitor' }
      toast.custom((t) => <AlertToast t={t} n={sum} onOpen={() => navigate('/monitor')} />, { id: sum.key, duration: 10_000 })
    }
  }

  // Monitor: lo nuevo respecto de la lectura anterior. La primera lectura solo fija el punto de partida.
  useEffect(() => {
    if (loading || empty) return
    if (!seen.current) {
      seen.current = alertKeys(rows)
      return
    }
    const fresh = newMonitorAlerts(rows, seen.current)
    if (fresh.length === 0) return
    for (const a of fresh) seen.current.add(a.key)
    deliver(fresh.map((a) => ({ ...a, to: '/monitor' })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, loading, empty])

  // Consultas urgentes nuevas.
  useEffect(() => {
    const list = urgentQ.data
    if (!list) return
    if (!seenUrgent.current) {
      seenUrgent.current = new Set(list.map((m) => m.id))
      return
    }
    const fresh = list.filter((m) => !seenUrgent.current!.has(m.id))
    if (fresh.length === 0) return
    for (const m of fresh) seenUrgent.current.add(m.id)
    deliver(
      fresh.map((m) => ({
        key: `urgent:${m.id}`,
        kind: 'urgent' as const,
        title: urgentTitle(m),
        detail: m.message,
        studentName: m.student_name,
        avatarPath: null,
        important: m.kind === 'urgent' || m.kind === 'pain',
        to: m.kind !== 'urgent' && m.routine_id ? `/routines/${m.routine_id}` : '/dashboard',
      })),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urgentQ.data])

  return null
}
