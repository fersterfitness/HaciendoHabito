import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, CalendarX, CheckCircle2, ChevronRight, CreditCard, RefreshCw } from 'lucide-react'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { Header } from '@/components/layout/Header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import {
  BILLING_PERIOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  daysBetween,
  effectivePaymentStatus,
  todayISO,
} from '@/lib/studentPlanAssignments'
import type { StudentPlanAssignment } from '@/types/database'

type Row = StudentPlanAssignment & { student_name?: string }

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatMoney(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

export function PlansOverviewPage() {
  const navigate = useAppNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('student_plan_assignments')
      .select('*, students!inner(full_name)')
      .order('end_date', { ascending: true })
      .limit(500)
    if (error) {
      console.error('[PlansOverviewPage]', error)
      setRows([])
    } else {
      setRows(((data ?? []) as Array<StudentPlanAssignment & { students?: { full_name?: string } }>).map((r) => ({
        ...r,
        student_name: r.students?.full_name,
      })))
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const grouped = useMemo(() => {
    const today = todayISO()
    const active: Row[] = []
    const expiring: Row[] = [] // próximos 14 días
    const expired: Row[] = []
    const cancelled: Row[] = []

    for (const r of rows) {
      const eff = effectivePaymentStatus(r)
      if (eff === 'cancelled') {
        cancelled.push(r)
        continue
      }
      const days = daysBetween(today, r.end_date)
      if (r.end_date < today) {
        expired.push(r)
      } else if (days <= 14) {
        expiring.push(r)
      } else {
        active.push(r)
      }
    }
    return { active, expiring, expired, cancelled }
  }, [rows])

  const totalPaidAmount = useMemo(() => {
    return rows
      .filter((r) => r.payment_status === 'paid' && r.amount)
      .reduce((sum, r) => sum + (r.amount ?? 0), 0)
  }, [rows])

  const pendingAmount = useMemo(() => {
    return rows
      .filter((r) => {
        const eff = effectivePaymentStatus(r)
        return (eff === 'pending' || eff === 'overdue') && r.amount
      })
      .reduce((sum, r) => sum + (r.amount ?? 0), 0)
  }, [rows])

  function Section({ title, icon, items, tone }: { title: string; icon: React.ReactNode; items: Row[]; tone: string }) {
    if (items.length === 0) return null
    return (
      <Card padding="md">
        <CardHeader>
          <CardTitle className={cn('flex items-center gap-2', tone)}>
            {icon}
            {title}
            <span className="rounded-full bg-surface-elevated px-1.5 py-0.5 text-[10px] font-semibold text-ink-secondary">
              {items.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-surface-border/60">
            {items.map((r) => {
              const eff = effectivePaymentStatus(r)
              const days = daysBetween(todayISO(), r.end_date)
              return (
                <li
                  key={r.id}
                  onClick={() => navigate(`/students/${r.student_id}`)}
                  className="grid cursor-pointer grid-cols-[1fr_auto] gap-2 py-2 hover:bg-surface-elevated/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-primary">{r.student_name ?? '—'}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {r.plan_name_snapshot} · {BILLING_PERIOD_LABELS[r.billing_period]} · vence {formatDate(r.end_date)}
                      {r.payment_method ? ` · ${PAYMENT_METHOD_LABELS[r.payment_method]}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                      eff === 'paid' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25' :
                      eff === 'overdue' ? 'bg-red-500/15 text-red-600 dark:text-red-300 ring-red-500/25' :
                      eff === 'cancelled' ? 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300 ring-zinc-500/25' :
                      'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/25',
                    )}>
                      {PAYMENT_STATUS_LABELS[eff]}
                    </span>
                    {r.amount != null ? (
                      <span className="hidden text-xs tabular-nums text-ink-secondary sm:inline">{formatMoney(r.amount)}</span>
                    ) : null}
                    {days >= 0 && r.end_date >= todayISO() ? (
                      <span className="hidden text-[11px] text-ink-muted sm:inline">{days}d</span>
                    ) : null}
                    <ChevronRight className="h-4 w-4 text-ink-muted" />
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col">
      <Header />
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink-primary">Planes</h1>
            <p className="text-sm text-ink-muted">Vista global de planes asignados, vencimientos y pagos.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={() => void load()}
            disabled={loading}
          >
            Actualizar
          </Button>
        </div>

        {/* KPIs */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card padding="md">
            <p className="text-[11px] uppercase tracking-wide text-ink-muted">Activos</p>
            <p className="mt-1 text-xl font-semibold text-emerald-600 dark:text-emerald-400">{grouped.active.length}</p>
          </Card>
          <Card padding="md">
            <p className="text-[11px] uppercase tracking-wide text-ink-muted">Por vencer</p>
            <p className="mt-1 text-xl font-semibold text-amber-600 dark:text-amber-400">{grouped.expiring.length}</p>
          </Card>
          <Card padding="md">
            <p className="text-[11px] uppercase tracking-wide text-ink-muted">Vencidos</p>
            <p className="mt-1 text-xl font-semibold text-red-600 dark:text-red-400">{grouped.expired.length}</p>
          </Card>
          <Card padding="md">
            <p className="text-[11px] uppercase tracking-wide text-ink-muted">Pendiente cobro</p>
            <p className="mt-1 text-xl font-semibold text-ink-primary">{formatMoney(pendingAmount)}</p>
          </Card>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : rows.length === 0 ? (
          <Card padding="lg">
            <p className="text-center text-sm text-ink-muted">Todavía no hay planes asignados.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            <Section
              title="Por vencer (próximos 14 días)"
              icon={<CalendarClock className="h-4 w-4" />}
              items={grouped.expiring}
              tone="text-amber-700 dark:text-amber-300"
            />
            <Section
              title="Vencidos"
              icon={<CalendarX className="h-4 w-4" />}
              items={grouped.expired}
              tone="text-red-600 dark:text-red-300"
            />
            <Section
              title="Activos"
              icon={<CheckCircle2 className="h-4 w-4" />}
              items={grouped.active}
              tone="text-emerald-700 dark:text-emerald-300"
            />
            <Section
              title="Cancelados"
              icon={<CreditCard className="h-4 w-4" />}
              items={grouped.cancelled}
              tone="text-ink-secondary"
            />
          </div>
        )}
      </div>
    </div>
  )
}
