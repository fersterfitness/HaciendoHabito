import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, ExternalLink, Plus, Trash2, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { mealPlanRepo } from '@/data/mealPlans'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { Card, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { confirmDialog } from '@/components/ui/dialogs'
import { formatDate } from '@/lib/utils'
import type { Student, TrainerStudentMealPlan } from '@/types/database'

type Row = Pick<TrainerStudentMealPlan, 'id' | 'title' | 'start_date' | 'end_date' | 'completed_at' | 'updated_at'>

/**
 * Planes asignados que el paciente ve en «Mi plan de alimentación».
 * Se arman en «Armar plan» y se asignan desde ahí; este bloque los lista dentro de la ficha.
 */
export function NutritionAssignedPlansCard({ student }: { student: Pick<Student, 'id' | 'full_name' | 'profile_id'> }) {
  const navigate = useAppNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await mealPlanRepo.summaryForStudent(student.id)
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setRows((data ?? []) as Row[])
  }, [student.id])

  useEffect(() => {
    void load()
  }, [load])

  async function remove(row: Row) {
    const ok = await confirmDialog({
      title: `¿Quitar «${row.title}»?`,
      description: 'El paciente deja de verlo en su cuenta.',
      confirmLabel: 'Quitar',
    })
    if (!ok) return
    const { error } = await mealPlanRepo.remove(row.id)
    if (error) {
      toast.error(error.message)
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id))
    toast.success('Plan quitado')
  }

  const active = rows.filter((r) => !r.completed_at)

  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Planes que ve el paciente</CardTitle>
          <p className="mt-1 text-sm text-ink-muted">
            Se arman en «Armar plan» y le aparecen en «Mi plan de alimentación».
            {student.profile_id ? null : ' Este paciente todavía no tiene la cuenta vinculada: los verá cuando la vincules.'}
          </p>
        </div>
        <Button
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => navigate(`/nutrition/planning?student=${student.id}`)}
        >
          Armar plan
        </Button>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">
          <div className="hh-shimmer h-12 rounded-xl" />
          <div className="hh-shimmer h-12 rounded-xl" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-surface-border px-4 py-5 text-sm text-ink-muted">
          <ClipboardList className="h-5 w-5 shrink-0 text-ink-muted/70" aria-hidden />
          Todavía no le asignaste ningún plan. Armalo y usá «Asignar» para que lo vea en su cuenta.
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-surface-border/70 overflow-hidden rounded-xl border border-surface-border/80">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 bg-surface-card px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-primary">{r.title}</p>
                <p className="text-2xs text-ink-muted">
                  {r.start_date ? `${formatDate(r.start_date)}${r.end_date ? ` → ${formatDate(r.end_date)}` : ''} · ` : ''}
                  Actualizado {formatDate(r.updated_at)}
                </p>
              </div>
              <span
                className={
                  r.completed_at
                    ? 'rounded-full bg-surface-elevated px-2 py-0.5 text-3xs font-semibold text-ink-muted'
                    : 'rounded-full bg-emerald-500/12 px-2 py-0.5 text-3xs font-semibold text-emerald-700 dark:text-emerald-300'
                }
              >
                {r.completed_at ? 'Completado' : 'Visible'}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Eye className="h-3.5 w-3.5" />}
                  onClick={() => navigate(`/students/${student.id}/meal-plan/${r.id}`)}
                >
                  Ver
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-ink-muted hover:text-status-expired"
                  title="Quitar plan"
                  onClick={() => void remove(r)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {active.length > 1 ? (
        <p className="mt-3 flex items-center gap-1.5 text-2xs text-ink-muted">
          <ExternalLink className="h-3 w-3" aria-hidden />
          Hay {active.length} planes visibles a la vez: el paciente ve todos en su cuenta.
        </p>
      ) : null}
    </Card>
  )
}
