import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, Check, ChevronDown, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { markReminderSent, useActiveStudents, useIncomes, useSentReminders } from '@/data/finance'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { MarkPaidModal, type MarkPaidValues } from '@/components/finances/MarkPaidModal'
import { buildPaymentBoard, monthKey, reminderMessage, type StudentPaymentRow } from '@/lib/finance/studentPayments'
import { registerStudentPayment } from '@/lib/finance/routineIncome'
import { normalizePhoneForWhatsApp, shareToWhatsApp, WHATSAPP_DIRECT_PASTE_HINT } from '@/lib/whatsapp'
import { cn, formatCurrency } from '@/lib/utils'

const fmtDay = (ymd: string | null) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}` : '')

/**
 * Inicio: a quién hay que recordarle el pago hoy. El día de pago (sin cobro registrado) sale el
 * primer aviso; a los 7 días hábiles sin pago, el segundo. Al mandarlo (o marcar «Ya le avisé») se va.
 */
export function OverduePaymentsAlert({ ownerId }: { ownerId: string }) {
  const [open, setOpen] = useState(true)
  const [paying, setPaying] = useState<StudentPaymentRow | null>(null)
  const studentsQuery = useActiveStudents()
  const incomesQuery = useIncomes()
  const period = monthKey(new Date())
  const sentQuery = useSentReminders(period)

  const rows = useMemo(() => {
    const sent = new Set((sentQuery.data ?? []).map((r) => `${r.student_id}:${r.kind}`))
    const incomes = (incomesQuery.data ?? []).filter((i) => (i.scope ?? 'business') === 'business' && i.student_id)
    const today = new Date()
    return buildPaymentBoard({
      students: studentsQuery.data ?? [],
      incomes,
      month: new Date(today.getFullYear(), today.getMonth(), 1),
      today,
    }).filter((r) => r.reminder && !sent.has(`${r.studentId}:${r.reminder}`))
  }, [studentsQuery.data, incomesQuery.data, sentQuery.data])

  if (!ownerId || rows.length === 0) return null

  async function markSent(r: StudentPaymentRow) {
    if (!r.reminder) return
    const err = await markReminderSent({ student_id: r.studentId, period, kind: r.reminder })
    if (err) toast.error(err)
  }

  /** Con emojis, WhatsApp escritorio rompe el texto del link: se copia y se abre el chat para pegar. */
  async function sendWhatsApp(r: StudentPaymentRow, digits: string) {
    if (!r.reminder) return
    const res = await shareToWhatsApp({ message: reminderMessage(r.reminder, r.fullName), phoneDigits: digits })
    if (res.mode === 'clipboard') toast.success(WHATSAPP_DIRECT_PASTE_HINT, { duration: 6000 })
    await markSent(r)
  }

  async function copyMessage(r: StudentPaymentRow) {
    if (!r.reminder) return
    try {
      await navigator.clipboard.writeText(reminderMessage(r.reminder, r.fullName))
      toast.success('Mensaje copiado')
      await markSent(r)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  async function confirmPayment(values: MarkPaidValues) {
    if (!paying) return
    const err = await registerStudentPayment({
      ownerId,
      studentId: paying.studentId,
      studentName: paying.fullName,
      amount: values.amount,
      method: values.method,
      date: values.date,
      pendingIncomeIds: paying.pendingIncomeIds,
    })
    if (err) {
      toast.error(err)
      return
    }
    toast.success(`Pago de ${paying.fullName.split(' ')[0]} registrado`)
    setPaying(null)
  }

  const overdueCount = rows.filter((r) => r.reminder === 'overdue').length

  return (
    <div className={cn('hh-alert rounded-xl', overdueCount ? 'hh-alert-danger' : 'hh-alert-warning')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="hh-alert-icon h-7 w-7 shrink-0" aria-hidden>
          <BellRing className="h-3.5 w-3.5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-xs font-semibold text-ink-primary">Recordatorios de pago</span>
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-ink-primary/[0.08] px-1.5 text-3xs font-bold tabular-nums text-ink-primary">
            {rows.length}
          </span>
          <span className="text-2xs text-ink-muted">llegó su fecha de pago y no figura el abono</span>
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-ink-muted transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open ? (
        <ul className="max-h-72 space-y-1 overflow-y-auto border-t border-surface-border/70 px-2 py-2">
          {rows.map((r) => {
            const digits = normalizePhoneForWhatsApp(r.phone)
            const debt = Math.max(0, r.expected - r.paid)
            return (
              <li key={r.studentId} className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 text-2xs hover:bg-surface-elevated/60">
                <div className="min-w-0 flex-1">
                  <Link to={`/students/${r.studentId}`} className="block truncate font-medium text-ink-primary hover:underline">
                    {r.fullName}
                  </Link>
                  <span className={cn('text-3xs', r.reminder === 'overdue' ? 'font-semibold text-status-expired' : 'text-ink-muted')}>
                    {r.reminder === 'overdue'
                      ? `7 días hábiles sin pago (fecha ${fmtDay(r.dueDate)}) · segundo aviso`
                      : `Le toca pagar desde el ${fmtDay(r.dueDate)}`}
                    {debt > 0 ? ` · ${formatCurrency(debt)}` : ''}
                  </span>
                </div>
                {digits ? (
                  <button
                    type="button"
                    onClick={() => void sendWhatsApp(r, digits)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-surface-border bg-surface-card px-2 py-1 text-3xs font-medium text-ink-secondary shadow-xs hover:border-surface-inputBorder hover:text-ink-primary"
                    title="Abre WhatsApp con el mensaje armado"
                  >
                    <WhatsAppIcon className="h-3 w-3 text-emerald-600" />
                    Enviar aviso
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void copyMessage(r)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-surface-border bg-surface-card px-2 py-1 text-3xs font-medium text-ink-secondary shadow-xs hover:text-ink-primary"
                    title="Sin teléfono cargado: copiá el mensaje"
                  >
                    <Copy className="h-3 w-3" />
                    Copiar mensaje
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPaying(r)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-600/30 px-2 py-1 text-3xs font-semibold text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                >
                  <Check className="h-3 w-3" /> Abonó
                </button>
                <button
                  type="button"
                  onClick={() => void markSent(r)}
                  className="shrink-0 rounded-md px-1.5 py-1 text-3xs text-ink-muted hover:text-ink-primary"
                  title="Sacarlo de la lista sin mandar nada"
                >
                  Ya le avisé
                </button>
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

      <MarkPaidModal
        open={!!paying}
        title={paying?.fullName ?? ''}
        subtitle={paying?.pendingIncomeIds.length ? 'Se marcan como cobradas sus rutinas pendientes.' : 'Pago del mes'}
        defaultAmount={paying ? Math.max(0, paying.expected - paying.paid) : null}
        amountLocked={!!paying?.pendingIncomeIds.length}
        onClose={() => setPaying(null)}
        onConfirm={confirmPayment}
      />
    </div>
  )
}
