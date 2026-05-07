import { useEffect, useState, useCallback } from 'react'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { Plus, Search, Dumbbell, Trash2, Pencil, Tags } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { slugifyMuscleCatalogName, nextMuscleGroupSortOrder } from '@/lib/exercise/muscleGroupCatalog'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'
import type { Exercise, MuscleGroup } from '@/types/database'
import toast from 'react-hot-toast'

type ExerciseWithGroup = Exercise & { muscle_group?: MuscleGroup }

const DIFFICULTY_LABEL: Record<string, string> = {
  basico: 'Básico',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

/** Pills alineadas al lenguaje visual de estados de la app (sin “vencido” en avanzado). */
function difficultyBadgeClass(difficulty: string): string {
  const base =
    'inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap'
  switch (difficulty) {
    case 'basico':
      return cn(
        base,
        'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/[0.14] dark:text-emerald-400',
      )
    case 'intermedio':
      return cn(
        base,
        'border-status-expiring/40 bg-status-expiring/10 text-status-expiring',
      )
    case 'avanzado':
      return cn(
        base,
        'border-zinc-400/55 bg-zinc-500/10 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-600/15 dark:text-zinc-400',
      )
    default:
      return cn(base, 'border-zinc-200/80 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400')
  }
}

export function ExercisesPage() {
  const navigate = useAppNavigate()
  const { user } = useAuthStore()
  const [exercises, setExercises] = useState<ExerciseWithGroup[]>([])
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ExerciseWithGroup | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showCategoryPanel, setShowCategoryPanel] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)

  const reloadMuscleGroups = useCallback(async () => {
    const { data, error } = await supabase.from('muscle_groups').select('*').order('sort_order')
    if (error) toast.error(error.message)
    else setMuscleGroups(data ?? [])
  }, [])

  const fetchExercises = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('exercise_library')
        .select('*, muscle_group:muscle_groups(*)')
        .order('name')
      if (error) toast.error(error.message)
      else setExercises((data as unknown as ExerciseWithGroup[]) ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchExercises()
    void reloadMuscleGroups()
  }, [fetchExercises, reloadMuscleGroups])

  const filtered = exercises.filter((e) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      e.name.toLowerCase().includes(q) ||
      (e.muscle_group?.name ?? '').toLowerCase().includes(q) ||
      (e.equipment?.join(' ') ?? '').toLowerCase().includes(q)
    )
  })

  async function handleDelete() {
    if (!deleteTarget || !user) return
    setDeleting(true)
    const { error } = await supabase
      .from('exercise_library')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('owner_id', user.id) // solo el dueño puede eliminar
    setDeleting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Ejercicio eliminado')
    setDeleteTarget(null)
    fetchExercises()
  }

  async function createMuscleCategory() {
    if (!newCategoryName.trim()) return
    const upperName = newCategoryName.trim().toUpperCase()
    if (muscleGroups.some((g) => g.name.toUpperCase() === upperName)) {
      toast.error(`La categoría "${upperName}" ya existe`)
      return
    }
    setCreatingCategory(true)
    const slug = `${slugifyMuscleCatalogName(newCategoryName)}-${Date.now()}`
    const { data: row, error } = await supabase
      .from('muscle_groups')
      .insert({ name: upperName, slug, sort_order: nextMuscleGroupSortOrder(muscleGroups) })
      .select()
      .single()
    setCreatingCategory(false)
    if (error) {
      toast.error(error.message || 'Error al crear categoría')
      return
    }
    const created = row as MuscleGroup
    setMuscleGroups((prev) =>
      [...prev, created].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    )
    toast.success('Categoría creada')
    setNewCategoryName('')
    setShowCategoryPanel(false)
  }

  return (
    <div>
      <Header title="Ejercicios" />

      <div className="mx-auto max-w-[1600px] space-y-3 px-4 py-4 lg:px-6 lg:py-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
          <div className="min-h-10 min-w-0 flex-1">
            <Input
              placeholder="Buscar por nombre, músculo o equipamiento..."
              leftIcon={<Search className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar ejercicios"
              className={cn(
                'h-10 rounded-md border-zinc-200/75 text-[14px] shadow-none dark:border-zinc-700/80',
                'focus-visible:border-zinc-300 focus-visible:ring-1 focus-visible:ring-zinc-300/50 dark:focus-visible:border-zinc-600 dark:focus-visible:ring-zinc-600/35',
              )}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end md:gap-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              icon={<Tags className="h-4 w-4" />}
              onClick={() => setShowCategoryPanel((v) => !v)}
              className={cn(
                'h-10 shrink-0 rounded-md border-zinc-200/75 px-3.5 font-medium text-zinc-800',
                'hover:border-zinc-300 hover:bg-zinc-50/90 dark:border-zinc-700/80 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/45',
              )}
            >
              <span className="hidden sm:inline">Nueva categoría</span>
              <span className="sm:hidden">Categoría</span>
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              icon={<Plus className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.25} />}
              onClick={() => navigate('/exercises/new')}
              className={cn(
                'h-10 shrink-0 rounded-md px-3.5 text-sm font-semibold text-white shadow-none hover:shadow-none',
                'bg-[#ff4800] hover:bg-[#e04100]',
                'focus-visible:ring-2 focus-visible:ring-[#ff4800]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--surface-base))]',
                'dark:focus-visible:ring-offset-zinc-900',
              )}
            >
              Nuevo
            </Button>
          </div>
        </div>

        {showCategoryPanel && (
          <div className="space-y-2 rounded-lg border border-zinc-200/75 bg-zinc-50/50 p-3 dark:border-zinc-700/75 dark:bg-zinc-950/40">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Nueva categoría (grupo muscular)</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <Input
                  placeholder="Nombre *"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" loading={creatingCategory} disabled={!newCategoryName.trim()} onClick={createMuscleCategory} className="h-9">
                  Crear
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-9"
                  onClick={() => {
                    setShowCategoryPanel(false)
                    setNewCategoryName('')
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Dumbbell className="h-8 w-8" />}
            title="Sin ejercicios"
            description={exercises.length === 0 ? 'Creá ejercicios para armar rutinas.' : 'Probá otra búsqueda.'}
            action={
              exercises.length === 0
                ? { label: 'Nuevo ejercicio', onClick: () => navigate('/exercises/new'), icon: <Plus className="h-4 w-4" /> }
                : undefined
            }
          />
        ) : (
          <div className="w-full overflow-x-auto rounded-md border border-zinc-200/70 bg-surface-card dark:border-zinc-700/65">
            <table className="w-full border-collapse text-[13px] leading-snug">
              <thead className="border-b border-zinc-200/55 bg-zinc-50/40 dark:border-zinc-800/80 dark:bg-zinc-950/35">
                <tr className="text-left">
                  <th className="w-[32%] px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-ink-muted sm:px-4">Ejercicio</th>
                  <th className="hidden w-[18%] px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-ink-muted sm:table-cell sm:px-4">
                    Músculo
                  </th>
                  <th className="w-[13%] px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-ink-muted sm:px-4">Nivel</th>
                  <th className="hidden px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-ink-muted lg:table-cell lg:px-4">
                    Equipo
                  </th>
                  <th className="w-24 px-2 py-2 sm:w-28" aria-label="Acciones" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/40 dark:divide-zinc-800/60">
                {filtered.map((exercise) => (
                  <tr key={exercise.id} className="transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-900/35">
                    <td className="px-3 py-2 sm:px-4">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="font-semibold tracking-tight text-ink-primary">{exercise.name}</span>
                        {!exercise.is_active && (
                          <span className="rounded border border-zinc-300/65 bg-zinc-500/[0.08] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
                            Inactivo
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden truncate px-3 py-2 text-ink-secondary sm:table-cell sm:max-w-[10rem] sm:px-4" title={exercise.muscle_group?.name ?? undefined}>
                      {exercise.muscle_group?.name ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 sm:px-4">
                      <span className={difficultyBadgeClass(exercise.difficulty)}>
                        {DIFFICULTY_LABEL[exercise.difficulty] ?? exercise.difficulty}
                      </span>
                    </td>
                    <td className="hidden max-w-[14rem] truncate px-3 py-2 text-xs text-ink-muted lg:table-cell lg:px-4" title={(exercise.equipment ?? []).join(', ') || undefined}>
                      {exercise.equipment && exercise.equipment.length > 0 ? exercise.equipment.join(', ') : '—'}
                    </td>
                    <td className="px-2 py-1.5 sm:px-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(exercise)}
                          className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                          title="Eliminar"
                          aria-label={`Eliminar ${exercise.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/exercises/${exercise.id}/edit`)}
                          className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-zinc-100 hover:text-ink-primary dark:hover:bg-zinc-800"
                          title="Editar"
                          aria-label={`Editar ${exercise.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`¿Eliminar "${deleteTarget?.name}"?`}
        description="Esta acción no se puede deshacer. Los ejercicios en rutinas existentes no serán afectados."
        confirmLabel="Eliminar"
        loading={deleting}
      />
    </div>
  )
}
