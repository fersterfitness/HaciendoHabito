import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { buildPaymentBoard, overduePaymentMessage, type StudentPaymentRow } from '@/lib/finance/studentPayments'
import { buildWhatsAppUrl, normalizePhoneForWhatsApp } from '@/lib/whatsapp'
import { cn, formatCurrency } from '@/lib/utils'
import type { Income, Student } from '@/types/database'

/** Inicio: alumnos con el pago vencido este mes (pasó su día de pago sin cobro registrado). */
export function OverduePaymentsAlert({ ownerId }: { ownerId: string }) {
  const [rows, setRows] = useState<StudentPaymentRow[]>([])
  const [open, setOpen] = useState(true)

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      supabase.from('students').select('*').eq('owner_id', ownerId).eq('status', 'activo'),
      supabase
        .from('income')
        .select('id, student_id, amount, status, income_date, payment_method, scope')
        .eq('owner_id', ownerId)
        .eq('scope', 'business')
        .not('student_id', 'is', null),
    ]).then(([stu, inc]) => {
      if (cancelled || stu.error || inc.error) return
      const now = new Date()
      const board = buildPaymentBoard({
        students: (stu.data ?? []) as Student[],
        incomes: (inc.data ?? []) as Income[],
        month: new Date(now.getFullYear(), now.getMonth(), 1),
        today: now,
      })
      setRows(board.filter((r) => r.state === 'vencido'))
    })
    return () => {
      cancelled = true
    }
  }, [ownerId])

  if (rows.length === 0) return null

  return (
    <div className="hh-alert hh-alert-danger rounded-xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="hh-alert-icon h-7 w-7 shrink-0" aria-hidden>
          <Wallet className="h-3.5 w-3.5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-xs font-semibold text-ink-primary">Pagos vencidos</span>
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-ink-primary/[0.08] px-1.5 text-3xs font-bold tabular-nums text-ink-primary">
            {rows.length}
          </span>
          <span className="text-2xs text-ink-muted">pasó su día de pago sin cobro registrado</span>
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-ink-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open ? (
        <ul className="max-h-60 space-y-1 overflow-y-auto border-t border-surface-border/70 px-2 py-2">
          {rows.map((r) => {
            const digits = normalizePhoneForWhatsApp(r.phone)
            const debt = Math.max(0, r.expected - r.paid)
            return (
              <li key={r.studentId} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-2xs hover:bg-surface-elevated/60">
                <Link to={`/students/${r.studentId}`} className="min-w-0 flex-1 truncate font-medium text-ink-primary hover:underline">
                  {r.fullName}
                </Link>
                <span className="shrink-0 tabular-nums text-ink-secondary">{formatCurrency(debt)}</span>
                {digits ? (
                  <a
                    href={buildWhatsAppUrl(digits, overduePaymentMessage(r.fullName))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-surface-border bg-surface-card px-2 py-0.5 text-3xs font-medium text-ink-secondary shadow-xs hover:border-surface-inputBorder hover:text-ink-primary"
                  >
                    <WhatsAppIcon className="h-3 w-3 text-emerald-600" />
                    Recordar
                  </a>
                ) : (
                  <span className="shrink-0 text-3xs text-ink-muted">Sin teléfono</span>
                )}
              </li>
            )
          })}
          <li className="px-2 pt-1">
            <Link to="/finances" className="text-3xs font-semibold text-brand-primary hover:underline">
              Ver cobros del mes en Finanzas
            </Link>
          </li>
        </ul>
      ) : null}
    </div>
  )
}
