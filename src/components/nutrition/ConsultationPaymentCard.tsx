import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { financeKeys } from '@/data/finance'
import { supabase } from '@/lib/supabase'
import { cn, formatCurrency } from '@/lib/utils'
import { controlMdClassName } from '@/lib/formControlClasses'

/** Mismo tipo y categoría que «Consulta suelta · Nutrición» del alta manual en Finanzas. */
const INCOME_TYPE = 'Consulta suelta'
const CATEGORY = 'Nutrición'

const METHODS = [
  { value: 'efectivo_ars', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'mercadopago', label: 'MercadoPago' },
  { value: 'otro', label: 'Otro' },
] as const
type Method = (typeof METHODS)[number]['value']

type Prefill = { amount: number | null; method: Method; alreadyToday: { amount: number; status: string } | null }

async function loadPrefill(ownerId: string, studentId: string, today: string): Promise<Prefill> {
  // El último cobro de consulta de este paciente; si no hay, el último de cualquier paciente.
  const { data } = await supabase
    .from('income')
    .select('amount, payment_method, student_id, income_date, status')
    .eq('owner_id', ownerId)
    .eq('income_type', INCOME_TYPE)
    .order('income_date', { ascending: false })
    .limit(50)
  const rows = (data ?? []) as { amount: number; payment_method: string; student_id: string | null; income_date: string; status: string }[]
  const todayRow = rows.find((r) => r.student_id === studentId && r.income_date === today && r.status !== 'cancelado')
  const ref = rows.find((r) => r.student_id === studentId) ?? rows[0]
  const method = METHODS.some((m) => m.value === ref?.payment_method) ? (ref!.payment_method as Method) : 'transferencia'
  return { amount: ref ? Number(ref.amount) : null, method, alreadyToday: todayRow ? { amount: Number(todayRow.amount), status: todayRow.status } : null }
}

/**
 * Cierre de la consulta: dejar registrado el cobro sin ir a Finanzas. Propone el monto y el medio de la
 * última consulta; se puede marcar cobrado, dejarlo pendiente o no registrar nada.
 */
export function ConsultationPaymentCard({
  ownerId,
  studentId,
  studentName,
  today,
}: {
  ownerId: string
  studentId: string
  studentName: string
  today: string
}) {
  const qc = useQueryClient()
  const [prefill, setPrefill] = useState<Prefill | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<Method>('transferencia')
  const [saving, setSaving] = useState<'cobrado' | 'pendiente' | null>(null)
  const [saved, setSaved] = useState<{ amount: number; status: string } | null>(null)

  useEffect(() => {
    let alive = true
    void loadPrefill(ownerId, studentId, today).then((p) => {
      if (!alive) return
      setPrefill(p)
      setAmount(p.amount ? String(p.amount) : '')
      setMethod(p.method)
      if (p.alreadyToday) setSaved(p.alreadyToday)
    })
    return () => {
      alive = false
    }
  }, [ownerId, studentId, today])

  const value = Number(amount.replace(/\./g, '').replace(',', '.'))
  const valid = Number.isFinite(value) && value > 0

  async function save(status: 'cobrado' | 'pendiente') {
    if (!valid) return
    setSaving(status)
    const { error } = await supabase.from('income').insert({
      owner_id: ownerId,
      student_id: studentId,
      amount: value,
      payment_method: method,
      income_type: INCOME_TYPE,
      category: CATEGORY,
      description: `Consulta ${studentName}`,
      income_date: today,
      status,
      scope: 'business',
      notes: null,
    } as never)
    setSaving(null)
    if (error) {
      setSaved(null)
      // El mensaje de la base queda en la consola; al usuario, algo que entienda.
      console.warn('No se pudo registrar el cobro', error.message)
      toast.error('No se pudo registrar el cobro. Probá desde Finanzas.')
      return
    }
    setSaved({ amount: value, status })
    void qc.invalidateQueries({ queryKey: financeKeys.incomes(ownerId) })
  }

  if (!prefill) return <div className="h-[7.5rem] animate-pulse rounded-2xl border border-surface-border bg-surface-card" aria-hidden />

  if (saved) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-surface-border bg-surface-card px-4 py-3 text-left">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pastel-mint text-pastel-mint-ink">
          <Check className="h-4 w-4" />
        </span>
        <p className="text-[14px] text-ink-primary">
          {saved.status === 'cobrado' ? 'Cobro registrado' : 'Cobro pendiente registrado'}: <strong>{formatCurrency(saved.amount)}</strong>
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-card px-4 py-3.5 text-left">
      <p className="flex items-center gap-2 text-[14px] font-medium text-ink-primary">
        <Wallet className="h-4 w-4 text-ink-secondary" /> Cobro de la consulta
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="relative w-36">
          <span className="sr-only">Monto</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">$</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Monto"
            className={cn(controlMdClassName, 'w-full pl-7')}
          />
        </label>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Medio de pago">
          {METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={method === m.value}
              onClick={() => setMethod(m.value)}
              className={cn(
                'h-8 rounded-full px-3 text-[12.5px] transition-colors',
                method === m.value ? 'bg-ink-primary text-surface-base' : 'bg-surface-elevated text-ink-secondary hover:text-ink-primary',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={!valid} loading={saving === 'cobrado'} onClick={() => void save('cobrado')}>
          Cobrado
        </Button>
        <Button size="sm" variant="secondary" disabled={!valid} loading={saving === 'pendiente'} onClick={() => void save('pendiente')}>
          Queda pendiente
        </Button>
      </div>
    </div>
  )
}
