import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import type { Income } from '@/types/database'
import { INCOME_TYPES, PAYMENT_METHODS } from '@/lib/constants'
import { buildPersonalFullMirrorIncomeRow, buildPersonalHalfIncomeRow } from '@/lib/financePersonalSplit'
import { notifyPaymentRegistered } from '@/lib/notifications'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'

// ─── QuickPayModal ────────────────────────────────────────────────────────────

export function QuickPayModal({
  studentId,
  studentName,
  onClose,
}: {
  studentId: string
  studentName: string
  onClose: () => void
}) {
  const { user } = useAuthStore()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('efectivo_ars')
  const [type, setType] = useState(INCOME_TYPES[0] ?? 'Otro')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!user) return
    const amt = Number(amount)
    if (!amt || amt <= 0) { toast.error('Ingresá un monto válido'); return }
    setSaving(true)
    const mainRow = {
      owner_id: user.id,
      student_id: studentId,
      amount: amt,
      payment_method: method as Income['payment_method'],
      income_type: type,
      income_date: date,
      description: `Pago de ${studentName}`,
      category: 'Entrenamiento',
      status: 'cobrado' as const,
      notes: notes.trim() ? notes.trim() : null,
      scope: 'business' as const,
    }
    const { data: inserted, error } = await supabase.from('income').insert(mainRow).select('id').single()
    if (error) {
      setSaving(false)
      toast.error(error.message)
      return
    }
    void notifyPaymentRegistered({
      userId: user.id,
      amount: amt,
      studentName,
      studentId,
      incomeId: inserted?.id ?? null,
      paymentMethod: method,
    })
    const split = buildPersonalHalfIncomeRow(mainRow)
    if (split) {
      const { error: splitErr } = await supabase.from('income').insert(split)
      setSaving(false)
      if (splitErr) {
        toast.error(`Pago guardado pero no la mitad en vida personal: ${splitErr.message}`)
        onClose()
        return
      }
      toast.success('Pago + mitad proyecto en vida personal ✓')
      onClose()
      return
    }
    const mirror = buildPersonalFullMirrorIncomeRow(mainRow)
    if (mirror) {
      const { error: mirrorErr } = await supabase.from('income').insert(mirror)
      setSaving(false)
      if (mirrorErr) {
        toast.error(`Pago guardado pero no la copia en vida personal: ${mirrorErr.message}`)
        onClose()
        return
      }
      toast.success('Pago HH + copia íntegra en vida personal ✓')
      onClose()
      return
    }
    setSaving(false)
    toast.success('Pago registrado ✓')
    onClose()
  }

  return (
    <Modal open onClose={onClose} size="sm" bare>
    <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-surface-border">
      <div>
        <h3 className="text-sm font-semibold text-ink-primary">Registrar pago</h3>
        <p className="text-xs text-ink-muted">{studentName}</p>
      </div>
      <button onClick={onClose} className="text-ink-muted hover:text-ink-primary"><X className="h-4 w-4" /></button>
    </div>

    <div className="px-4 py-4 space-y-3">
      {/* Monto */}
      <div>
        <label className="block text-xs font-medium text-ink-secondary mb-1">Monto *</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-sm font-semibold">$</span>
          <input
            type="number" min={0} step={100} placeholder="0"
            className="w-full bg-surface-elevated text-ink-primary text-lg font-bold rounded-xl pl-7 pr-3 py-2.5 border border-surface-border focus:border-brand-primary/60 outline-none text-center"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Tipo */}
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1">Tipo de ingreso / plan</label>
          <select
            className="w-full rounded-xl border border-surface-inputBorder bg-surface-input px-3 py-2 text-sm text-ink-primary shadow-xs outline-none hover:border-ink-muted/50 focus:border-brand-primary/60"
            value={type} onChange={(e) => setType(e.target.value)}
          >
            {INCOME_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {/* Método */}
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1">Método</label>
          <select
            className="w-full rounded-xl border border-surface-inputBorder bg-surface-input px-3 py-2 text-sm text-ink-primary shadow-xs outline-none hover:border-ink-muted/50 focus:border-brand-primary/60"
            value={method} onChange={(e) => setMethod(e.target.value)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Fecha */}
      <div>
        <label className="block text-xs font-medium text-ink-secondary mb-1">Fecha</label>
        <input
          type="date"
          className="w-full rounded-xl border border-surface-inputBorder bg-surface-input px-3 py-2 text-sm text-ink-primary shadow-xs outline-none hover:border-ink-muted/50 focus:border-brand-primary/60"
          value={date} onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {/* Notas */}
      <div>
        <label className="block text-xs font-medium text-ink-secondary mb-1">Notas libres (ej. cuotas)</label>
        <input
          placeholder="ej: quedan 2 cuotas, mes mayo…"
          className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary/60 outline-none placeholder:text-ink-muted"
          value={notes} onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <Button
        className="w-full"
        variant="gradientSecondary"
        loading={saving}
        onClick={handleSave}
      >
        Confirmar pago
      </Button>
    </div>
    </Modal>
  )
}
