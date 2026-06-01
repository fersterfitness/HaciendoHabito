import { useCallback, useEffect, useState } from 'react'
import { Calendar, CalendarPlus, ChevronDown, ChevronUp, CreditCard, History, Plus } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import {
  BILLING_PERIOD_LABELS,
  PAYMENT_STATUS_LABELS,
  daysBetween,
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
  /** Aumenta cada vez que el padre quiera forzar refetch (p.ej. tras crear assignment). */
  refreshKey?: number
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function paymentStatusClasses(status: PlanAssignmentPaymentStatus): string {
  switch (status) {
    case 'paid':    return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 ring-emerald-500/30'
    case 'overdue': return 'bg-red-500/15 text-red-600 dark:text-red-300 ring-red-500/30'
    default:        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30'
  }
}

export function StudentPlanCard({ studentId, onRequestAssign, refreshKey = 0 }: Props) {
  const [assignments, setAssignments] = useState<StudentPlanAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [updatingPayment, setUpdatingPayment] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const list = await fetchAssignmentsForStudent(studentId)
    setAssignments(list)
    setLoading(false)
  }, [studentId])

  useEffect(() => { void load() }, [load, refreshKey])

  const current = pickCurrentAssignment(assignments)
  const history = current ? assignments.filter((a) => a.id !== current.id) : []

  const daysRemaining = current ? daysBetween(todayISO(), current.end_date) : 0
  const active = current ? isAssignmentActive(current) : false

  async function handleTogglePaid(a: StudentPlanAssignment) {
    setUpdatingPayment(a.id)
    const next: PlanAssignmentPaymentStatus = a.payment_status === 'paid' ? 'pending' : 'paid'
    const res = await updateAssignmentPaymentStatus(a.id, next)
    setUpdatingPayment(null)
    if (res.ok) {
      setAssignments((prev) => prev.map((x) => x.id === a.id ? { ...x, payment_status: next } : x))
    }
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
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-ink-primary">{current.plan_name_snapshot}</p>
                <p className="text-xs text-ink-muted">{BILLING_PERIOD_LABELS[current.billing_period]}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
                    active
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 ring-emerald-500/30'
                      : 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300 ring-zinc-500/30',
                  )}
                >
                  {active ? `Activo · ${daysRemaining} día${daysRemaining === 1 ? '' : 's'}` : 'Vencido / fuera de rango'}
                </span>
                <button
                  type="button"
                  disabled={updatingPayment === current.id}
                  onClick={() => void handleTogglePaid(current)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 transition-opacity',
                    paymentStatusClasses(current.payment_status),
                    updatingPayment === current.id && 'opacity-50',
                  )}
                  title="Click para alternar estado de pago"
                >
                  <CreditCard className="h-3 w-3" />
                  {PAYMENT_STATUS_LABELS[current.payment_status]}
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
            </dl>

            {current.notes ? (
              <p className="rounded-lg bg-surface-elevated/50 p-2 text-xs text-ink-secondary">
                {current.notes}
              </p>
            ) : null}
          </div>
        )}

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
                {history.map((a) => (
                  <li key={a.id} className="rounded-lg border border-surface-border/60 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink-primary">{a.plan_name_snapshot}</span>
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1', paymentStatusClasses(a.payment_status))}>
                        {PAYMENT_STATUS_LABELS[a.payment_status]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-ink-muted">
                      {BILLING_PERIOD_LABELS[a.billing_period]} · {formatDate(a.start_date)} → {formatDate(a.end_date)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
