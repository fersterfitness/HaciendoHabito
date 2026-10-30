import { useEffect, useState, useMemo } from 'react'
import { Plus, ChevronDown, ChevronRight, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { slugifyMuscleCatalogName, nextMuscleGroupSortOrder } from '@/lib/exercise/muscleGroupCatalog'
import type { Exercise, MuscleGroup } from '@/types/database'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
import { type ExerciseWithGroup, type MuscleGroupOption } from './routineDetailShared'

export function ExercisePicker({
  onSelect,
  onClose,
  title = 'Seleccionar ejercicio',
  subtitle,
}: {
  onSelect: (ex: Exercise) => void
  onClose: () => void
  title?: string
  subtitle?: string
}) {
  const { user } = useAuthStore()
  const [exercises, setExercises]   = useState<ExerciseWithGroup[]>([])
  const [muscleCatalog, setMuscleCatalog] = useState<MuscleGroup[]>([])
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [showNewForm, setShowNewForm] = useState<null | 'exercise' | 'category'>(null)
  const [newName, setNewName]             = useState('')
  const [newGroupId, setNewGroupId]       = useState('')
  const [newDifficulty, setNewDifficulty] = useState<'basico' | 'intermedio' | 'avanzado'>('basico')
  const [creating, setCreating]           = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      supabase.from('exercise_library').select('*, muscle_group:muscle_groups(id, name, sort_order)').eq('is_active', true).order('name'),
      supabase.from('muscle_groups').select('*').order('sort_order'),
    ]).then(([exRes, mgRes]) => {
      if (cancelled) return
      if (exRes.error) toast.error(exRes.error.message)
      else setExercises((exRes.data as ExerciseWithGroup[]) ?? [])
      if (mgRes.error) toast.error(mgRes.error.message)
      else setMuscleCatalog((mgRes.data as MuscleGroup[]) ?? [])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  /** Todas las categorías del catálogo (incluidas vacías), para listado y desplegable “nuevo ejercicio”. */
  const groups = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; sort_order: number; exercises: ExerciseWithGroup[] }>()
    for (const mg of muscleCatalog) {
      byId.set(mg.id, { id: mg.id, name: mg.name, sort_order: mg.sort_order, exercises: [] })
    }
    const orphan: ExerciseWithGroup[] = []
    for (const ex of exercises) {
      const mgId = ex.muscle_group_id
      const bucket = mgId ? byId.get(mgId) : undefined
      if (bucket) bucket.exercises.push(ex)
      else orphan.push(ex)
    }
    const list = Array.from(byId.values())
    if (orphan.length > 0) {
      list.push({ id: 'other', name: 'Sin categoría', sort_order: 9999, exercises: orphan })
    }
    return list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  }, [exercises, muscleCatalog])

  const muscleGroupOptions: MuscleGroupOption[] = useMemo(
    () => muscleCatalog.map((g) => ({ id: g.id, name: g.name })),
    [muscleCatalog],
  )

  const filtered = search.trim()
    ? exercises.filter((e) =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        (e.muscle_group as { name: string } | undefined)?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : null

  async function createExercise() {
    if (!newName.trim() || !newGroupId) return
    setCreating(true)
    const slug = newName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now()
    const { data, error } = await supabase
      .from('exercise_library')
      .insert({ name: newName.trim(), slug, muscle_group_id: newGroupId, difficulty: newDifficulty, is_active: true, is_system: false, owner_id: user?.id ?? null })
      .select('*, muscle_group:muscle_groups(id, name, sort_order)').single()
    setCreating(false)
    if (error) { toast.error('Error al crear ejercicio'); return }
    toast.success('Ejercicio creado')
    onSelect(data as Exercise)
  }

  async function createCategory() {
    if (!newCategoryName.trim()) return
    const upperName = newCategoryName.trim().toUpperCase()
    const exists = muscleCatalog.some((g) => g.name.toUpperCase() === upperName)
    if (exists) { toast.error(`La categoría "${upperName}" ya existe`); return }
    setCreatingCategory(true)
    const slugBase = slugifyMuscleCatalogName(newCategoryName)
    const slug = `${slugBase}-${Date.now()}`
    const nextSort = nextMuscleGroupSortOrder(muscleCatalog)
    const { data: row, error } = await supabase
      .from('muscle_groups')
      .insert({ name: upperName, slug, sort_order: nextSort })
      .select()
      .single()
    setCreatingCategory(false)
    if (error) {
      toast.error(error.message || 'Error al crear categoría')
      return
    }
    const created = row as MuscleGroup
    setMuscleCatalog((prev) => [...prev, created].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)))
    if (created.id) setOpenGroups((prev) => new Set(prev).add(created.id))
    toast.success('Categoría creada')
    setNewCategoryName('')
    setShowNewForm(null)
  }

  return (
    <Modal open onClose={onClose} size="lg" bare className="max-h-[80vh] flex flex-col">
    <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-surface-border">
      <div>
        <h3 className="text-sm font-semibold text-ink-primary">{title}</h3>
        {subtitle ? <p className="text-2xs text-ink-muted mt-1 leading-snug">{subtitle}</p> : null}
      </div>
      <button onClick={onClose} className="text-ink-muted hover:text-ink-primary shrink-0"><X className="h-4 w-4" /></button>
    </div>
    <div className="px-4 py-3">
      <input
        autoFocus
        placeholder="Buscar por nombre o grupo muscular..."
        className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary outline-none placeholder:text-ink-muted"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>
    <div className="overflow-y-auto flex-1 px-4 pb-2">
      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : filtered !== null ? (
        filtered.length === 0
          ? <p className="text-center text-ink-muted text-sm py-8">Sin resultados para "{search}"</p>
          : <div className="space-y-1">{filtered.map((ex) => <ExerciseItem key={ex.id} ex={ex} onSelect={onSelect} />)}</div>
      ) : (
        <div className="space-y-1.5">
          {groups.map((group) => (
            <div key={group.id} className="border border-surface-border rounded-xl overflow-hidden">
              <button
                onClick={() =>
                  setOpenGroups((prev) => {
                    const next = new Set(prev)
                    if (next.has(group.id)) next.delete(group.id)
                    else next.add(group.id)
                    return next
                  })
                }
                className="w-full flex items-center justify-between px-3 py-2.5 bg-surface-elevated hover:bg-surface-card transition-colors"
              >
                <span className="text-xs font-semibold text-ink-primary">{group.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-3xs text-ink-muted">{group.exercises.length}</span>
                  {openGroups.has(group.id) ? <ChevronDown className="h-3.5 w-3.5 text-ink-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-ink-muted" />}
                </div>
              </button>
              {openGroups.has(group.id) && (
                <div className="divide-y divide-surface-border">
                  {group.exercises.map((ex) => <ExerciseItem key={ex.id} ex={ex} onSelect={onSelect} inGroup />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    <div className="border-t border-surface-border px-4 py-3">
      {showNewForm === null ? (
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewForm('exercise')}
            className="flex-1 flex items-center justify-center gap-2 text-xs text-brand-primary hover:text-brand-primary/80 py-2 border border-dashed border-brand-primary/30 rounded-xl hover:border-brand-primary/60 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Crear ejercicio nuevo
          </button>
          <button
            onClick={() => setShowNewForm('category')}
            className="flex-1 flex items-center justify-center gap-2 text-xs text-ink-muted hover:text-ink-primary py-2 border border-dashed border-surface-border rounded-xl hover:border-surface-border/80 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Nueva categoría
          </button>
        </div>
      ) : showNewForm === 'exercise' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-ink-primary">Nuevo ejercicio</span>
            <button onClick={() => setShowNewForm(null)} className="text-ink-muted hover:text-ink-primary"><X className="h-3.5 w-3.5" /></button>
          </div>
          <input
            autoFocus
            placeholder="Nombre del ejercicio *"
            className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-3 py-2 border border-surface-border focus:border-brand-primary outline-none placeholder:text-ink-muted"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              className="w-full rounded-lg border border-surface-inputBorder bg-surface-input px-3 py-2 text-xs text-ink-primary shadow-xs outline-none hover:border-ink-muted/50 focus:border-brand-primary/60"
              value={newGroupId}
              onChange={(e) => setNewGroupId(e.target.value)}
            >
              <option value="">Grupo muscular *</option>
              {muscleGroupOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select
              className="w-full rounded-lg border border-surface-inputBorder bg-surface-input px-3 py-2 text-xs text-ink-primary shadow-xs outline-none hover:border-ink-muted/50 focus:border-brand-primary/60"
              value={newDifficulty}
              onChange={(e) => setNewDifficulty(e.target.value as 'basico' | 'intermedio' | 'avanzado')}
            >
              <option value="basico">Básico</option>
              <option value="intermedio">Intermedio</option>
              <option value="avanzado">Avanzado</option>
            </select>
          </div>
          <Button className="w-full" size="sm" loading={creating} disabled={!newName.trim() || !newGroupId} onClick={createExercise}>
            Crear y agregar
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-ink-primary">Nueva categoría</span>
            <button onClick={() => setShowNewForm(null)} className="text-ink-muted hover:text-ink-primary"><X className="h-3.5 w-3.5" /></button>
          </div>
          <input
            autoFocus
            placeholder="Nombre de la categoría *"
            className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-3 py-2 border border-surface-border focus:border-brand-primary outline-none placeholder:text-ink-muted"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />
          <Button className="w-full" size="sm" loading={creatingCategory} disabled={!newCategoryName.trim()} onClick={createCategory}>
            Crear categoría
          </Button>
        </div>
      )}
    </div>
    </Modal>
  )
}

function ExerciseItem({ ex, onSelect, inGroup }: { ex: ExerciseWithGroup; onSelect: (ex: Exercise) => void; inGroup?: boolean }) {
  return (
    <button
      onClick={() => onSelect(ex)}
      className={cn('w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors', inGroup ? 'hover:bg-surface-elevated' : 'hover:bg-surface-elevated rounded-xl')}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-primary truncate">{ex.name}</p>
        {!inGroup && <p className="text-xs text-ink-muted">{(ex.muscle_group as { name: string } | undefined)?.name}</p>}
      </div>
      <span className={cn(
        'text-3xs font-semibold px-1.5 py-0.5 rounded-md shrink-0',
        ex.difficulty === 'basico'     ? 'bg-status-generated/10 text-status-generated' :
        ex.difficulty === 'intermedio' ? 'bg-status-expiring/10 text-status-expiring'   :
                                         'bg-status-expired/10 text-status-expired'
      )}>
        {ex.difficulty}
      </span>
    </button>
  )
}
