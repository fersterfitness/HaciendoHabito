import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, TrendingDown, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Expense } from '@/types/database'
import toast from 'react-hot-toast'

export function ExpensesPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchExpenses = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('owner_id', user.id)
      .order('expense_date', { ascending: false })
    if (error) toast.error(error.message)
    else setExpenses(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  const filtered = expenses.filter((e) =>
    e.description.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase())
  )

  const totalFijo = filtered.filter((e) => e.expense_type === 'fijo').reduce((acc, e) => acc + e.amount, 0)
  const totalVariable = filtered.filter((e) => e.expense_type === 'variable').reduce((acc, e) => acc + e.amount, 0)

  return (
    <div>
      <Header
        title="Gastos"
        actions={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/finances/expenses/new')}>
            Nuevo
          </Button>
        }
      />

      <div className="px-4 lg:px-6 py-6 max-w-3xl space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
            <p className="text-xs text-ink-muted mb-1">Gastos fijos</p>
            <p className="text-xl font-bold text-status-expired">{formatCurrency(totalFijo)}</p>
          </div>
          <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
            <p className="text-xs text-ink-muted mb-1">Gastos variables</p>
            <p className="text-xl font-bold text-status-expiring">{formatCurrency(totalVariable)}</p>
          </div>
        </div>

        <Input
          placeholder="Buscar por descripción o categoría..."
          leftIcon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<TrendingDown className="h-8 w-8" />}
            title="Sin gastos registrados"
            description="Registrá tus gastos para llevar el control financiero."
            action={{ label: 'Nuevo gasto', onClick: () => navigate('/finances/expenses/new'), icon: <Plus className="h-4 w-4" /> }}
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((expense) => (
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
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
