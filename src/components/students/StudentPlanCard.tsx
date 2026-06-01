import { useCallback, useEffect, useState } from 'react'
import { Ban, Calendar, CalendarPlus, ChevronDown, ChevronUp, CreditCard, History, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'
import {
  BILLING_PERIOD_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  cancelAssignment,
  daysBetween,
  deleteAssignment,
  effectivePaymentStatus,
  fetchAssignmentsForStudent,
  isAssignmentActive,
  pickCurrentAssignment,
  todayISO,
  updateAssignmentPaymentStatus,
} from '@/lib/studentPlanAssignments'
import type { PlanAssignmentPaymentStatus, StudentPlanAssignment } from '@/types/database'

type Props = {
  studentId: string
  onRequestAssign: () => void
  onRequestEdit: (assignment: StudentPlanAssignment) => void
  refreshKey?: number
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatMoney(n: number | null | undefined): string | null {
  if (n == null) return null
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function paymentStatusClasses(status: PlanAssignmentPaymentStatus): string {
  switch (status) {
    case 'paid':      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 ring-emerald-500/30'
    case 'overdue':   return 'bg-red-500/15 text-red-600 dark:text-red-300 ring-red-500/30'
    case 'cancelled': return 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300 ring-zinc-500/30'
    default:          return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30'
  }
}

export function StudentPlanCard({ studentId, onRequestAssign, onRequestEdit, refreshKey = 0 }: Props) {
  const [assignments, setAssignments] = useState<StudentPlanAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [updatingPayment, setUpdatingPayment] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<StudentPlanAssignment | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<StudentPlanAssignment | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const list = await fetchAssignmentsForStudent(studentId)
    setAssignments(list)
    setLoading(false)
  }, [studentId])

  useEffect(() => { void load() }, [load, refreshKey])

  const current = pickCurrentAssignment(assignments)
  const history = current ? assignments.filter((a) => a.id !== current.id) : assignments

  const daysRemaining = current ? daysBetween(todayISO(), current.end_date) : 0
  const active = current ? isAssignmentActive(current) : false

  async function handleTogglePaid(a: StudentPlanAssignment) {
    const eff = effectivePaymentStatus(a)
    setUpdatingPayment(a.id)
    const next: PlanAssignmentPaymentStatus = eff === 'paid' ? 'pending' : 'paid'
    const res = await updateAssignmentPaymentStatus(a.id, next)
    setUpdatingPayment(null)
    if (res.ok) {
      setAssignments((prev) => prev.map((x) => x.id === a.id ? { ...x, payment_status: next } : x))
    } else {
      toast.error(res.error)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    const id = confirmDelete.id
    setConfirmDelete(null)
    const res = await deleteAssignment(id)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Asignación eliminada')
    void load()
  }

  async function handleCancel() {
    if (!confirmCancel) return
    const id = confirmCancel.id
    setConfirmCancel(null)
    const res = await cancelAssignment(id)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Plan cancelado')
    void load()
  }

  return (
    <Card padding="md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-ink-secondary" />
          Plan vigente
        </CardTitle>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={onRequestAssign}
        >
          Asignar plan
        </Button>
      </CardHeader>

      <CardContent>
        {loading ? (
          <p className="text-sm text-ink-muted">Cargando…</p>
        ) : !current ? (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-surface-border p-4">
            <p className="text-sm text-ink-secondary">Este alumno todavía no tiene un plan asignado.</p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={<CalendarPlus className="h-3.5 w-3.5" />}
              onClick={onRequestAssign}
            >
              Asignar primer plan
            </Button>
          </div>
        ) : (() => {
            const effStatus = effectivePaymentStatus(current)
            const money = formatMoney(current.amount)
            return (
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-ink-primary">{current.plan_name_snapshot}</p>
                <p className="text-xs text-ink-muted">{BILLING_PERIOD_LABELS[current.billing_period]}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
                    active
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 ring-emerald-500/30'
                      : effStatus === 'cancelled'
                        ? 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300 ring-zinc-500/30'
                        : 'bg-red-500/15 text-red-600 dark:text-red-300 ring-red-500/30',
                  )}
                >
                  {effStatus === 'cancelled'
                    ? 'Cancelado'
                    : active
                      ? `Activo · ${daysRemaining} día${daysRemaining === 1 ? '' : 's'}`
                      : 'Vencido'}
                </span>
                <button
                  type="button"
                  disabled={updatingPayment === current.id || effStatus === 'cancelled'}
                  onClick={() => void handleTogglePaid(current)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 transition-opacity',
                    paymentStatusClasses(effStatus),
                    (updatingPayment === current.id || effStatus === 'cancelled') && 'opacity-50',
                  )}
                  title={effStatus === 'cancelled' ? '' : 'Click para alternar estado de pago'}
                >
                  <CreditCard className="h-3 w-3" />
                  {PAYMENT_STATUS_LABELS[effStatus]}
                </button>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Inicio</dt>
                <dd className="font-medium text-ink-primary">{formatDate(current.start_date)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Vencimiento</dt>
                <dd className="font-medium text-ink-primary">{formatDate(current.end_date)}</dd>
              </div>
              {money ? (
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Monto</dt>
                  <dd className="font-medium text-ink-primary">{money}</dd>
                </div>
              ) : null}
              {current.payment_method ? (
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Método</dt>
                  <dd className="inline-flex items-center gap-1 font-medium text-ink-primary">
                    <Wallet className="h-3 w-3" />
                    {PAYMENT_METHOD_LABELS[current.payment_method]}
                  </dd>
                </div>
              ) : null}
            </dl>

            {current.notes ? (
              <p className="rounded-lg bg-surface-elevated/50 p-2 text-xs text-ink-secondary">
                {current.notes}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => onRequestEdit(current)}
                className="inline-flex items-center gap-1 rounded-lg border border-surface-border px-2 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated"
              >
                <Pencil className="h-3 w-3" />
                Editar
              </button>
              {effStatus !== 'cancelled' ? (
                <button
                  type="button"
                  onClick={() => setConfirmCancel(current)}
                  className="inline-flex items-center gap-1 rounded-lg border border-surface-border px-2 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated"
                >
                  <Ban className="h-3 w-3" />
                  Cancelar plan
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setConfirmDelete(current)}
                className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2 py-1 text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-3 w-3" />
                Eliminar
              </button>
            </div>
          </div>
            )
          })()}

        {history.length > 0 ? (
          <div className="mt-4 border-t border-surface-border pt-3">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="flex w-full items-center justify-between text-xs font-semibold text-ink-secondary hover:text-ink-primary"
            >
              <span className="inline-flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                Historial ({history.length})
              </span>
              {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showHistory ? (
              <ul className="mt-2 space-y-2">
                {history.map((a) => {
                  const eff = effectivePaymentStatus(a)
                  return (
                    <li key={a.id} className="rounded-lg border border-surface-border/60 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-ink-primary">{a.plan_name_snapshot}</span>
                        <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1', paymentStatusClasses(eff))}>
                          {PAYMENT_STATUS_LABELS[eff]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-ink-muted">
                        {BILLING_PERIOD_LABELS[a.billing_period]} · {formatDate(a.start_date)} → {formatDate(a.end_date)}
                        {a.amount != null ? ` · ${formatMoney(a.amount)}` : ''}
                        {a.payment_method ? ` · ${PAYMENT_METHOD_LABELS[a.payment_method]}` : ''}
                      </p>
                      <div className="mt-1.5 flex gap-2">
                        <button
                          type="button"
                          onClick={() => onRequestEdit(a)}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated"
                        >
                          <Pencil className="h-2.5 w-2.5" /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(a)}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-red-600 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-2.5 w-2.5" /> Eliminar
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="¿Eliminar asignación?"
        description="Esta acción no se puede deshacer. La asignación quedará borrada del historial."
        confirmLabel="Eliminar"
      />
      <ConfirmDialog
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        onConfirm={handleCancel}
        title="¿Cancelar este plan?"
        description="El plan quedará marcado como cancelado y dejará de contarse como vigente. Podés eliminarlo después si querés."
        confirmLabel="Sí, cancelar"
      />
    </Card>
  )
}
