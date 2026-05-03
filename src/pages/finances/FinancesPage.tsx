import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, TrendingUp, TrendingDown, Search, Pencil, Trash2, Download, MessageCircle, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Income, Expense, Student } from '@/types/database'
import toast from 'react-hot-toast'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts'
import { normalizePhoneForWhatsApp, buildWhatsAppUrl } from '@/lib/whatsapp'

type IncomeWithStudent = Income & { student?: Pick<Student, 'full_name'> }
type Tab = 'income' | 'expenses'

const MES_LABELS_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

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

// ─── Metric pill ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-4 flex flex-col gap-1">
      <p className="text-[11px] text-ink-muted font-medium">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

// ─── Tab button ───────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, icon: Icon, label, count }: {
  active: boolean; onClick: () => void
  icon: React.ElementType; label: string; count: number
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all',
        active
          ? 'bg-brand-primary text-white shadow-[0_4px_14px_rgba(255,140,0,0.3)]'
          : 'text-ink-muted hover:text-ink-primary hover:bg-surface-elevated',
      ].join(' ')}
    >
      <Icon className="h-4 w-4" />
      {label}
      <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-bold ${
        active ? 'bg-white/20 text-white' : 'bg-surface-elevated text-ink-muted'
      }`}>
        {count}
      </span>
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function FinancesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuthStore()

  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) ?? 'income')
  const [incomes, setIncomes] = useState<IncomeWithStudent[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

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

  useEffect(() => { fetchAll() }, [fetchAll])

  function switchTab(t: Tab) {
    setTab(t)
    setSearch('')
    setSearchParams({ tab: t })
  }

  // ── Delete income ──
  async function handleDeleteIncome() {
    if (!deleteIncomeTarget || !user) return
    setDeleting(true)
    const { error } = await supabase
      .from('income')
      .delete()
      .eq('id', deleteIncomeTarget.id)
      .eq('owner_id', user.id)
    setDeleting(false)
    if (error) { toast.error(error.message); return }
    toast.success('Ingreso eliminado')
    setDeleteIncomeTarget(null)
    fetchAll()
  }

  // ── Delete expense ──
  async function handleDeleteExpense() {
    if (!deleteExpenseTarget || !user) return
    setDeleting(true)
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', deleteExpenseTarget.id)
      .eq('owner_id', user.id)
    setDeleting(false)
    if (error) { toast.error(error.message); return }
    toast.success('Gasto eliminado')
    setDeleteExpenseTarget(null)
    fetchAll()
  }

  // ── Totals ──
  const totalIngresos  = incomes.filter((i) => i.status === 'cobrado').reduce((s, i) => s + i.amount, 0)
  const totalPendiente = incomes.filter((i) => i.status === 'pendiente').reduce((s, i) => s + i.amount, 0)
  const totalGastos    = expenses.reduce((s, e) => s + e.amount, 0)
  const balance        = totalIngresos - totalGastos

  // ── Month comparison ──
  const now           = new Date()
  const thisMonthKey  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthKey  = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`
  const MES_LABELS    = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const thisMesTotal  = incomes.filter((i) => i.status === 'cobrado' && i.income_date.startsWith(thisMonthKey)).reduce((s, i) => s + i.amount, 0)
  const prevMesTotal  = incomes.filter((i) => i.status === 'cobrado' && i.income_date.startsWith(prevMonthKey)).reduce((s, i) => s + i.amount, 0)
  const mesDelta      = prevMesTotal > 0 ? Math.round(((thisMesTotal - prevMesTotal) / prevMesTotal) * 100) : null

  // ── Deudores (alumnos con cuota configurada pero sin pago este mes) ──
  const deudores = students
    .map((s) => {
      const raw = localStorage.getItem(`cuota_mensual_${s.id}`)
      if (!raw) return null
      const cuota = Number(raw)
      const paid  = incomes
        .filter((i) => i.status === 'cobrado' && i.student_id === s.id && i.income_date.startsWith(thisMonthKey))
        .reduce((sum, i) => sum + i.amount, 0)
      if (paid >= cuota) return null
      return { student: s, cuota, paid, pending: cuota - paid }
    })
    .filter(Boolean) as { student: Student; cuota: number; paid: number; pending: number }[]

  // ── Gráfico anual (últimos 12 meses) ──
  const annualChartData = Array.from({ length: 12 }, (_, i) => {
    const d    = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    const key  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const total = incomes
      .filter((inc) => inc.status === 'cobrado' && inc.income_date.startsWith(key))
      .reduce((s, inc) => s + inc.amount, 0)
    return { mes: MES_LABELS[d.getMonth()], total, isCurrent: key === thisMonthKey }
  })

  // ── Filtered lists ──
  const filteredIncomes = incomes.filter((i) =>
    i.description.toLowerCase().includes(search.toLowerCase()) ||
    (i.student?.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase())
  )
  const filteredExpenses = expenses.filter((e) =>
    e.description.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase())
  )

  // ── CSV export ──
  function exportCSV() {
    const isIncome = tab === 'income'

    const STATUS_LABEL: Record<string, string> = {
      cobrado:   'Cobrado',
      pendiente: 'Pendiente',
      cancelado: 'Cancelado',
    }
    const METHOD_LABEL: Record<string, string> = {
      efectivo_debito: 'Efectivo / Débito',
      tarjeta_credito: 'Tarjeta crédito',
      transferencia:   'Transferencia',
      otro:            'Otro',
    }
    const EXPENSE_TYPE_LABEL: Record<string, string> = {
      fijo:     'Fijo',
      variable: 'Variable',
    }

    const rows = isIncome
      ? [
          // Orden: lo más útil para analizar primero
          ['Fecha', 'Monto', 'Estado', 'Alumno', 'Tipo', 'Categoría', 'Método de pago', 'Descripción', 'Notas'],
          ...filteredIncomes.map((i) => [
            i.income_date,
            String(i.amount),
            STATUS_LABEL[i.status] ?? i.status,
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
            EXPENSE_TYPE_LABEL[e.expense_type] ?? e.expense_type,
            e.description,
            e.category,
            e.subcategory ?? '',
            METHOD_LABEL[e.payment_method] ?? e.payment_method,
            e.notes ?? '',
          ]),
        ]
    // sep=; le indica a Excel (locale español) que use punto y coma como separador
    const csv = 'sep=;\n' + rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${isIncome ? 'ingresos' : 'gastos'}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <Header
        title="Finanzas"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              title="Exportar CSV"
              className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink-primary hover:bg-surface-elevated px-2.5 py-1.5 rounded-lg transition-colors border border-surface-border"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <Button
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => navigate(tab === 'income' ? '/finances/income/new' : '/finances/expenses/new')}
            >
              {tab === 'income' ? 'Nuevo ingreso' : 'Nuevo gasto'}
            </Button>
          </div>
        }
      />

      <div className="px-4 lg:px-6 py-6 space-y-5">

        {/* ── Global metrics ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Balance neto" value={formatCurrency(balance)} color={balance >= 0 ? 'text-status-generated' : 'text-status-expired'} />
          <MetricCard label="Cobrado total" value={formatCurrency(totalIngresos)} color="text-status-generated" />
          <MetricCard label="Pendiente" value={formatCurrency(totalPendiente)} color="text-status-expiring" />
          <MetricCard label="Total gastos" value={formatCurrency(totalGastos)} color="text-status-expired" />
        </div>

        {/* ── Month comparison ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-4 flex flex-col gap-1">
            <p className="text-[11px] text-ink-muted font-medium">
              {MES_LABELS[now.getMonth()]} (cobrado)
              {mesDelta !== null && (
                <span className={`ml-2 font-bold ${mesDelta >= 0 ? 'text-status-generated' : 'text-status-expired'}`}>
                  {mesDelta >= 0 ? '+' : ''}{mesDelta}%
                </span>
              )}
            </p>
            <p className="text-xl font-bold text-status-generated">{formatCurrency(thisMesTotal)}</p>
          </div>
          <div className="bg-surface-card border border-surface-border rounded-2xl p-4 flex flex-col gap-1">
            <p className="text-[11px] text-ink-muted font-medium">{MES_LABELS[prevMonthDate.getMonth()]} (cobrado)</p>
            <p className="text-xl font-bold text-ink-secondary">{formatCurrency(prevMesTotal)}</p>
          </div>
        </div>

        {/* ── Gráfico anual ── */}
        <Card>
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">Ingresos cobrados — últimos 12 meses</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={annualChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v/1000)}k` : String(v)} />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-surface-border)', borderRadius: 8, fontSize: 11 }}
                formatter={(v: number) => [formatCurrency(v), 'Cobrado']}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {annualChartData.map((entry, index) => (
                  <Cell key={index} fill={entry.isCurrent ? 'var(--color-brand-primary)' : 'rgba(255,140,0,0.35)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* ── Deudores pendientes ── */}
        {deudores.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-sm font-semibold text-ink-primary">
                Cuotas pendientes — {MES_LABELS_FULL[now.getMonth()]}
              </p>
              <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                {deudores.length}
              </span>
            </div>
            <div className="space-y-2">
              {deudores.map(({ student, cuota, paid, pending }) => {
                const waUrl = buildPaymentReminderWaUrl(student.phone, student.full_name, pending, MES_LABELS_FULL[now.getMonth()])
                return (
                  <div key={student.id} className="flex items-center gap-3 rounded-xl bg-surface-elevated px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-primary truncate">{student.full_name}</p>
                      <p className="text-xs text-ink-muted">
                        Cuota: {formatCurrency(cuota)}
                        {paid > 0 && ` · Cobrado: ${formatCurrency(paid)}`}
                        {' · '}
                        <span className="text-amber-400 font-medium">Pendiente: {formatCurrency(pending)}</span>
                      </p>
                    </div>
                    {waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600/15 border border-emerald-600/30 text-emerald-400 text-xs font-medium hover:bg-emerald-600/25 transition-colors"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Recordar
                      </a>
                    ) : (
                      <span className="text-[10px] text-ink-muted">Sin teléfono</span>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* ── Tabs + search ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 p-1 bg-surface-elevated rounded-2xl shrink-0">
            <TabBtn active={tab === 'income'} onClick={() => switchTab('income')}
              icon={TrendingUp} label="Ingresos" count={incomes.length} />
            <TabBtn active={tab === 'expenses'} onClick={() => switchTab('expenses')}
              icon={TrendingDown} label="Gastos" count={expenses.length} />
          </div>
          <div className="flex-1 w-full">
            <Input
              placeholder={tab === 'income' ? 'Buscar por alumno, categoría...' : 'Buscar por descripción o categoría...'}
              leftIcon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : tab === 'income' ? (
          filteredIncomes.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="h-8 w-8" />}
              title="Sin ingresos registrados"
              description="Registrá tus cobros para llevar el control financiero."
              action={{ label: 'Nuevo ingreso', onClick: () => navigate('/finances/income/new'), icon: <Plus className="h-4 w-4" /> }}
            />
          ) : (
            <div className="space-y-3">
              {filteredIncomes.map((income) => (
                <Card key={income.id} className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-bold text-ink-primary truncate">
                        {income.student?.full_name ?? income.description}
                      </p>
                      <p className="text-xs text-ink-muted truncate">{income.income_type} · {income.category}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <p className="text-base font-bold text-status-generated">{formatCurrency(income.amount)}</p>
                      <Badge status={income.status} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-ink-muted">
                    <span>{formatDate(income.income_date)}</span>
                    <span>{income.payment_method.replace('_', '/')}</span>
                    {income.notes && <span className="truncate">📝 {income.notes}</span>}
                  </div>
                  <div className="flex items-center gap-1 pt-2 mt-1 border-t border-surface-border">
                    <button
                      onClick={() => navigate(`/finances/income/${income.id}/edit`)}
                      className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink-primary hover:bg-surface-elevated transition-colors px-2 py-1.5 rounded-lg"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => setDeleteIncomeTarget(income)}
                      className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-status-expired hover:bg-status-expired/10 transition-colors px-2 py-1.5 rounded-lg"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Eliminar
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : (
          filteredExpenses.length === 0 ? (
            <EmptyState
              icon={<TrendingDown className="h-8 w-8" />}
              title="Sin gastos registrados"
              description="Registrá tus gastos para llevar el control financiero."
              action={{ label: 'Nuevo gasto', onClick: () => navigate('/finances/expenses/new'), icon: <Plus className="h-4 w-4" /> }}
            />
          ) : (
            <div className="space-y-3">
              {filteredExpenses.map((expense) => (
                <Card key={expense.id} className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-bold text-ink-primary truncate">{expense.description}</p>
                      <p className="text-xs text-ink-muted">{expense.category}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <p className="text-base font-bold text-status-expired">{formatCurrency(expense.amount)}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                        expense.expense_type === 'fijo'
                          ? 'bg-status-sent/10 text-status-sent'
                          : 'bg-status-expiring/10 text-status-expiring'
                      }`}>
                        {expense.expense_type}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-ink-muted">
                    <span>{formatDate(expense.expense_date)}</span>
                    <span>{expense.payment_method.replace('_', '/')}</span>
                    {expense.subcategory && <span>{expense.subcategory}</span>}
                  </div>
                  <div className="flex items-center gap-1 pt-2 mt-1 border-t border-surface-border">
                    <button
                      onClick={() => navigate(`/finances/expenses/${expense.id}/edit`)}
                      className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink-primary hover:bg-surface-elevated transition-colors px-2 py-1.5 rounded-lg"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => setDeleteExpenseTarget(expense)}
                      className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-status-expired hover:bg-status-expired/10 transition-colors px-2 py-1.5 rounded-lg"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Eliminar
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}
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
