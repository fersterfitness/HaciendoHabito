import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { fetchUnreadUrgentMessages, markUrgentMessageRead } from '@/lib/routine/studentTrainingLog'
import { buildWhatsAppDirectUrl, normalizePhoneForWhatsApp } from '@/lib/whatsapp'

/**
 * v2 · Inicio: consultas urgentes que mandaron los alumnos desde el link de su rutina. Quedan arriba
 * de todo hasta que se marcan como vistas. Sin consultas no se muestra nada.
 */
export function UrgentMessagesPanelV2({ ownerId, onOpenStudent }: { ownerId: string; onOpenStudent: (studentId: string) => void }) {
  const qc = useQueryClient()
  const key = ['v2', 'urgent-messages', ownerId]
  const q = useQuery({ queryKey: key, queryFn: () => fetchUnreadUrgentMessages(ownerId), staleTime: 30_000, refetchOnWindowFocus: true })
  const list = q.data ?? []
  if (list.length === 0) return null

  async function markRead(id: string) {
    try {
      await markUrgentMessageRead(id)
      qc.setQueryData(key, (prev: typeof list | undefined) => (prev ?? []).filter((m) => m.id !== id))
    } catch {
      toast.error('No se pudo marcar como vista')
    }
  }

  return (
    <section aria-label="Consultas urgentes" className="rounded-2xl border border-status-expired/40 bg-status-expired/5">
      <h2 className="flex items-center gap-2 px-4 pt-3.5 text-sm font-semibold text-ink-primary">
        <AlertTriangle className="h-4 w-4 text-status-expired" />
        {list.length === 1 ? 'Consulta urgente' : `${list.length} consultas urgentes`}
      </h2>
      <ul className="divide-y divide-surface-border px-4 pb-1">
        {list.map((m) => {
          const digits = normalizePhoneForWhatsApp(m.student_phone)
          return (
            <li key={m.id} className="flex flex-col gap-2.5 py-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-primary">
                  <Button variant="ghost" className="h-auto p-0 text-sm font-semibold hover:bg-transparent hover:underline" onClick={() => onOpenStudent(m.student_id)}>
                    {m.student_name}
                  </Button>
                  <span className="ml-2 text-xs text-ink-muted">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: es })}</span>
                </p>
                <p className="mt-0.5 whitespace-pre-line break-words text-sm text-ink-secondary">{m.message}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                {digits ? (
                  <Button size="sm" variant="secondary" icon={<WhatsAppIcon className="h-3.5 w-3.5" />} onClick={() => window.open(buildWhatsAppDirectUrl(digits), '_blank', 'noopener')}>
                    Responder
                  </Button>
                ) : null}
                <Button size="sm" icon={<Check className="h-3.5 w-3.5" />} onClick={() => void markRead(m.id)}>
                  Vista
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
