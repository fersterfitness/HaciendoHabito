import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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

const DIFFICULTY_COLOR: Record<string, string> = {
  basico: 'bg-status-generated/10 text-status-generated',
  intermedio: 'bg-status-expiring/10 text-status-expiring',
  avanzado: 'bg-status-expired/10 text-status-expired',
}

export function ExercisesPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [exercises, setExercises] = useState<ExerciseWithGroup[]>([])
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('')
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
    const matchSearch =
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.muscle_group?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchGroup = filterGroup === '' || e.muscle_group_id === filterGroup
    const matchDiff = filterDifficulty === '' || e.difficulty === filterDifficulty
    return matchSearch && matchGroup && matchDiff
  })

  async function handleDelete() {
    if (!deleteTarget || !user) return
    setDeleting(true)
    const { error } = await supabase
      .from('exercise_library')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('owner_id', user.id)   // ← solo el dueño puede eliminar
    setDeleting(false)
    if (error) { toast.error(error.message); return }
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
    setMuscleGroups((prev) => [...prev, created].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)))
    setFilterGroup(created.id)
    toast.success('Categoría creada')
    setNewCategoryName('')
    setShowCategoryPanel(false)
  }

  return (
    <div>
      <Header
        title="Ejercicios"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={<Tags className="h-4 w-4" />}
              onClick={() => setShowCategoryPanel((v) => !v)}
            >
              Nueva categoría
            </Button>
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/exercises/new')}>
              Nuevo
            </Button>
          </div>
        }
      />

      <div className="px-4 lg:px-6 py-6 space-y-5">
        {showCategoryPanel && (
          <div className="rounded-xl border border-brand-primary/25 bg-brand-primary/5 p-4 space-y-3">
            <p className="text-xs font-semibold text-ink-primary">Nueva categoría (grupo muscular)</p>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-1 min-w-0">
                <Input
                  placeholder="Nombre de la categoría *"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="text-sm"
                />
              </div>
              <Button
                size="sm"
                loading={creatingCategory}
                disabled={!newCategoryName.trim()}
                onClick={createMuscleCategory}
              >
                Crear
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => { setShowCategoryPanel(false); setNewCategoryName('') }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
        {/* Filtros */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <Input
              placeholder="Buscar ejercicio o músculo..."
              leftIcon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="bg-surface-card border border-surface-border text-ink-secondary text-xs rounded-xl px-3 py-1.5 focus:border-brand-primary outline-none"
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
          >
            <option value="">Todos los músculos</option>
            {muscleGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select
            className="bg-surface-card border border-surface-border text-ink-secondary text-xs rounded-xl px-3 py-1.5 focus:border-brand-primary outline-none"
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
          >
            <option value="">Todos los niveles</option>
            <option value="basico">Básico</option>
            <option value="intermedio">Intermedio</option>
            <option value="avanzado">Avanzado</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Dumbbell className="h-8 w-8" />}
            title="Sin ejercicios"
            description="Ajustá los filtros o creá un ejercicio nuevo."
            action={{ label: 'Nuevo ejercicio', onClick: () => navigate('/exercises/new'), icon: <Plus className="h-4 w-4" /> }}
          />
        ) : (
          <div className="w-full overflow-x-auto rounded-2xl border border-surface-border bg-surface-card">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-widest w-[30%]">
                    Ejercicio
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-widest w-[18%] hidden sm:table-cell">
                    Músculo
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-widest w-[14%]">
                    Dificultad
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-widest hidden lg:table-cell">
                    Equipamiento
                  </th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((exercise, i) => (
                  <tr
                    key={exercise.id}
                    className={cn(
                      'group transition-colors hover:bg-surface-elevated',
                      i !== filtered.length - 1 && 'border-b border-surface-border'
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink-primary">{exercise.name}</span>
                        {!exercise.is_active && (
                          <span className="text-[10px] font-medium text-ink-muted bg-surface-elevated px-1.5 py-0.5 rounded-md">
                            Inactivo
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-ink-secondary hidden sm:table-cell">
                      {exercise.muscle_group?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn(
                        'text-[11px] font-semibold px-2 py-0.5 rounded-md',
                        DIFFICULTY_COLOR[exercise.difficulty]
                      )}>
                        {DIFFICULTY_LABEL[exercise.difficulty] ?? exercise.difficulty}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted hidden lg:table-cell">
                      {exercise.equipment && exercise.equipment.length > 0
                        ? exercise.equipment.join(', ')
                        : '—'}
                    </td>
                    <td className="pr-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(exercise) }}
                          className="p-1.5 rounded-lg text-ink-muted hover:text-status-expired hover:bg-status-expired/10 transition-colors opacity-0 group-hover:opacity-100"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/exercises/${exercise.id}/edit`) }}
                          className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-border transition-colors opacity-0 group-hover:opacity-100"
                          title="Editar"
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
