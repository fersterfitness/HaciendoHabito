import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addMonths, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Check, ChevronLeft, ChevronRight, Lock, Settings2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { PaymentMethodBadge } from '@/components/ui/PaymentMethodIcon'
import { MarkPaidModal, type MarkPaidValues } from '@/components/finances/MarkPaidModal'
import {
  buildPaymentBoard,
  monthKey,
  overduePaymentMessage,
  paymentWindowLabel,
  type PaymentState,
  type StudentPaymentRow,
} from '@/lib/finance/studentPayments'
import { registerStudentPayment, saveStudentPaymentWindow } from '@/lib/finance/routineIncome'
import { buildWhatsAppUrl, normalizePhoneForWhatsApp } from '@/lib/whatsapp'
import { controlMdClassName } from '@/lib/formControlClasses'
import { PAYMENT_METHODS } from '@/lib/constants'
import { cn, formatCurrency } from '@/lib/utils'
import type { Income, Student } from '@/types/database'

const STATE_META: Record<PaymentState, { label: string; chip: string; color: string }> = {
  pagado: { label: 'Pagó', chip: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300', color: '#10b981' },
  parcial: { label: 'Parcial', chip: 'bg-sky-500/12 text-sky-700 dark:text-sky-300', color: '#3b82f6' },
  pendiente: { label: 'Pendiente', chip: 'bg-amber-500/12 text-amber-700 dark:text-amber-300', color: '#f59e0b' },
  vencido: { label: 'Vencido', chip: 'bg-rose-500/12 text-rose-700 dark:text-rose-300', color: '#f43f5e' },
  sin_cargo: { label: 'Sin cargo', chip: 'bg-surface-elevated text-ink-muted', color: '#a1a1aa' },
}

/** Paleta categórica validada (claro/oscuro legibles sobre la tarjeta). */
const METHOD_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7', '#008300', '#e34948']
const METHOD_LABEL = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label])) as Record<string, string>

type Filter = 'all' | 'vencido' | 'pendiente' | 'pagado'

/**
 * Cobros del mes por alumno: quién pagó, cuánto y por qué medio; vencidos con WhatsApp directo.
 * Navegar a meses anteriores muestra el mes «cerrado» con lo que se generó.
 */
export function PaymentsBoard({ onChanged }: { onChanged?: () => void }) {
  const { user } = useAuthStore()
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [students, setStudents] = useState<Student[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [paying, setPaying] = useState<StudentPaymentRow | null>(null)
  const [windowFor, setWindowFor] = useState<StudentPaymentRow | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [stuRes, incRes] = await Promise.all([
      supabase.from('students').select('*').eq('owner_id', user.id).eq('status', 'activo').order('full_name'),
      supabase
        .from('income')
        .select('id, student_id, amount, status, income_date, payment_method, scope')
        .eq('owner_id', user.id)
        .eq('scope', 'business')
        .not('student_id', 'is', null),
    ])
    setLoading(false)
    if (stuRes.error || incRes.error) {
      toast.error((stuRes.error ?? incRes.error)!.message)
      return
    }
    setStudents((stuRes.data ?? []) as Student[])
    setIncomes((incRes.data ?? []) as Income[])
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const today = new Date()
  const isCurrentMonth = monthKey(month) === monthKey(today)
  const isPastMonth = month < new Date(today.getFullYear(), today.getMonth(), 1)

  const rows = useMemo(
    () => buildPaymentBoard({ students, incomes, month, today }).filter((r) => r.state !== 'sin_cargo' || r.dayTo != null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, incomes, month],
  )

  const totals = useMemo(() => {
    const cobrado = rows.reduce((a, r) => a + r.paid, 0)
    const esperado = rows.reduce((a, r) => a + Math.max(r.expected, r.paid), 0)
    const count = (s: PaymentState) => rows.filter((r) => r.state === s).length
    return { cobrado, esperado, pendiente: Math.max(0, esperado - cobrado), vencidos: count('vencido'), pagados: count('pagado') }
  }, [rows])

  const visible = rows.filter((r) =>
    filter === 'all' ? true : filter === 'pendiente' ? r.state === 'pendiente' || r.state === 'parcial' : r.state === filter,
  )

  const stateChart = (['pagado', 'parcial', 'pendiente', 'vencido'] as PaymentState[])
    .map((s) => ({ name: STATE_META[s].label, value: rows.filter((r) => r.state === s).length, color: STATE_META[s].color }))
    .filter((d) => d.value > 0)

  const methodChart = useMemo(() => {
    const key = monthKey(month)
    const byMethod = new Map<string, number>()
    for (const i of incomes) {
      if (i.status !== 'cobrado' || !i.income_date.startsWith(key)) continue
      byMethod.set(i.payment_method, (byMethod.get(i.payment_method) ?? 0) + Number(i.amount || 0))
    }
    return [...byMethod.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([m, v], idx) => ({ name: METHOD_LABEL[m] ?? m, value: v, color: METHOD_COLORS[idx % METHOD_COLORS.length] }))
  }, [incomes, month])

  const debtChart = rows
    .filter((r) => r.expected > r.paid)
    .map((r) => ({ name: r.fullName.split(' ')[0], full: r.fullName, value: r.expected - r.paid, state: r.state }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  async function confirmPayment(values: MarkPaidValues) {
    if (!user || !paying) return
    const err = await registerStudentPayment({
      ownerId: user.id,
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
    toast.success(`Cobro de ${paying.fullName.split(' ')[0]} registrado`)
    setPaying(null)
    await load()
    onChanged?.()
  }

  function waUrl(r: StudentPaymentRow): string | null {
    const digits = normalizePhoneForWhatsApp(r.phone)
    return digits ? buildWhatsAppUrl(digits, overduePaymentMessage(r.fullName)) : null
  }

  return (
    <section className="space-y-4">
      {/* Encabezado + navegación de meses (cada mes queda «cerrado» con lo generado) */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-2xs font-semibold uppercase tracking-widest text-ink-muted">Cobros de alumnos</p>
          <h2 className="flex items-center gap-2 text-lg font-semibold capitalize tracking-tight text-ink-primary">
            {format(month, "MMMM yyyy", { locale: es })}
            {isPastMonth ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-elevated px-2 py-0.5 text-3xs font-semibold normal-case text-ink-muted">
                <Lock className="h-3 w-3" /> Mes cerrado
              </span>
            ) : null}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="secondary" aria-label="Mes anterior" onClick={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {!isCurrentMonth ? (
            <Button size="sm" variant="ghost" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>
              Hoy
            </Button>
          ) : null}
          <Button
            size="icon"
            variant="secondary"
            aria-label="Mes siguiente"
            disabled={isCurrentMonth}
            onClick={() => setMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Resumen del mes */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile label="Cobrado" value={formatCurrency(totals.cobrado)} tone="success" />
        <SummaryTile label="Por cobrar" value={formatCurrency(totals.pendiente)} tone={totals.pendiente > 0 ? 'warning' : 'neutral'} />
        <SummaryTile label="Vencidos" value={String(totals.vencidos)} tone={totals.vencidos > 0 ? 'danger' : 'neutral'} />
        <div className="rounded-2xl border border-surface-border/90 bg-surface-card p-4 shadow-card">
          <p className="text-2xs font-semibold uppercase tracking-wider text-ink-muted">Cumplimiento</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink-primary sm:text-2xl">
            {totals.esperado > 0 ? Math.round((totals.cobrado / totals.esperado) * 100) : 0}%
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-border/70">
            <div
              className="h-full rounded-full bg-brand-gradient transition-[width] duration-500"
              style={{ width: `${totals.esperado > 0 ? Math.min(100, (totals.cobrado / totals.esperado) * 100) : 0}%` }}
            />
          </div>
          <p className="mt-1.5 text-3xs text-ink-muted">
            {totals.pagados} de {rows.length} alumnos al día
          </p>
        </div>
      </div>

      {/* Tablero por alumno */}
      <div className="overflow-hidden rounded-2xl border border-surface-border/90 bg-surface-card shadow-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-surface-border/70 px-4 py-3">
          <SegmentedControl
            size="sm"
            ariaLabel="Filtrar cobros"
            value={filter}
            onChange={(id) => setFilter(id as Filter)}
            items={[
              { id: 'all', label: 'Todos', count: rows.length },
              { id: 'vencido', label: 'Vencidos', count: totals.vencidos },
              {
                id: 'pendiente',
                label: 'Pendientes',
                count: rows.filter((r) => r.state === 'pendiente' || r.state === 'parcial').length,
              },
              { id: 'pagado', label: 'Pagaron', count: totals.pagados },
            ]}
          />
          <p className="ml-auto text-3xs text-ink-muted">
            Lo esperado sale de las rutinas con precio pendientes o, si no hay, de la cuota mensual del alumno.
          </p>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="hh-shimmer h-11 rounded-lg" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            {rows.length === 0
              ? 'Cargá la cuota mensual o el precio de la rutina de tus alumnos para ver los cobros acá.'
              : 'Nada en este filtro.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="hh-table w-full min-w-[760px] border-collapse text-body-sm">
              <thead className="border-b border-surface-border/70">
                <tr className="text-left">
                  {['Alumno', 'Paga', 'Debe', 'Cobrado', 'Estado', ''].map((h, i) => (
                    <th
                      key={h || i}
                      className={cn(
                        'px-4 py-2.5 text-3xs font-semibold uppercase tracking-wider text-ink-muted',
                        (h === 'Debe' || h === 'Cobrado') && 'text-right',
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/70">
                {visible.map((r) => {
                  const debt = Math.max(0, r.expected - r.paid)
                  const wa = r.state === 'vencido' || r.state === 'pendiente' || r.state === 'parcial' ? waUrl(r) : null
                  return (
                    <tr key={r.studentId}>
                      <td className="px-4 py-2.5">
                        <Link to={`/students/${r.studentId}`} className="font-semibold text-ink-primary hover:underline">
                          {r.fullName}
                        </Link>
                        {r.lastPaidAt ? (
                          <p className="text-3xs text-ink-muted">Último pago {format(new Date(`${r.lastPaidAt}T12:00:00`), 'd MMM', { locale: es })}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => setWindowFor(r)}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-ink-secondary hover:bg-surface-elevated hover:text-ink-primary"
                          title="Configurar días de pago"
                        >
                          {paymentWindowLabel(r.dayFrom, r.dayTo)}
                          <Settings2 className="h-3 w-3 opacity-60" />
                        </button>
                      </td>
                      <td className={cn('px-4 py-2.5 text-right tabular-nums', debt > 0 ? 'font-semibold text-ink-primary' : 'text-ink-muted')}>
                        {debt > 0 ? formatCurrency(debt) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="tabular-nums text-ink-primary">{r.paid > 0 ? formatCurrency(r.paid) : '—'}</span>
                        {r.methods.length ? (
                          <div className="mt-1 flex justify-end gap-1">
                            {r.methods.map((m) => (
                              <PaymentMethodBadge key={m} method={m} />
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-3xs font-semibold', STATE_META[r.state].chip)}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                          {STATE_META[r.state].label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {wa ? (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-600/30 px-2.5 text-2xs font-semibold text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                              title="Recordar el pago por WhatsApp"
                            >
                              <WhatsAppIcon className="h-3.5 w-3.5" />
                              Recordar
                            </a>
                          ) : null}
                          {debt > 0 ? (
                            <Button size="sm" variant="soft" icon={<Check className="h-3.5 w-3.5" />} onClick={() => setPaying(r)}>
                              Marcar pagado
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Análisis del mes */}
      {rows.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <ChartCard title="Estado de los alumnos">
            <DonutWithLegend data={stateChart} format={(v) => `${v} alumno${v === 1 ? '' : 's'}`} />
          </ChartCard>
          <ChartCard title="Cobrado por medio de pago">
            {methodChart.length ? (
              <DonutWithLegend data={methodChart} format={formatCurrency} />
            ) : (
              <p className="py-8 text-center text-xs text-ink-muted">Sin cobros este mes.</p>
            )}
          </ChartCard>
          <ChartCard title="Saldo pendiente por alumno">
            {debtChart.length ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={debtChart} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
                  <CartesianGrid horizontal={false} stroke="rgb(var(--surface-border))" />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={72}
                    tick={{ fontSize: 10, fill: 'rgb(var(--ink-muted))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgb(var(--surface-elevated))' }}
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="rounded-lg border border-surface-border bg-surface-elevated px-2.5 py-1.5 text-2xs shadow-md">
                          <p className="font-semibold text-ink-primary">{(payload[0].payload as { full: string }).full}</p>
                          <p className="text-ink-secondary">{formatCurrency(Number(payload[0].value))}</p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
                    {debtChart.map((d) => (
                      <Cell key={d.full} fill={d.state === 'vencido' ? STATE_META.vencido.color : STATE_META.pendiente.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-xs text-ink-muted">Nadie debe nada este mes.</p>
            )}
          </ChartCard>
        </div>
      ) : null}

      <MarkPaidModal
        open={!!paying}
        title={paying?.fullName ?? ''}
        subtitle={
          paying?.pendingIncomeIds.length
            ? 'Se marcan como cobradas sus rutinas pendientes.'
            : `Cuota de ${format(month, 'MMMM', { locale: es })}`
        }
        defaultAmount={paying ? Math.max(0, paying.expected - paying.paid) : null}
        amountLocked={!!paying?.pendingIncomeIds.length}
        onClose={() => setPaying(null)}
        onConfirm={confirmPayment}
      />

      <PaymentWindowModal
        row={windowFor}
        onClose={() => setWindowFor(null)}
        onSaved={() => {
          setWindowFor(null)
          void load()
        }}
      />
    </section>
  )
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }) {
  return (
    <div className="rounded-2xl border border-surface-border/90 bg-surface-card p-4 shadow-card">
      <p className="text-2xs font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-semibold tabular-nums sm:text-2xl',
          tone === 'success' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'warning' && 'text-status-expiring',
          tone === 'danger' && 'text-status-expired',
          tone === 'neutral' && 'text-ink-primary',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-surface-border/90 bg-surface-card p-4 shadow-card">
      <p className="mb-2 text-xs font-semibold text-ink-primary">{title}</p>
      {children}
    </div>
  )
}

function DonutWithLegend({
  data,
  format: fmt,
}: {
  data: { name: string; value: number; color: string }[]
  format: (v: number) => string
}) {
  const total = data.reduce((a, d) => a + d.value, 0)
  return (
    <div className="flex items-center gap-3">
      <div className="h-[150px] w-[150px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={2} stroke="rgb(var(--surface-card))" strokeWidth={2}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="rounded-lg border border-surface-border bg-surface-elevated px-2.5 py-1.5 text-2xs shadow-md">
                    <p className="font-semibold text-ink-primary">{payload[0].name}</p>
                    <p className="text-ink-secondary">{fmt(Number(payload[0].value))}</p>
                  </div>
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-2xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 truncate text-ink-secondary">{d.name}</span>
            <span className="tabular-nums text-ink-primary">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Días del mes en que el alumno paga; pasado el último sin cobro, figura vencido. */
function PaymentWindowModal({
  row,
  onClose,
  onSaved,
}: {
  row: StudentPaymentRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!row) return
    setFrom(row.dayFrom != null ? String(row.dayFrom) : '')
    setTo(row.dayTo != null ? String(row.dayTo) : '')
  }, [row])

  const toDay = (v: string) => {
    const n = Math.round(Number(v))
    return v.trim() && n >= 1 && n <= 31 ? n : null
  }

  async function save() {
    if (!row) return
    setSaving(true)
    const err = await saveStudentPaymentWindow(row.studentId, toDay(from), toDay(to) ?? toDay(from))
    setSaving(false)
    if (err) {
      toast.error(err)
      return
    }
    toast.success('Días de pago guardados')
    onSaved()
  }

  return (
    <Modal
      open={!!row}
      onClose={onClose}
      size="sm"
      eyebrow="Días de pago"
      title={row?.fullName}
      description="Ej: del 1 al 5 de cada mes. Si pasa el último día sin cobro registrado, aparece como vencido con el aviso por WhatsApp."
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" loading={saving} onClick={() => void save()}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-medium text-ink-secondary">
          Desde el día
          <input type="number" min={1} max={31} value={from} onChange={(e) => setFrom(e.target.value)} className={cn(controlMdClassName, 'mt-1 w-full')} />
        </label>
        <label className="text-xs font-medium text-ink-secondary">
          Hasta el día
          <input type="number" min={1} max={31} value={to} onChange={(e) => setTo(e.target.value)} className={cn(controlMdClassName, 'mt-1 w-full')} />
        </label>
      </div>
    </Modal>
  )
}
