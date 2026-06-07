import { useCallback, useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

type AccessRow = {
  id: string
  request_token: string
  selected_web_plan_slug: string
  selected_plan_title: string | null
  applicant_name: string | null
  applicant_email: string | null
  applicant_phone: string | null
  status: 'pending' | 'approved' | 'denied'
  created_at: string
}

type Props = {
  /** En Inicio: estilo compacto alineado con otros avisos del tablero. */
  variant?: 'settings' | 'dashboard'
}

export function WebIntakeAccessRequestsPanel({ variant = 'settings' }: Props) {
  const userId = useAuthStore((s) => s.user?.id)
  const [rows, setRows] = useState<AccessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('web_intake_access_requests')
      .select(
        'id, request_token, selected_web_plan_slug, selected_plan_title, applicant_name, applicant_email, applicant_phone, status, created_at',
      )
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
      .limit(80)
    if (error) toast.error(error.message)
    else setRows((data as AccessRow[]) ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  async function setStatus(id: string, status: 'approved' | 'denied') {
    if (!userId) return
    setBusyId(id)
    const { error } = await supabase
      .from('web_intake_access_requests')
      .update({
        status,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('owner_id', userId)
    setBusyId(null)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(status === 'approved' ? 'Acceso habilitado' : 'Solicitud rechazada')
    void load()
  }

  const pending = rows.filter((r) => r.status === 'pending')
  const isDashboard = variant === 'dashboard'

  if (isDashboard && !loading && pending.length === 0) {
    return null
  }

  return (
    <section
      id="accesos-inscripcion"
      className={cn(
        'scroll-mt-24 space-y-3 border border-surface-border bg-surface-card',
        isDashboard ? 'rounded-xl p-3 sm:p-4' : 'mt-8 rounded-2xl p-4 sm:p-5',
      )}
    >
      <div>
        <h2 className={cn('font-semibold text-ink-primary', isDashboard ? 'text-[13px]' : 'text-sm')}>
          Accesos al formulario web (/form)
          {isDashboard && pending.length > 0 ? (
            <span className="ml-1.5 font-medium text-ink-muted">({pending.length})</span>
          ) : null}
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Cuando alguien toca «Pedir acceso al paso 3» en inscripción, aparece acá. Aprobá después de confirmar el
          pago para que pueda completar Datos.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : pending.length === 0 ? (
        <p className="text-sm text-ink-muted">No hay solicitudes pendientes.</p>
      ) : (
        <ul className="space-y-2">
          {pending.map((r) => (
            <li
              key={r.id}
              className={cn(
                'flex flex-col gap-2 border border-surface-border bg-surface-elevated/40 sm:flex-row sm:items-center sm:justify-between',
                isDashboard ? 'rounded-lg p-2.5' : 'rounded-xl p-3',
              )}
            >
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-ink-primary">
                  {r.selected_plan_title?.trim() || r.selected_web_plan_slug}
                </p>
                <p className="text-xs text-ink-muted">
                  {r.applicant_name?.trim() || 'Sin nombre'} ·{' '}
                  {new Date(r.created_at).toLocaleString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                {(r.applicant_email || r.applicant_phone) && (
                  <p className="mt-0.5 text-xs text-ink-secondary">
                    {[r.applicant_email, r.applicant_phone].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  size="sm"
                  loading={busyId === r.id}
                  onClick={() => void setStatus(r.id, 'approved')}
                  className="gap-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  Habilitar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busyId === r.id}
                  onClick={() => void setStatus(r.id, 'denied')}
                  className="gap-1"
                >
                  <X className="h-3.5 w-3.5" />
                  Rechazar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {rows.some((r) => r.status !== 'pending') ? (
        <details className="text-xs text-ink-muted">
          <summary className="cursor-pointer font-medium text-ink-secondary">Historial reciente</summary>
          <ul className="mt-2 space-y-1">
            {rows
              .filter((r) => r.status !== 'pending')
              .slice(0, 15)
              .map((r) => (
                <li key={r.id} className={cn('rounded-lg px-2 py-1', r.status === 'approved' && 'text-emerald-700 dark:text-emerald-300')}>
                  {r.selected_plan_title || r.selected_web_plan_slug} — {r.status}
                </li>
              ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}
