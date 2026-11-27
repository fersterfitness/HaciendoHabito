import { cn } from '@/lib/utils'
import { controlInputClassName, controlSelectClassName } from '@/lib/formControlClasses'
import { useEffect, useState } from 'react'
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
import { webPlanSlugFrom, webPlanValue, type WebPlanOption } from '@/lib/finance/webPlanOptions'

// ─── QuickPayModal ────────────────────────────────────────────────────────────

export function QuickPayModal({
  studentId,
  studentName,
  defaultAmount,
  webPlans = [],
  currentPlanSlug,
  onPlanSaved,
  onClose,
}: {
  studentId: string
  studentName: string
  /** Cuota del alumno o, si no tiene, precio de su plan web. */
  defaultAmount?: number
  /** Feedback nov27 (5): planes de la web; elegir uno lo deja como plan del alumno. */
  webPlans?: WebPlanOption[]
  currentPlanSlug?: string | null
  onPlanSaved?: (slug: string) => void
  onClose: () => void
}) {
  const { user } = useAuthStore()
  const [amount, setAmount] = useState(defaultAmount && defaultAmount > 0 ? String(defaultAmount) : '')
  // El precio del plan web llega después de abrir: se completa si todavía no escribió nada.
  useEffect(() => {
    if (defaultAmount && defaultAmount > 0) setAmount((cur) => cur || String(defaultAmount))
  }, [defaultAmount])
  const [method, setMethod] = useState('efectivo_ars')
  const hasCurrentPlan = !!currentPlanSlug && webPlans.some((p) => p.slug === currentPlanSlug)
  const [type, setType] = useState(hasCurrentPlan ? webPlanValue(currentPlanSlug!) : (INCOME_TYPES[0] ?? 'Otro'))
  // Los planes llegan después de abrir: si el alumno tiene uno, se elige solo.
  useEffect(() => {
    if (hasCurrentPlan) setType((cur) => (cur === (INCOME_TYPES[0] ?? 'Otro') ? webPlanValue(currentPlanSlug!) : cur))
  }, [hasCurrentPlan, currentPlanSlug])
  const planSlug = webPlanSlugFrom(type)
  const plan = planSlug ? webPlans.find((p) => p.slug === planSlug) : undefined
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
      income_type: plan ? plan.title : type,
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
    // Plan web elegido en el pago: queda como plan del alumno (así la ficha deja de decir «Sin plan web»).
    if (plan && plan.slug !== currentPlanSlug) {
      const { error: planErr } = await supabase.from('students').update({ selected_web_plan_slug: plan.slug }).eq('id', studentId)
      if (planErr) toast.error(`Pago guardado, pero no se pudo guardar el plan: ${planErr.message}`)
      else onPlanSaved?.(plan.slug)
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
      <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar" className="-mr-2 h-8 w-8"><X className="h-4 w-4" /></Button>
    </div>

    <div className="px-4 py-4 space-y-3">
      {/* Monto */}
      <div>
        <label className="block text-xs font-medium text-ink-secondary mb-1">Monto *</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-sm font-semibold">$</span>
          <input
            type="number" min={0} step={100} placeholder="0"
            className={cn(controlInputClassName, 'text-lg text-center font-bold pl-7')}
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
            className={controlSelectClassName}
            value={type}
            onChange={(e) => {
              setType(e.target.value)
              // Plan web con precio: se completa el monto.
              const next = webPlans.find((p) => p.slug === webPlanSlugFrom(e.target.value))
              if (next && next.price > 0) setAmount(String(next.price))
            }}
          >
            {webPlans.length ? (
              <optgroup label="Planes de la web">
                {webPlans.map((p) => (
                  <option key={p.slug} value={webPlanValue(p.slug)}>{p.title}</option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label={webPlans.length ? 'Otros' : 'Tipo de ingreso'}>
              {INCOME_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </optgroup>
          </select>
          {plan && plan.slug !== currentPlanSlug ? (
            <p className="mt-1 text-2xs text-ink-muted">Queda como plan web del alumno.</p>
          ) : null}
        </div>
        {/* Método */}
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1">Método</label>
          <select
            className={controlSelectClassName}
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
          className={controlInputClassName}
          value={date} onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {/* Notas */}
      <div>
        <label className="block text-xs font-medium text-ink-secondary mb-1">Notas libres (ej. cuotas)</label>
        <input
          placeholder="ej: quedan 2 cuotas, mes mayo…"
          className={controlInputClassName}
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
