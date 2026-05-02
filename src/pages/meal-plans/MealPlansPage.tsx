import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, FileDown, Pencil, Search, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatDate } from '@/lib/utils'
import { downloadTrainerStudentMealPlanPdf } from '@/lib/nutrition/downloadTrainerStudentMealPlanPdf'
import type { TrainerStudentMealPlan } from '@/types/database'

type PlanRow = TrainerStudentMealPlan & {
  student?: { full_name: string } | null
}

export function MealPlansPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PlanRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchPlans = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('trainer_student_meal_plans')
      .select('*, student:students(full_name)')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })
    setLoading(false)
    if (error) {
      console.error(error)
      toast.error(error.message ?? 'No se pudieron cargar los planes.')
      return
    }
    setPlans((data ?? []) as PlanRow[])
  }, [user?.id])

  useEffect(() => {
    void fetchPlans()
  }, [fetchPlans])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return plans
    return plans.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.student?.full_name ?? '').toLowerCase().includes(q),
    )
  }, [plans, search])

  async function handlePdf(p: PlanRow) {
    setPdfBusyId(p.id)
    try {
      await downloadTrainerStudentMealPlanPdf(p, { professionalName: profile?.full_name })
      toast.success('PDF descargado.')
    } catch (e) {
      console.error(e)
      toast.error('No se pudo generar el PDF.')
    } finally {
      setPdfBusyId(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !user?.id) return
    setDeleting(true)
    const { error } = await supabase
      .from('trainer_student_meal_plans')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('owner_id', user.id)
    setDeleting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Plan eliminado.')
    setDeleteTarget(null)
    void fetchPlans()
  }

  return (
    <div>
      <Header
        title="Planes de alimentación"
        actions={
          <Button size="sm" onClick={() => navigate('/nutrition/planning')}>
            Armar / editar plantilla
          </Button>
        }
      />

      <div className="px-4 lg:px-6 py-6 space-y-6">
        <Input
          placeholder="Buscar por alumno o título del plan..."
          leftIcon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-8 w-8" />}
            title={plans.length === 0 ? 'No hay planes asignados' : 'Sin resultados'}
            description={
              plans.length === 0
                ? 'Asigná un plan desde Plan de alimentación o desde la ficha del alumno.'
                : 'Probá otro término de búsqueda.'
            }
            action={
              plans.length === 0
                ? {
                    label: 'Ir a Plan de alimentación',
                    onClick: () => navigate('/nutrition/planning'),
                  }
                : undefined
            }
          />
        ) : (
          <section>
            <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">
              Asignados ({filtered.length})
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((p) => (
                <MealPlanCard
                  key={p.id}
                  plan={p}
                  pdfLoading={pdfBusyId === p.id}
                  onOpen={() => navigate(`/students/${p.student_id}/meal-plan/${p.id}`)}
                  onPdf={() => void handlePdf(p)}
                  onDelete={() => setDeleteTarget(p)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="¿Eliminar plan asignado?"
        description={`Se borrará "${deleteTarget?.title}" para ${deleteTarget?.student?.full_name ?? 'el alumno'}. El alumno dejará de verlo en la app. Esta acción no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        loading={deleting}
      />
    </div>
  )
}

function MealPlanCard({
  plan,
  pdfLoading,
  onOpen,
  onPdf,
  onDelete,
}: {
  plan: PlanRow
  pdfLoading: boolean
  onOpen: () => void
  onPdf: () => void
  onDelete: () => void
}) {
  return (
    <Card className="flex flex-col gap-2 group">
      <button type="button" onClick={onOpen} className="flex flex-col gap-2 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-base font-bold text-ink-primary truncate">{plan.title}</p>
            <p className="text-xs text-ink-muted truncate">{plan.student?.full_name ?? '—'}</p>
          </div>
        </div>
        <div className="text-xs text-ink-secondary">Actualizado {formatDate(plan.updated_at)}</div>
      </button>

      <div className="flex items-center gap-1 pt-3 mt-1 border-t border-surface-border flex-wrap">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
          className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink-primary hover:bg-surface-elevated transition-colors px-2 py-1.5 rounded-lg"
        >
          <Pencil className="h-3.5 w-3.5" />
          Ver
        </button>
        <button
          type="button"
          disabled={pdfLoading}
          onClick={(e) => {
            e.stopPropagation()
            onPdf()
          }}
          className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-brand-primary hover:bg-brand-primary/10 transition-colors px-2 py-1.5 rounded-lg disabled:opacity-50"
        >
          <FileDown className="h-3.5 w-3.5" />
          {pdfLoading ? 'PDF…' : 'PDF'}
        </button>
        <div className="flex-1 min-w-[8px]" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-status-expired hover:bg-status-expired/10 transition-colors px-2 py-1.5 rounded-lg"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar
        </button>
      </div>
    </Card>
  )
}
