import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, TrendingUp, Search, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Income, Student } from '@/types/database'
import toast from 'react-hot-toast'

type IncomeWithStudent = Income & { student?: Pick<Student, 'full_name'> }

export function IncomePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [incomes, setIncomes] = useState<IncomeWithStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<IncomeWithStudent | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchIncomes = useCallback(async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('income')
        .select('*, student:students(full_name)')
        .eq('owner_id', user.id)
        .order('income_date', { ascending: false })
      if (error) toast.error(error.message)
      else setIncomes((data as unknown as IncomeWithStudent[]) ?? [])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchIncomes() }, [fetchIncomes])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('income').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) { toast.error(error.message); return }
    toast.success('Ingreso eliminado')
    setDeleteTarget(null)
    fetchIncomes()
  }

  const filtered = incomes.filter((i) =>
    i.description.toLowerCase().includes(search.toLowerCase()) ||
    i.student?.full_name.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase())
  )

  const totalCobrado = filtered.filter((i) => i.status === 'cobrado').reduce((acc, i) => acc + i.amount, 0)
  const totalPendiente = filtered.filter((i) => i.status === 'pendiente').reduce((acc, i) => acc + i.amount, 0)

  return (
    <div>
      <Header
        title="Ingresos"
        actions={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/finances/income/new')}>
            Nuevo
          </Button>
        }
      />

      <div className="px-4 lg:px-6 py-6 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
            <p className="text-xs text-ink-muted mb-1">Total cobrado</p>
            <p className="text-xl font-bold text-status-generated">{formatCurrency(totalCobrado)}</p>
          </div>
          <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
            <p className="text-xs text-ink-muted mb-1">Total pendiente</p>
            <p className="text-xl font-bold text-status-expiring">{formatCurrency(totalPendiente)}</p>
          </div>
        </div>

        <Input
          placeholder="Buscar por alumno, categoría..."
          leftIcon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="h-8 w-8" />}
            title="Sin ingresos registrados"
            description="Registrá tus cobros para llevar el control financiero."
            action={{ label: 'Nuevo ingreso', onClick: () => navigate('/finances/income/new'), icon: <Plus className="h-4 w-4" /> }}
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((income) => (
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
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={() => setDeleteTarget(income)}
                    className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-status-expired hover:bg-status-expired/10 transition-colors px-2 py-1.5 rounded-lg"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="¿Eliminar ingreso?"
        description={`Se eliminará el ingreso de ${deleteTarget ? formatCurrency(deleteTarget.amount) : ''}. Esta acción no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        loading={deleting}
      />
    </div>
  )
}
