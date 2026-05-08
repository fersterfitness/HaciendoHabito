import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Search,
  Pencil,
  Trash2,
  Download,
  MessageCircle,
  AlertCircle,
  StickyNote,
  ChevronDown,
} from 'lucide-react'
import { PaymentMethodBadge } from '@/components/ui/PaymentMethodIcon'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn, formatDate, formatCurrency } from '@/lib/utils'
import type { Income, Expense, Student } from '@/types/database'
import toast from 'react-hot-toast'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'
import { normalizePhoneForWhatsApp, buildWhatsAppUrl } from '@/lib/whatsapp'
import { FINANCE_SCOPES } from '@/lib/constants'

type IncomeWithStudent = Income & { student?: Pick<Student, 'full_name'> }
type Tab = 'income' | 'expenses'

const MES_LABELS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const METHOD_LABEL: Record<string, string> = {
  efectivo_ars: 'Efectivo',
  efectivo_debito: 'Efectivo / Débito',
  cuenta_dni: 'Cuenta DNI',
  mercadopago: 'MercadoPago',
  debito: 'Débito',
  tarjeta_credito: 'Crédito',
  transferencia: 'Transferencia',
  otro: 'Otro',
}

const STATUS_CSV_LABEL: Record<string, string> = {
  cobrado: 'Cobrado',
  pendiente: 'Pendiente',
  cancelado: 'Cancelado',
}

const EXPENSE_TYPE_LABEL_CSV: Record<string, string> = {
  fijo: 'Fijo',
  variable: 'Variable',
}

function paymentMethodLabel(m: string): string {
  return METHOD_LABEL[m] ?? m.replace(/_/g, ' / ')
}

function buildPaymentReminderWaUrl(phone: string | null | undefined, studentName: string, amount: number, mesLabel: string): string | null {
  const digits = normalizePhoneForWhatsApp(phone)
  if (!digits) return null
  const msg = [
    `Hola ${studentName}, te recuerdo que la cuota de ${mesLabel} está pendiente.`,
    '',
    `Monto: ${formatCurrency(amount)}`,
    '',
    'Cualquier consulta sobre el método de pago, avisame. Gracias!',
  ].join('\n')
  return buildWhatsAppUrl(digits, msg)
}

function expenseTypePillClass(expenseType: string): string {
  const base = 'inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide'
  if (expenseType === 'fijo') {
    return cn(
      base,
      'border-zinc-400/55 bg-zinc-500/10 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-600/15 dark:text-zinc-400',
    )
  }
  return cn(
    base,
    'border-status-expiring/45 bg-status-expiring/15 text-status-expiring',
  )
}

function MetricTile({
  label,
  value,
  valueClassName,
  containerClassName,
}: {
  label: string
  value: string
  valueClassName?: string
  containerClassName?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-md border border-zinc-200/70 bg-surface-card p-3 shadow-none dark:border-zinc-700/65 lg:p-3.5',
        containerClassName,
      )}
    >
      <p className="text-[11px] font-medium text-ink-muted">{label}</p>
      <p className={cn('text-lg font-semibold tracking-tight tabular-nums sm:text-xl', valueClassName ?? 'text-ink-primary')}>
        {value}
      </p>
    </div>
  )
}

/** Tooltip propio — Recharts suele usar labels oscuros ilegibles; acá definimos texto explícito. */
function AnnualIncomeTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ value?: unknown }>
  label?: unknown
}) {
  if (!active || !payload?.length) return null
  const raw = payload[0]?.value
  const value =
    typeof raw === 'number' ? raw : Number(typeof raw === 'string' ? raw.replace(',', '.') : raw ?? NaN)

  const safeLabel = label != null ? String(label) : '—'

  return (
    <div className="pointer-events-none min-w-[7.5rem] rounded-md border border-zinc-200 bg-white px-3 py-2 text-left shadow-lg dark:border-zinc-600 dark:bg-zinc-950">
      <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-50">{safeLabel}</p>
      <p className="mt-1 font-semibold tabular-nums leading-tight text-[13px] text-brand-tertiary">
        {Number.isFinite(value) ? formatCurrency(value) : formatCurrency(0)}
      </p>
      <p className="mt-1.5 border-t border-zinc-200 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        Ingresos cobrados
      </p>
    </div>
  )
}

export function FinancesPage() {
  const navigate = useAppNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuthStore()

  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) === 'expenses' ? 'expenses' : 'income')
  const [incomes, setIncomes] = useState<IncomeWithStudent[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [scopeFilter, setScopeFilter] = useState<'all' | 'business' | 'personal'>('business')

  const [deleteIncomeTarget, setDeleteIncomeTarget] = useState<IncomeWithStudent | null>(null)
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [
        { data: incomeData, error: incomeErr },
        { data: expenseData, error: expenseErr },
        { data: studentData },
      ] = await Promise.all([
        supabase.from('income').select('*, student:students(full_name)').eq('owner_id', user.id).order('income_date', { ascending: false }),
        supabase.from('expenses').select('*').eq('owner_id', user.id).order('expense_date', { ascending: false }),
        supabase.from('students').select('id, full_name, phone, status').eq('owner_id', user.id).eq('status', 'activo'),
      ])
      if (incomeErr) toast.error(incomeErr.message)
      else setIncomes((incomeData as unknown as IncomeWithStudent[]) ?? [])
      if (expenseErr) toast.error(expenseErr.message)
      else setExpenses(expenseData ?? [])
      setStudents((studentData as Student[]) ?? [])
    } finally {
      setLoading(false)
    }
  }, [user])

  const incomesFiltered = incomes.filter((i) => {
    if (scopeFilter === 'all') return true
    return (i.scope ?? 'business') === scopeFilter
  })

  const expensesFiltered = expenses.filter((e) => {
    if (scopeFilter === 'all') return true
    return (e.scope ?? 'business') === scopeFilter
  })

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'expenses' || t === 'income') setTab(t)
  }, [searchParams])

  function switchTab(t: Tab) {
    setTab(t)
    setSearch('')
    setSearchParams({ tab: t })
  }

  async function handleDeleteIncome() {
    if (!deleteIncomeTarget || !user) return
    setDeleting(true)
    const { error } = await supabase.from('income').delete().eq('id', deleteIncomeTarget.id).eq('owner_id', user.id)
    setDeleting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Ingreso eliminado')
    setDeleteIncomeTarget(null)
    fetchAll()
  }

  async function handleDeleteExpense() {
    if (!deleteExpenseTarget || !user) return
    setDeleting(true)
    const { error } = await supabase.from('expenses').delete().eq('id', deleteExpenseTarget.id).eq('owner_id', user.id)
    setDeleting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Gasto eliminado')
    setDeleteExpenseTarget(null)
    fetchAll()
  }

  const totalIngresos = incomesFiltered.filter((i) => i.status === 'cobrado').reduce((s, i) => s + i.amount, 0)
  const totalPendiente = incomesFiltered.filter((i) => i.status === 'pendiente').reduce((s, i) => s + i.amount, 0)
  const totalGastos = expensesFiltered.reduce((s, e) => s + e.amount, 0)
  const balance = totalIngresos - totalGastos

  const now = new Date()
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`
  const MES_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const thisMesTotal = incomesFiltered
    .filter((i) => i.status === 'cobrado' && i.income_date.startsWith(thisMonthKey))
    .reduce((s, i) => s + i.amount, 0)
  const prevMesTotal = incomesFiltered
    .filter((i) => i.status === 'cobrado' && i.income_date.startsWith(prevMonthKey))
    .reduce((s, i) => s + i.amount, 0)
  const mesDelta = prevMesTotal > 0 ? Math.round(((thisMesTotal - prevMesTotal) / prevMesTotal) * 100) : null

  const deudores = students
    .map((s) => {
      const raw = localStorage.getItem(`cuota_mensual_${s.id}`)
      if (!raw) return null
      const cuota = Number(raw)
      const paid = incomesFiltered
        .filter((i) => i.status === 'cobrado' && i.student_id === s.id && i.income_date.startsWith(thisMonthKey))
        .reduce((sum, i) => sum + i.amount, 0)
      if (paid >= cuota) return null
      return { student: s, cuota, paid, pending: cuota - paid }
    })
    .filter(Boolean) as { student: Student; cuota: number; paid: number; pending: number }[]

  const annualChartData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const total = incomesFiltered
      .filter((inc) => inc.status === 'cobrado' && inc.income_date.startsWith(key))
      .reduce((s, inc) => s + inc.amount, 0)
    return { mes: MES_LABELS[d.getMonth()], total, isCurrent: key === thisMonthKey }
  })

  const filteredIncomes = incomesFiltered.filter(
    (i) =>
      i.description.toLowerCase().includes(search.toLowerCase()) ||
      (i.student?.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase()) ||
      i.income_type.toLowerCase().includes(search.toLowerCase()),
  )
  const filteredExpenses = expensesFiltered.filter(
    (e) =>
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase()) ||
      (e.subcategory ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  function exportCSV() {
    const isIncome = tab === 'income'
    const rows = isIncome
      ? [
          ['Fecha', 'Monto', 'Estado', 'Alumno', 'Tipo', 'Categoría', 'Método de pago', 'Descripción', 'Notas'],
          ...filteredIncomes.map((i) => [
            i.income_date,
            String(i.amount),
            STATUS_CSV_LABEL[i.status] ?? i.status,
            i.student?.full_name ?? '',
            i.income_type,
            i.category,
            METHOD_LABEL[i.payment_method] ?? i.payment_method,
            i.description,
            i.notes ?? '',
          ]),
        ]
      : [
          ['Fecha', 'Monto', 'Tipo', 'Descripción', 'Categoría', 'Subcategoría', 'Método de pago', 'Notas'],
          ...filteredExpenses.map((e) => [
            e.expense_date,
            String(e.amount),
            EXPENSE_TYPE_LABEL_CSV[e.expense_type] ?? e.expense_type,
            e.description,
            e.category,
            e.subcategory ?? '',
            METHOD_LABEL[e.payment_method] ?? e.payment_method,
            e.notes ?? '',
          ]),
        ]
    const csv = 'sep=;\n' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${isIncome ? 'ingresos' : 'gastos'}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  /** Rejilla neutra · barras en verdes (actual un poco más intenso) */
  const chartGridStroke = 'rgba(113, 113, 122, 0.18)'
  const barFillDefault = 'rgba(255, 79, 234, 0.70)' // brand.tertiary
  const barFillCurrent = 'rgba(255, 79, 234, 0.95)' // brand.tertiary (current)

  return (
    <div>
      <Header title="Finanzas" />

      <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-5 lg:px-6 lg:py-6">
        {/* KPI */}
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
          <MetricTile
            label="Balance neto"
            value={formatCurrency(balance)}
            valueClassName={
              balance >= 0
                ? 'text-status-generated'
                : 'text-status-expired'
            }
            containerClassName={balance < 0 ? 'border-status-expired/35 bg-status-expired/10' : undefined}
          />
          <MetricTile label="Cobrado total" value={formatCurrency(totalIngresos)} />
          <MetricTile
            label="Pendiente"
            value={formatCurrency(totalPendiente)}
            valueClassName="text-status-pending"
            containerClassName="border-status-pending/35 bg-status-pending/10"
          />
          <MetricTile label="Total gastos" value={formatCurrency(totalGastos)} />
        </div>

        {/* Comparación mensual */}
        <div className="grid grid-cols-2 gap-2.5 lg:gap-3">
          <div className="flex flex-col gap-1 rounded-md border border-zinc-200/70 bg-surface-card p-3 dark:border-zinc-700/65">
            <p className="text-[11px] font-medium text-ink-muted">
              {MES_LABELS[now.getMonth()]} cobrado
              {mesDelta !== null && (
                <span
                  className={cn(
                    'ml-2 font-semibold tabular-nums',
                    mesDelta >= 0
                      ? 'text-status-generated'
                      : 'text-status-expired',
                  )}
                >
                  {mesDelta >= 0 ? '+' : ''}
                  {mesDelta}%
                </span>
              )}
            </p>
            <p className="text-lg font-semibold tracking-tight text-ink-primary tabular-nums sm:text-xl">
              {formatCurrency(thisMesTotal)}
            </p>
          </div>
          <div className="flex flex-col gap-1 rounded-md border border-zinc-200/70 bg-surface-card p-3 dark:border-zinc-700/65">
            <p className="text-[11px] font-medium text-ink-muted">{MES_LABELS[prevMonthDate.getMonth()]} cobrado</p>
            <p className="text-lg font-semibold tracking-tight text-ink-secondary tabular-nums sm:text-xl">
              {formatCurrency(prevMesTotal)}
            </p>
          </div>
        </div>

        {/* Tabs (estilo rutinas / listados) */}
        <div className="flex gap-2 border-b border-zinc-200/70 pt-1 dark:border-zinc-700/65">
          <button
            type="button"
            onClick={() => switchTab('income')}
            className={cn(
              '-mb-px flex items-center gap-2 rounded-t-lg border border-b-0 px-4 py-2.5 text-sm font-semibold transition-colors',
              tab === 'income'
                ? 'border-zinc-200/85 bg-surface-card text-ink-primary dark:border-zinc-700/80 dark:bg-zinc-950/50'
                : 'border-transparent text-ink-muted hover:bg-zinc-50/80 hover:text-ink-secondary dark:hover:bg-zinc-900/40',
            )}
          >
            <TrendingUp className="h-4 w-4 shrink-0" aria-hidden />
            Ingresos
            <span
              className={cn(
                'rounded-md px-1.5 py-px text-[10px] font-bold tabular-nums',
                tab === 'income' ? 'bg-zinc-200/80 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100' : 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
              )}
            >
              {incomesFiltered.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => switchTab('expenses')}
            className={cn(
              '-mb-px flex items-center gap-2 rounded-t-lg border border-b-0 px-4 py-2.5 text-sm font-semibold transition-colors',
              tab === 'expenses'
                ? 'border-zinc-200/85 bg-surface-card text-ink-primary dark:border-zinc-700/80 dark:bg-zinc-950/50'
                : 'border-transparent text-ink-muted hover:bg-zinc-50/80 hover:text-ink-secondary dark:hover:bg-zinc-900/40',
            )}
          >
            <TrendingDown className="h-4 w-4 shrink-0" aria-hidden />
            Gastos
            <span
              className={cn(
                'rounded-md px-1.5 py-px text-[10px] font-bold tabular-nums',
                tab === 'expenses' ? 'bg-zinc-200/80 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100' : 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
              )}
            >
              {expensesFiltered.length}
            </span>
          </button>
        </div>

        {/* Búsqueda + acciones (como otros módulos) */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
          <div className="min-h-10 min-w-0 flex-1">
            <Input
              placeholder={
                tab === 'income' ? 'Buscar por alumno, tipo, categoría...' : 'Buscar por descripción o categoría...'
              }
              leftIcon={<Search className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={tab === 'income' ? 'Buscar ingresos' : 'Buscar gastos'}
              className={cn(
                'h-10 rounded-md border-zinc-200/75 text-[14px] shadow-none dark:border-zinc-700/80',
                'focus-visible:border-zinc-300 focus-visible:ring-1 focus-visible:ring-zinc-300/50 dark:focus-visible:border-zinc-600 dark:focus-visible:ring-zinc-600/35',
              )}
            />
          </div>
          <div className="relative md:w-[210px]">
            <select
              aria-label="Filtrar por ámbito"
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as 'all' | 'business' | 'personal')}
              className={cn(
                'h-10 w-full appearance-none rounded-md border border-zinc-200/75 bg-surface-card',
                'pl-3 pr-9 text-sm text-ink-primary shadow-none outline-none transition-colors cursor-pointer',
                'dark:border-zinc-700/80 dark:bg-zinc-900/50',
                'focus:border-brand-secondary focus:ring-2 focus:ring-brand-secondary/18',
              )}
            >
              <option value="business">Haciéndolo hábito</option>
              <option value="personal">Vida personal</option>
              <option value="all">Todos los ámbitos</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          </div>
          <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end md:gap-2">
            <button
              type="button"
              onClick={exportCSV}
              title="Exportar CSV"
              className={cn(
                'inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-zinc-200/75 px-3.5 text-sm font-medium text-zinc-800 transition-colors',
                'hover:border-zinc-300 hover:bg-zinc-50/90 dark:border-zinc-700/80 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/45',
              )}
            >
              <Download className="h-4 w-4 text-zinc-500 dark:text-zinc-400" aria-hidden />
              CSV
            </button>
            <button
              type="button"
              title={tab === 'income' ? 'Registrar ingreso' : 'Registrar gasto'}
              onClick={() => navigate(tab === 'income' ? '/finances/income/new' : '/finances/expenses/new')}
              className={cn(
                'inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3.5 text-sm font-semibold text-white shadow-none',
                'bg-[#ff4800] transition-colors hover:bg-[#e04100]',
                'focus-visible:ring-2 focus-visible:ring-[#ff4800]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--surface-base))]',
                'dark:focus-visible:ring-offset-zinc-900',
              )}
            >
              <Plus className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2.25} aria-hidden />
              {tab === 'income' ? 'Nuevo ingreso' : 'Nuevo gasto'}
            </button>
          </div>
        </div>

        {/* Desglose por método de pago */}
        {!loading && (tab === 'income' ? incomesFiltered.length : expensesFiltered.length) > 0 && (() => {
          const rows = tab === 'income' ? incomesFiltered : expensesFiltered
          const byMethod: Record<string, number> = {}
          rows.forEach((r) => {
            const m = r.payment_method ?? 'otro'
            byMethod[m] = (byMethod[m] ?? 0) + (r as Income).amount
          })
          const entries = Object.entries(byMethod).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
          if (entries.length === 0) return null
          return (
            <div className="rounded-md border border-zinc-200/70 bg-surface-card px-4 py-3 dark:border-zinc-700/65">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                {tab === 'income' ? 'Ingresos' : 'Gastos'} por método de pago
              </p>
              <div className="flex flex-wrap gap-2">
                {entries.map(([method, total]) => (
                  <div
                    key={method}
                    className="flex items-center gap-2 rounded-lg border border-zinc-200/60 bg-zinc-50/60 px-3 py-1.5 dark:border-zinc-700/55 dark:bg-zinc-900/40"
                  >
                    <PaymentMethodBadge method={method as Income['payment_method']} />
                    <span className="text-sm font-semibold tabular-nums text-ink-primary">{formatCurrency(total)}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 rounded-lg border border-zinc-300/50 bg-zinc-100/60 px-3 py-1.5 dark:border-zinc-600/40 dark:bg-zinc-800/35">
                  <span className="text-[11px] font-medium text-ink-muted">Total</span>
                  <span className="text-sm font-bold tabular-nums text-ink-primary">
                    {formatCurrency(entries.reduce((s, [, v]) => s + v, 0))}
                  </span>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Listados compactos */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : tab === 'income' ? (
          filteredIncomes.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="h-8 w-8" />}
              title="Sin ingresos registrados"
              description="Registrá tus cobros para llevar el control financiero."
              action={{ label: 'Nuevo ingreso', onClick: () => navigate('/finances/income/new'), icon: <Plus className="h-4 w-4" /> }}
            />
          ) : (
            <section className="overflow-hidden rounded-md border border-zinc-200/70 bg-surface-card shadow-none dark:border-zinc-700/65">
              <div className="border-b border-zinc-200/55 bg-zinc-50/35 px-3 py-2 dark:border-zinc-800/80 dark:bg-zinc-950/40">
                <h2 className="text-sm font-semibold tracking-tight text-ink-primary">Listado</h2>
                <p className="truncate text-[11px] text-ink-muted">{filteredIncomes.length === 1 ? '1 movimiento' : `${filteredIncomes.length} movimientos`}</p>
              </div>
              <div className="max-h-[min(60vh,28rem)] overflow-auto lg:max-h-[min(65vh,32rem)]">
                <table className="w-full min-w-[900px] border-collapse text-[13px] leading-snug">
                  <thead className="sticky top-0 z-[1] border-b border-zinc-200/55 bg-surface-card/95 backdrop-blur-[2px] dark:border-zinc-800/85 dark:bg-zinc-950/95">
                    <tr className="text-left">
                      <th className="whitespace-nowrap px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-ink-muted sm:px-4">Fecha</th>
                      <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-ink-muted sm:px-4">Concepto</th>
                      <th className="hidden px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-ink-muted md:table-cell md:px-4">Tipo · categoría</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-ink-muted sm:px-4">Monto</th>
                      <th className="whitespace-nowrap px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-ink-muted sm:px-4">Estado</th>
                      <th className="hidden px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-ink-muted lg:table-cell lg:px-4">Medio · Notas</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-ink-muted sm:px-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/40 dark:divide-zinc-800/65">
                    {filteredIncomes.map((income) => (
                      <tr key={income.id} className="transition-colors hover:bg-zinc-50/85 dark:hover:bg-zinc-900/40">
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-muted sm:px-4">{formatDate(income.income_date)}</td>
                        <td className="max-w-[12rem] px-3 py-2 sm:max-w-none sm:px-4">
                          <p className="truncate font-semibold text-ink-primary" title={income.student?.full_name ?? income.description}>
                            {income.student?.full_name ?? income.description}
                          </p>
                          <p className="truncate text-[11px] text-ink-muted md:hidden">
                            {income.income_type} · {income.category}
                          </p>
                        </td>
                        <td className="hidden max-w-[14rem] truncate px-3 py-2 text-ink-secondary md:table-cell md:px-4" title={`${income.income_type} · ${income.category}`}>
                          {income.income_type} · {income.category}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-ink-primary sm:px-4">
                          {formatCurrency(income.amount)}
                        </td>
                        <td className="px-3 py-2 sm:px-4">
                          <Badge status={income.status} className="text-[10px]" />
                        </td>
                        <td className="hidden px-3 py-2 lg:table-cell lg:px-4">
                          <div className="flex flex-col gap-1">
                            <PaymentMethodBadge method={income.payment_method} />
                            {income.notes?.trim() && (
                              <p className="max-w-[16rem] text-[11px] text-ink-muted leading-snug" title={income.notes}>
                                {income.notes}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 sm:px-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => navigate(`/finances/income/${income.id}/edit`)}
                              className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-zinc-100 hover:text-ink-primary dark:hover:bg-zinc-800"
                              title="Editar"
                              aria-label="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteIncomeTarget(income)}
                              className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                              title="Eliminar"
                              aria-label="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        ) : filteredExpenses.length === 0 ? (
          <EmptyState
            icon={<TrendingDown className="h-8 w-8" />}
            title="Sin gastos registrados"
            description="Registrá tus gastos para llevar el control financiero."
            action={{ label: 'Nuevo gasto', onClick: () => navigate('/finances/expenses/new'), icon: <Plus className="h-4 w-4" /> }}
          />
        ) : (
          <section className="overflow-hidden rounded-md border border-zinc-200/70 bg-surface-card shadow-none dark:border-zinc-700/65">
            <div className="border-b border-zinc-200/55 bg-zinc-50/35 px-3 py-2 dark:border-zinc-800/80 dark:bg-zinc-950/40">
              <h2 className="text-sm font-semibold tracking-tight text-ink-primary">Listado</h2>
              <p className="truncate text-[11px] text-ink-muted">{filteredExpenses.length === 1 ? '1 gasto' : `${filteredExpenses.length} gastos`}</p>
            </div>
            <div className="max-h-[min(60vh,28rem)] overflow-auto lg:max-h-[min(65vh,32rem)]">
              <table className="w-full min-w-[760px] border-collapse text-[13px] leading-snug">
                <thead className="sticky top-0 z-[1] border-b border-zinc-200/55 bg-surface-card/95 backdrop-blur-[2px] dark:border-zinc-800/85 dark:bg-zinc-950/95">
                  <tr className="text-left">
                    <th className="whitespace-nowrap px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-ink-muted sm:px-4">Fecha</th>
                    <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-ink-muted sm:px-4">Descripción</th>
                    <th className="hidden px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-ink-muted sm:table-cell sm:px-4">Categoría</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-ink-muted sm:px-4">Monto</th>
                    <th className="whitespace-nowrap px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-ink-muted sm:px-4">Tipo</th>
                    <th className="hidden px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-ink-muted lg:table-cell lg:px-4">Medio · Notas</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-ink-muted sm:px-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/40 dark:divide-zinc-800/65">
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="transition-colors hover:bg-zinc-50/85 dark:hover:bg-zinc-900/40">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-muted sm:px-4">{formatDate(expense.expense_date)}</td>
                      <td className="max-w-[14rem] px-3 py-2 sm:max-w-none sm:px-4">
                        <p className="truncate font-semibold text-ink-primary" title={expense.description}>
                          {expense.description}
                        </p>
                        {expense.subcategory && (
                          <p className="truncate text-[11px] text-ink-muted sm:hidden">{expense.subcategory}</p>
                        )}
                      </td>
                      <td className="hidden truncate px-3 py-2 text-ink-secondary sm:table-cell sm:px-4" title={expense.category}>
                        {expense.category}
                        {expense.subcategory ? ` · ${expense.subcategory}` : ''}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-ink-primary sm:px-4">{formatCurrency(expense.amount)}</td>
                      <td className="px-3 py-2 sm:px-4">
                        <span className={expenseTypePillClass(expense.expense_type)}>
                          {expense.expense_type === 'fijo' ? 'Fijo' : 'Variable'}
                        </span>
                      </td>
                      <td className="hidden px-3 py-2 lg:table-cell lg:px-4">
                        <div className="flex flex-col gap-1">
                          <PaymentMethodBadge method={expense.payment_method} />
                          {expense.notes?.trim() && (
                            <p className="max-w-[16rem] text-[11px] text-ink-muted leading-snug" title={expense.notes}>
                              {expense.notes}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 sm:px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/finances/expenses/${expense.id}/edit`)}
                            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-zinc-100 hover:text-ink-primary dark:hover:bg-zinc-800"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteExpenseTarget(expense)}
                            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Cuotas pendientes — tonos contenidos */}
        {deudores.length > 0 && (
          <section className="overflow-hidden rounded-md border border-zinc-200/70 bg-surface-card p-4 dark:border-zinc-700/65">
            <div className="mb-3 flex flex-wrap items-center gap-2 gap-y-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-status-expiring" aria-hidden />
              <p className="text-sm font-semibold text-ink-primary">Cuotas pendientes — {MES_LABELS_FULL[now.getMonth()]}</p>
              <span className="ml-auto inline-flex rounded border border-status-expiring/45 bg-status-expiring/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-status-expiring">
                {deudores.length}
              </span>
            </div>
            <div className="space-y-2">
              {deudores.map(({ student, cuota, paid, pending }) => {
                const waUrl = buildPaymentReminderWaUrl(student.phone, student.full_name, pending, MES_LABELS_FULL[now.getMonth()])
                return (
                  <div
                    key={student.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-zinc-200/60 bg-zinc-50/40 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-primary">{student.full_name}</p>
                      <p className="text-xs text-ink-muted">
                        Cuota {formatCurrency(cuota)}
                        {paid > 0 && <> · Cobrado {formatCurrency(paid)}</>}
                        {' · '}
                        <span className="font-medium text-status-expiring">Pendiente {formatCurrency(pending)}</span>
                      </p>
                    </div>
                    {waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-300/70 bg-transparent px-2.5 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:border-zinc-400 hover:bg-zinc-100 hover:text-ink-primary dark:border-zinc-600 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/80"
                      >
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                        Recordar
                      </a>
                    ) : (
                      <span className="text-[10px] text-ink-muted">Sin teléfono</span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Gráfico anual */}
        <section className="overflow-hidden rounded-md border border-zinc-200/70 bg-surface-card p-4 dark:border-zinc-700/65">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Ingresos cobrados · últimos 12 meses</p>
          <ResponsiveContainer width="100%" height={168}>
            <BarChart data={annualChartData} margin={{ top: 6, right: 8, bottom: 2, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 10, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              />
              <Tooltip content={<AnnualIncomeTooltip />} cursor={false} wrapperStyle={{ outline: 'none' }} />
              <Bar dataKey="total" radius={[5, 5, 0, 0]} maxBarSize={32}>
                {annualChartData.map((entry, index) => (
                  <Cell key={index} fill={entry.isCurrent ? barFillCurrent : barFillDefault} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      <ConfirmDialog
        open={!!deleteIncomeTarget}
        onClose={() => setDeleteIncomeTarget(null)}
        onConfirm={handleDeleteIncome}
        title="¿Eliminar ingreso?"
        description={`Se eliminará el ingreso de ${deleteIncomeTarget ? formatCurrency(deleteIncomeTarget.amount) : ''}. Esta acción no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        loading={deleting}
      />
      <ConfirmDialog
        open={!!deleteExpenseTarget}
        onClose={() => setDeleteExpenseTarget(null)}
        onConfirm={handleDeleteExpense}
        title="¿Eliminar gasto?"
        description={`Se eliminará "${deleteExpenseTarget?.description}". Esta acción no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        loading={deleting}
      />
    </div>
  )
}
