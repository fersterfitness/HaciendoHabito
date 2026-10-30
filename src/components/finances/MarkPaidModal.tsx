import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { PAYMENT_METHODS } from '@/lib/constants'
import { controlMdClassName } from '@/lib/formControlClasses'
import { cn } from '@/lib/utils'
import type { PaymentMethod } from '@/types/database'

export type MarkPaidValues = { amount: number; method: PaymentMethod; date: string }

/** Registrar un cobro: monto, medio y fecha. Se usa en rutinas («Abonó») y en el tablero de Finanzas. */
export function MarkPaidModal({
  open,
  title,
  subtitle,
  defaultAmount,
  amountLocked = false,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  subtitle?: string
  defaultAmount: number | null
  /** Cobros de rutinas pendientes: el monto ya está definido por la rutina. */
  amountLocked?: boolean
  onClose: () => void
  onConfirm: (values: MarkPaidValues) => Promise<void>
}) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('transferencia')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setAmount(defaultAmount && defaultAmount > 0 ? String(defaultAmount) : '')
    setDate(new Date().toISOString().slice(0, 10))
  }, [open, defaultAmount])

  const amountNum = Number(amount.replace(',', '.'))
  /** 0 es válido: asesoría bonificada (queda registrada como pagada). */
  const amountValid = amount.trim() !== '' && Number.isFinite(amountNum) && amountNum >= 0

  async function confirm() {
    setSaving(true)
    await onConfirm({ amount: Number.isFinite(amountNum) ? amountNum : 0, method, date })
    setSaving(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      eyebrow="Registrar cobro"
      title={title}
      description={subtitle}
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            loading={saving}
            disabled={!amountLocked && !amountValid}
            icon={<Check className="h-4 w-4" />}
            onClick={() => void confirm()}
          >
            Marcar pagado
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-xs font-medium text-ink-secondary">
          Monto
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={amount}
            disabled={amountLocked}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className={cn(controlMdClassName, 'mt-1 w-full tabular-nums disabled:opacity-70')}
          />
          {!amountLocked ? (
            <span className="mt-1 block text-3xs font-normal text-ink-muted">
              {amountValid && amountNum === 0 ? 'Queda registrada como asesoría bonificada ($0).' : 'Poné 0 si la asesoría es bonificada.'}
            </span>
          ) : null}
        </label>
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-secondary">Medio de pago</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value as PaymentMethod)}
                className={cn(
                  'rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors',
                  method === m.value
                    ? 'border-brand-primary/50 bg-brand-primary/10 text-ink-primary'
                    : 'border-surface-border text-ink-secondary hover:border-surface-inputBorder hover:text-ink-primary',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <label className="block text-xs font-medium text-ink-secondary">
          Fecha
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={cn(controlMdClassName, 'mt-1 w-full')}
          />
        </label>
      </div>
    </Modal>
  )
}
