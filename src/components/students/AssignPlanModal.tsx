import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import {
  BILLING_PERIOD_LABELS,
  BILLING_PERIOD_MONTHS,
  PAYMENT_METHOD_LABELS,
  addMonthsToISODate,
  createAssignment,
  todayISO,
  updateAssignment,
} from '@/lib/studentPlanAssignments'
import type { PlanBillingPeriod, PlanPaymentMethod, StudentPlanAssignment } from '@/types/database'

type WebPlanOption = { slug: string; name: string }

type Props = {
  open: boolean
  studentId: string
  /** Si se pasa, modo edición. */
  editAssignment?: StudentPlanAssignment | null
  onClose: () => void
  onAssigned: () => void
}

const BILLING_OPTIONS: PlanBillingPeriod[] = ['monthly', 'months3', 'months6', 'annual']
const PAYMENT_METHODS: PlanPaymentMethod[] = ['cash', 'mercadopago', 'transfer', 'other']

export function AssignPlanModal({ open, studentId, editAssignment, onClose, onAssigned }: Props) {
  const isEdit = !!editAssignment
  const [plans, setPlans] = useState<WebPlanOption[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [planSlug, setPlanSlug] = useState<string>('')
  const [planNameCustom, setPlanNameCustom] = useState<string>('')
  const [billing, setBilling] = useState<PlanBillingPeriod>('monthly')
  const [startDate, setStartDate] = useState<string>(() => todayISO())
  const [amount, setAmount] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<PlanPaymentMethod | ''>('')
  const [notes, setNotes] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    setLoadingPlans(true)
    void (async () => {
      const { data, error } = await supabase
        .from('web_plans')
        .select('slug, name, title')
        .eq('is_active', true)
        .order('sort_order')
      if (error) {
        console.error('[AssignPlanModal] load plans', error)
      } else {
        const opts = (data ?? []).map((p) => ({
          slug: String(p.slug),
          name: String((p as { name?: string; title?: string }).name ?? (p as { title?: string }).title ?? p.slug),
        }))
        setPlans(opts)
      }
      setLoadingPlans(false)
    })()
  }, [open])

  // Inicializar / resetear campos cuando se abre o cambia editAssignment
  useEffect(() => {
    if (!open) return
    if (editAssignment) {
      setPlanSlug(editAssignment.web_plan_slug ?? '')
      setPlanNameCustom(editAssignment.web_plan_slug ? '' : editAssignment.plan_name_snapshot)
      setBilling(editAssignment.billing_period)
      setStartDate(editAssignment.start_date)
      setAmount(editAssignment.amount != null ? String(editAssignment.amount) : '')
      setPaymentMethod(editAssignment.payment_method ?? '')
      setNotes(editAssignment.notes ?? '')
    } else {
      setPlanSlug('')
      setPlanNameCustom('')
      setBilling('monthly')
      setStartDate(todayISO())
      setAmount('')
      setPaymentMethod('')
      setNotes('')
    }
  }, [open, editAssignment])

  if (!open) return null

  const selectedPlan = plans.find((p) => p.slug === planSlug) ?? null
  const computedName = selectedPlan?.name?.trim() || planNameCustom.trim()
  const endDate = addMonthsToISODate(startDate, BILLING_PERIOD_MONTHS[billing])
  const amountNumber = amount.trim() === '' ? null : Number(amount.replace(',', '.'))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!computedName) {
      toast.error('Elegí un plan o escribí un nombre.')
      return
    }
    if (amount.trim() !== '' && (amountNumber == null || Number.isNaN(amountNumber) || amountNumber < 0)) {
      toast.error('El monto no es válido.')
      return
    }
    setSubmitting(true)

    let res
    if (isEdit && editAssignment) {
      res = await updateAssignment(editAssignment.id, {
        web_plan_slug: planSlug || null,
        plan_name_snapshot: computedName,
        billing_period: billing,
        start_date: startDate,
        end_date: endDate,
        payment_method: paymentMethod || null,
        amount: amountNumber,
        notes: notes.trim() || null,
      })
    } else {
      res = await createAssignment({
        studentId,
        webPlanSlug: planSlug || null,
        planNameSnapshot: computedName,
        billingPeriod: billing,
        startDate,
        paymentMethod: paymentMethod || null,
        amount: amountNumber,
        notes: notes.trim() || null,
      })
    }
    setSubmitting(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success(isEdit ? 'Plan actualizado' : 'Plan asignado')
    onAssigned()
    onClose()
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[10060] bg-zinc-900/40 backdrop-blur-[2px] dark:bg-zinc-950/60"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal
        className={cn(
          'fixed left-1/2 top-1/2 z-[10061] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2',
          'max-h-[90vh] overflow-y-auto',
          'rounded-2xl border border-surface-border bg-surface-card shadow-2xl',
        )}
      >
        <div className="flex items-start justify-between border-b border-surface-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink-primary">
              {isEdit ? 'Editar asignación' : 'Asignar plan'}
            </h2>
            <p className="text-xs text-ink-muted">
              {isEdit ? 'Modificá los datos de esta asignación.' : 'Crea una asignación nueva con fechas y método de pago.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-elevated hover:text-ink-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-secondary">Plan</label>
            <select
              value={planSlug}
              onChange={(e) => setPlanSlug(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface-input px-3 py-2 text-sm text-ink-primary"
              disabled={loadingPlans}
            >
              <option value="">— Sin plan del catálogo (personalizado) —</option>
              {plans.map((p) => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>
          </div>

          {!planSlug ? (
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-secondary">Nombre del plan</label>
              <input
                type="text"
                value={planNameCustom}
                onChange={(e) => setPlanNameCustom(e.target.value)}
                placeholder="Ej: Plan personalizado entrenamiento"
                className="w-full rounded-lg border border-surface-border bg-surface-input px-3 py-2 text-sm text-ink-primary"
                maxLength={120}
              />
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-secondary">Período</label>
            <div className="grid grid-cols-2 gap-2">
              {BILLING_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setBilling(opt)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                    billing === opt
                      ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                      : 'border-surface-border text-ink-secondary hover:border-ink-muted',
                  )}
                >
                  {BILLING_PERIOD_LABELS[opt]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-secondary">Inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value || todayISO())}
                className="w-full rounded-lg border border-surface-border bg-surface-input px-3 py-2 text-sm text-ink-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-secondary">Vencimiento (auto)</label>
              <input
                type="date"
                value={endDate}
                readOnly
                disabled
                className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-ink-muted"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-secondary">Monto (opcional)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ej: 50000"
                className="w-full rounded-lg border border-surface-border bg-surface-input px-3 py-2 text-sm text-ink-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-secondary">Método de pago</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PlanPaymentMethod | '')}
                className="w-full rounded-lg border border-surface-border bg-surface-input px-3 py-2 text-sm text-ink-primary"
              >
                <option value="">— Sin especificar —</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-secondary">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Ej: pagó por transferencia el día 12"
              className="w-full rounded-lg border border-surface-border bg-surface-input px-3 py-2 text-sm text-ink-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting}>
              {submitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Asignar plan'}
            </Button>
          </div>
        </form>
      </div>
    </>,
    document.body,
  )
}
