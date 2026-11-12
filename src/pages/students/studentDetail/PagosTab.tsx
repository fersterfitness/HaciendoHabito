import { controlSmClassName } from '@/lib/formControlClasses'
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
import { saveStudentPaymentWindow } from '@/lib/finance/routineIncome'
import { paymentWindowLabel } from '@/lib/finance/studentPayments'
import { IS_V2 } from '@/lib/uiVersion'
import { StatTile, StatusPill } from './StatTile'

export function PagosTab({
  studentId,
  studentName,
  monthlyFee,
  onMonthlyFeeChange,
  onRegisterPago,
  paymentDayFrom = null,
  paymentDayTo = null,
}: {
  studentId: string
  studentName: string
  monthlyFee: number | null
  onMonthlyFeeChange: (amount: number | null) => void
  onRegisterPago: () => void
  /** Ventana de pago mensual (ej. del 1 al 5). */
  paymentDayFrom?: number | null
  paymentDayTo?: number | null
}) {
  const { user } = useAuthStore()
  const [payments, setPayments] = useState<Income[]>([])
  const [loading, setLoading]   = useState(true)

  const [cuota, setCuota] = useState<number | null>(monthlyFee)
  const [editingCuota, setEditingCuota] = useState(false)
  const [cuotaInput, setCuotaInput] = useState('')
  const [savingCuota, setSavingCuota] = useState(false)

  const [dayFrom, setDayFrom] = useState<number | null>(paymentDayFrom)
  const [dayTo, setDayTo] = useState<number | null>(paymentDayTo)
  const [editingWindow, setEditingWindow] = useState(false)
  const [fromInput, setFromInput] = useState('')
  const [savingWindow, setSavingWindow] = useState(false)

  async function saveWindow() {
    const parse = (v: string) => {
      const n = Math.round(Number(v))
      return v.trim() && n >= 1 && n <= 31 ? n : null
    }
    // Un solo día de pago (se guarda como ventana de un día).
    const f = parse(fromInput)
    const t = f
    setSavingWindow(true)
    const err = await saveStudentPaymentWindow(studentId, f, t)
    setSavingWindow(false)
    if (err) {
      toast.error(err)
      return
    }
    setDayFrom(f)
    setDayTo(t)
    setEditingWindow(false)
    toast.success(f == null ? 'Día de pago quitado' : 'Día de pago guardado')
  }

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
  const ultimoPago = payments.find((p) => p.status === 'cobrado')

  const METHOD_LABEL: Record<string, string> = Object.fromEntries(
    PAYMENT_METHODS.map((m) => [m.value, m.label]),
  ) as Record<string, string>

  if (IS_V2) {
    const totalEsteMes = payments
      .filter((p) => p.status === 'cobrado' && p.income_date.startsWith(thisMonthKey))
      .reduce((sum, p) => sum + p.amount, 0)
    const hasDay = dayFrom != null || dayTo != null
    const smallAction = (label: string, onClick: () => void) => (
      <Button type="button" variant="ghost" size="sm" className="-mr-2" onClick={onClick}>
        {label}
      </Button>
    )
    return (
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <StatTile
            label="Cuota mensual"
            value={editingCuota ? undefined : cuota ? formatCurrency(cuota) : '—'}
            hint={editingCuota ? undefined : cuota ? 'por mes' : 'Definila para seguir los cobros'}
            action={
              editingCuota
                ? null
                : smallAction(cuota ? 'Cambiar' : 'Definir', () => {
                    setCuotaInput(String(cuota ?? ''))
                    setEditingCuota(true)
                  })
            }
          >
            {editingCuota ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  step={100}
                  autoFocus
                  aria-label="Cuota mensual en pesos"
                  value={cuotaInput}
                  onChange={(e) => setCuotaInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void saveCuota()}
                  placeholder="Ej: 60000"
                  className={cn(controlSmClassName, 'w-28 px-3 text-sm tabular-nums')}
                />
                <Button size="sm" loading={savingCuota} onClick={() => void saveCuota()}>
                  Guardar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingCuota(false)}>
                  Cancelar
                </Button>
              </div>
            ) : null}
          </StatTile>

          <StatTile label="Este mes">
            <div className="py-1">
              <StatusPill ok={pagadoEsteMes}>{pagadoEsteMes ? 'Al día' : 'Pendiente'}</StatusPill>
            </div>
            <p className="text-xs text-ink-muted">
              {cuota && totalEsteMes > 0 && totalEsteMes < cuota
                ? `Cobrado ${formatCurrency(totalEsteMes)} de ${formatCurrency(cuota)}`
                : pagadoEsteMes
                  ? `Cobrado ${formatCurrency(totalEsteMes)}`
                  : 'Todavía sin cobros'}
            </p>
          </StatTile>

          <StatTile
            label="Día de pago"
            value={editingWindow ? undefined : hasDay ? paymentWindowLabel(dayFrom, dayTo) : '—'}
            hint={editingWindow ? undefined : hasDay ? 'de cada mes' : 'Cargalo y el Inicio te avisa'}
            action={
              editingWindow
                ? null
                : smallAction(hasDay ? 'Cambiar' : 'Definir', () => {
                    setFromInput(dayTo != null ? String(dayTo) : dayFrom != null ? String(dayFrom) : '')
                    setEditingWindow(true)
                  })
            }
          >
            {editingWindow ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={31}
                  autoFocus
                  aria-label="Día del mes"
                  value={fromInput}
                  onChange={(e) => setFromInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void saveWindow()}
                  className={cn(controlSmClassName, 'w-16 px-2 text-sm tabular-nums')}
                />
                <Button size="sm" loading={savingWindow} onClick={() => void saveWindow()}>
                  Guardar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingWindow(false)}>
                  Cancelar
                </Button>
              </div>
            ) : null}
          </StatTile>

          <StatTile
            label="Total cobrado"
            value={formatCurrency(totalCobrado)}
            hint={ultimoPago ? `Último pago: ${formatDate(ultimoPago.income_date)}` : 'Sin pagos todavía'}
          />
        </div>

        <section>
          <div className="flex items-center justify-between gap-3 pb-2">
            <h3 className="text-sm font-semibold text-ink-primary">Historial de pagos</h3>
            <Button size="sm" icon={<DollarSign className="h-3.5 w-3.5" />} onClick={onRegisterPago}>
              Registrar pago
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner size="md" />
            </div>
          ) : payments.length === 0 ? (
            <EmptyState
              icon={<DollarSign className="h-6 w-6" />}
              title="Sin pagos registrados"
              description={`${studentName} todavía no tiene pagos cargados.`}
            />
          ) : (
            <ul className="divide-y divide-surface-border/60">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <span className="w-20 shrink-0 text-body-sm tabular-nums text-ink-muted">{formatDate(p.income_date)}</span>
                  <span className="w-24 shrink-0 text-sm font-semibold tabular-nums text-ink-primary">{formatCurrency(p.amount)}</span>
                  <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                    <span className="rounded-md bg-surface-elevated px-2 py-0.5 text-xs font-medium capitalize text-ink-secondary">{p.income_type}</span>
                    <span className="rounded-md bg-surface-elevated px-2 py-0.5 text-xs font-medium capitalize text-ink-secondary">
                      {METHOD_LABEL[p.payment_method] ?? p.payment_method}
                    </span>
                  </span>
                  <StatusPill ok={p.status === 'cobrado'}>{incomeStatusPhrase(p.status)}</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Cuota mensual ── */}
      <div className="border-b border-surface-border/60 pb-4 ">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-semibold text-ink-secondary  ">Plan de cuota mensual</p>
          {!editingCuota && (
            <button
              type="button"
              onClick={() => { setCuotaInput(String(cuota ?? '')); setEditingCuota(true) }}
              className="text-2xs font-semibold text-ink-secondary underline-offset-4 hover:text-ink-primary hover:underline "
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
              className={cn(controlSmClassName, 'w-36 text-sm px-3')}
            />
            <Button size="sm" variant="secondary" loading={savingCuota} onClick={() => void saveCuota()}>
              Guardar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditingCuota(false)}>Cancelar</Button>
          </div>
        ) : cuota ? (
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-ink-primary ">{formatCurrency(cuota)}<span className="ml-1 text-sm font-normal text-ink-muted">/ mes</span></p>
            {(() => {
              const now = new Date()
              const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
              const pagadoEsteMes = payments.some((p) => p.status === 'cobrado' && p.income_date.startsWith(thisMonthKey))
              const totalEsteMes = payments.filter((p) => p.status === 'cobrado' && p.income_date.startsWith(thisMonthKey)).reduce((s, p) => s + p.amount, 0)
              return (
                <div className="text-right">
                  {pagadoEsteMes ? (
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Pagó este mes</p>
                  ) : (
                    <p className="text-sm font-medium text-status-expiring">Pendiente de cobro</p>
                  )}
                  {totalEsteMes > 0 && totalEsteMes < cuota && (
                    <p className="text-2xs text-ink-muted mt-0.5">Cobrado: {formatCurrency(totalEsteMes)} / {formatCurrency(cuota)}</p>
                  )}
                </div>
              )
            })()}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">Sin cuota configurada — establecé el monto mensual para seguimiento automático.</p>
        )}
      </div>

      {/* Día de pago: ese día sale el aviso en Inicio y a los 7 días hábiles sin pago, el segundo */}
      <div className="border-b border-surface-border/60 pb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-ink-secondary">Día de pago</p>
          {!editingWindow ? (
            <button
              type="button"
              onClick={() => {
                setFromInput(dayTo != null ? String(dayTo) : dayFrom != null ? String(dayFrom) : '')
                setEditingWindow(true)
              }}
              className="text-2xs font-semibold text-ink-secondary underline-offset-4 hover:text-ink-primary hover:underline"
            >
              {dayFrom != null || dayTo != null ? 'Modificar' : 'Configurar'}
            </button>
          ) : null}
        </div>
        {editingWindow ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-secondary">
            El día
            <input
              type="number"
              min={1}
              max={31}
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
              className={cn(controlSmClassName, 'w-16 px-2 text-sm tabular-nums')}
              autoFocus
            />
            de cada mes
            <Button size="sm" variant="secondary" loading={savingWindow} onClick={() => void saveWindow()}>
              Guardar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditingWindow(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <p className="text-sm text-ink-primary">
            {paymentWindowLabel(dayFrom, dayTo)}
            {dayFrom == null && dayTo == null ? (
              <span className="ml-1 text-ink-muted">— cargalo para que Inicio te avise cuando le toca pagar.</span>
            ) : (
              <span className="ml-1 text-ink-muted">de cada mes</span>
            )}
          </p>
        )}
      </div>

      {/* Estado de cuenta */}
      <div className="grid grid-cols-3 gap-px overflow-hidden border border-surface-border/70 bg-surface-border/70 [html.ui-v2_&]:rounded-2xl">
        <div className="bg-surface-elevated/60 px-3 py-3 text-center ">
          <p className="mb-1 text-3xs font-semibold text-ink-muted">Total cobrado</p>
          <p className="text-lg font-bold text-ink-primary ">{formatCurrency(totalCobrado)}</p>
        </div>
        <div className="bg-surface-elevated/60 px-3 py-3 text-center ">
          <p className="mb-1 text-3xs font-semibold text-ink-muted">Este mes</p>
          <p
            className={cn(
              'text-sm font-medium',
              pagadoEsteMes ? 'text-emerald-700 dark:text-emerald-400' : 'text-status-expiring',
            )}
          >
            {pagadoEsteMes ? 'Al día' : 'Pendiente'}
          </p>
        </div>
        <div className="bg-surface-elevated/60 px-3 py-3 text-center ">
          <p className="mb-1 text-3xs font-semibold text-ink-muted">Último pago</p>
          <p className="text-sm font-semibold text-ink-primary ">{ultimoPago ? formatDate(ultimoPago.income_date) : '—'}</p>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between gap-3 border-b border-surface-border/50 pb-3 ">
          <h3 className="text-sm font-semibold text-ink-primary ">Historial de pagos</h3>
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
          <ul className="divide-y divide-surface-border/55">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-primary">{formatCurrency(p.amount)}</p>
                  <p className="text-xs text-ink-muted">{p.income_type} · {METHOD_LABEL[p.payment_method] ?? p.payment_method}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium text-ink-secondary">{formatDate(p.income_date)}</p>
                  <p className={cn('text-2xs font-medium', incomeLedgerStatusClass(p.status))}>
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

