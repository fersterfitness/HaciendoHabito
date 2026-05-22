import { useEffect, useState } from 'react'
import { DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { PAYMENT_METHODS } from '@/lib/constants'
import { updateStudentTrainerPrefs } from '@/lib/students/studentTrainerPrefs'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type { Income } from '@/types/database'
import { incomeLedgerStatusClass, incomeStatusPhrase } from '@/pages/students/studentDetail/incomeUi'

export function PagosTab({
  studentId,
  studentName,
  monthlyFee,
  onMonthlyFeeChange,
  onRegisterPago,
}: {
  studentId: string
  studentName: string
  monthlyFee: number | null
  onMonthlyFeeChange: (amount: number | null) => void
  onRegisterPago: () => void
}) {
  const { user } = useAuthStore()
  const [payments, setPayments] = useState<Income[]>([])
  const [loading, setLoading]   = useState(true)

  const [cuota, setCuota] = useState<number | null>(monthlyFee)
  const [editingCuota, setEditingCuota] = useState(false)
  const [cuotaInput, setCuotaInput] = useState('')
  const [savingCuota, setSavingCuota] = useState(false)

  useEffect(() => {
    setCuota(monthlyFee)
  }, [monthlyFee])

  async function saveCuota() {
    const n = parseFloat(cuotaInput)
    const next = !isNaN(n) && n > 0 ? n : null
    setSavingCuota(true)
    const err = await updateStudentTrainerPrefs(studentId, { monthly_fee_amount: next })
    setSavingCuota(false)
    if (err) {
      toast.error(err)
      return
    }
    setCuota(next)
    onMonthlyFeeChange(next)
    setEditingCuota(false)
    toast.success(next == null ? 'Cuota quitada' : 'Cuota guardada', { id: 'monthly-fee' })
  }

  useEffect(() => {
    if (!user) return
    supabase
      .from('income')
      .select('*')
      .eq('owner_id', user.id)
      .eq('student_id', studentId)
      .order('income_date', { ascending: false })
      .then(({ data }) => { setPayments((data as Income[]) ?? []); setLoading(false) })
  }, [user, studentId])

  const totalCobrado  = payments.filter((p) => p.status === 'cobrado').reduce((s, p) => s + p.amount, 0)
  const now           = new Date()
  const thisMonthKey  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const pagadoEsteMes = payments.some((p) => p.status === 'cobrado' && p.income_date.startsWith(thisMonthKey))
  const ultimoPago    = payments.find((p) => p.status === 'cobrado')

  const METHOD_LABEL: Record<string, string> = Object.fromEntries(
    PAYMENT_METHODS.map((m) => [m.value, m.label]),
  ) as Record<string, string>

  return (
    <div className="space-y-4">
      {/* ── Cuota mensual ── */}
      <div className="border-b border-zinc-200/60 pb-4 dark:border-zinc-800/60">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wide dark:text-zinc-400">Plan de cuota mensual</p>
          {!editingCuota && (
            <button
              type="button"
              onClick={() => { setCuotaInput(String(cuota ?? '')); setEditingCuota(true) }}
              className="text-[11px] font-semibold text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              {cuota ? 'Modificar' : 'Configurar'}
            </button>
          )}
        </div>
        {editingCuota ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-muted">$</span>
            <input
              type="number"
              min={0}
              step={100}
              autoFocus
              value={cuotaInput}
              onChange={(e) => setCuotaInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveCuota()}
              placeholder="Ej: 15000"
              className="w-36 rounded-xl border border-zinc-300 bg-zinc-50 text-ink-primary text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400/40 dark:border-zinc-600 dark:bg-zinc-950/50"
            />
            <Button size="sm" variant="secondary" loading={savingCuota} onClick={() => void saveCuota()}>
              Guardar
            </Button>
            <button onClick={() => setEditingCuota(false)} className="text-xs text-ink-muted hover:text-ink-secondary">Cancelar</button>
          </div>
        ) : cuota ? (
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{formatCurrency(cuota)}<span className="ml-1 text-sm font-normal text-zinc-500">/ mes</span></p>
            {(() => {
              const now = new Date()
              const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
              const pagadoEsteMes = payments.some((p) => p.status === 'cobrado' && p.income_date.startsWith(thisMonthKey))
              const totalEsteMes  = payments.filter((p) => p.status === 'cobrado' && p.income_date.startsWith(thisMonthKey)).reduce((s, p) => s + p.amount, 0)
              return (
                <div className="text-right">
                  {pagadoEsteMes ? (
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Pagó este mes</p>
                  ) : (
                    <p className="text-sm font-medium text-status-expiring">Pendiente de cobro</p>
                  )}
                  {totalEsteMes > 0 && totalEsteMes < cuota && (
                    <p className="text-[11px] text-ink-muted mt-0.5">Cobrado: {formatCurrency(totalEsteMes)} / {formatCurrency(cuota)}</p>
                  )}
                </div>
              )
            })()}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">Sin cuota configurada — establecé el monto mensual para seguimiento automático.</p>
        )}
      </div>

      {/* Estado de cuenta */}
      <div className="grid grid-cols-3 gap-px border border-zinc-200/70 bg-zinc-200/70 dark:border-zinc-800 dark:bg-zinc-800">
        <div className="bg-zinc-50 px-3 py-3 text-center dark:bg-zinc-950/50">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Total cobrado</p>
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{formatCurrency(totalCobrado)}</p>
        </div>
        <div className="bg-zinc-50 px-3 py-3 text-center dark:bg-zinc-950/50">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Este mes</p>
          <p
            className={cn(
              'text-sm font-medium',
              pagadoEsteMes ? 'text-emerald-700 dark:text-emerald-400' : 'text-status-expiring',
            )}
          >
            {pagadoEsteMes ? 'Al día' : 'Pendiente'}
          </p>
        </div>
        <div className="bg-zinc-50 px-3 py-3 text-center dark:bg-zinc-950/50">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Último pago</p>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{ultimoPago ? formatDate(ultimoPago.income_date) : '—'}</p>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200/50 pb-3 dark:border-zinc-800/50">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Historial de pagos</h3>
          <Button
            size="sm"
            variant="gradientSecondary"
            icon={<DollarSign className="h-3.5 w-3.5" />}
            onClick={onRegisterPago}
          >
            Registrar
          </Button>
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Spinner size="md" /></div>
        ) : payments.length === 0 ? (
          <EmptyState
            icon={<DollarSign className="h-6 w-6" />}
            title="Sin pagos registrados"
            description={`${studentName} todavía no tiene pagos cargados.`}
          />
        ) : (
          <ul className="divide-y divide-zinc-200/55 dark:divide-zinc-800/60">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{formatCurrency(p.amount)}</p>
                  <p className="text-xs text-zinc-500">{p.income_type} · {METHOD_LABEL[p.payment_method] ?? p.payment_method}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{formatDate(p.income_date)}</p>
                  <p className={cn('text-[11px] font-medium', incomeLedgerStatusClass(p.status))}>
                    {incomeStatusPhrase(p.status)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

