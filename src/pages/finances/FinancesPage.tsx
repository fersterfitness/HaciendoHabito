import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, TrendingUp, TrendingDown, Search, Pencil, Trash2, Wallet } from 'lucide-react'
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

type IncomeWithStudent = Income & { student?: Pick<Student, 'full_name'> }
type Tab = 'income' | 'expenses'

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
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [deleteIncomeTarget, setDeleteIncomeTarget] = useState<IncomeWithStudent | null>(null)
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [{ data: incomeData, error: incomeErr }, { data: expenseData, error: expenseErr }] =
        await Promise.all([
          supabase.from('income').select('*, student:students(full_name)').eq('owner_id', user.id).order('income_date', { ascending: false }),
          supabase.from('expenses').select('*').eq('owner_id', user.id).order('expense_date', { ascending: false }),
        ])
      if (incomeErr) toast.error(incomeErr.message)
      else setIncomes((incomeData as unknown as IncomeWithStudent[]) ?? [])
      if (expenseErr) toast.error(expenseErr.message)
      else setExpenses(expenseData ?? [])
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
    if (!deleteIncomeTarget) return
    setDeleting(true)
    const { error } = await supabase.from('income').delete().eq('id', deleteIncomeTarget.id)
    setDeleting(false)
    if (error) { toast.error(error.message); return }
    toast.success('Ingreso eliminado')
    setDeleteIncomeTarget(null)
    fetchAll()
  }

  // ── Delete expense ──
  async function handleDeleteExpense() {
    if (!deleteExpenseTarget) return
    setDeleting(true)
    const { error } = await supabase.from('expenses').delete().eq('id', deleteExpenseTarget.id)
    setDeleting(false)
    if (error) { toast.error(error.message); return }
    toast.success('Gasto eliminado')
    setDeleteExpenseTarget(null)
    fetchAll()
  }

  // ── Totals ──
  const totalIngresos = incomes.filter((i) => i.status === 'cobrado').reduce((s, i) => s + i.amount, 0)
  const totalPendiente = incomes.filter((i) => i.status === 'pendiente').reduce((s, i) => s + i.amount, 0)
  const totalGastos = expenses.reduce((s, e) => s + e.amount, 0)
  const balance = totalIngresos - totalGastos

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

  return (
    <div>
      <Header
        title="Finanzas"
        actions={
          <Button
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate(tab === 'income' ? '/finances/income/new' : '/finances/expenses/new')}
          >
            {tab === 'income' ? 'Nuevo ingreso' : 'Nuevo gasto'}
          </Button>
        }
      />

      <div className="px-4 lg:px-6 py-6 space-y-5">

        {/* ── Global metrics ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Balance neto"
            value={formatCurrency(balance)}
            color={balance >= 0 ? 'text-status-generated' : 'text-status-expired'}
          />
          <MetricCard label="Ingresos cobrados" value={formatCurrency(totalIngresos)} color="text-status-generated" />
          <MetricCard label="Ingresos pendientes" value={formatCurrency(totalPendiente)} color="text-status-expiring" />
          <MetricCard label="Total gastos" value={formatCurrency(totalGastos)} color="text-status-expired" />
        </div>

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
