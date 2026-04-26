import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'
import type { RoutineBlock, RoutineDay, RoutineExercise, Exercise, Routine, Student } from '@/types/database'
import toast from 'react-hot-toast'

type DayWithExercises = RoutineDay & { exercises: RoutineExerciseWithExercise[] }
type BlockWithDays = RoutineBlock & { days: DayWithExercises[] }
type RoutineExerciseWithExercise = RoutineExercise & { exercise?: Exercise }
type RoutineFull = Routine & { student?: Student }

export function RoutineEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [routine, setRoutine] = useState<RoutineFull | null>(null)
  const [blocks, setBlocks] = useState<BlockWithDays[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set())
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
  const [showExercisePicker, setShowExercisePicker] = useState<{ dayId: string } | null>(null)

  const fetchData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [routineRes, blocksRes] = await Promise.all([
      supabase.from('routines').select('*, student:students(full_name)').eq('id', id).single(),
      supabase
        .from('routine_blocks')
        .select(`*, days:routine_days(*, exercises:routine_exercises(*, exercise:exercise_library(*)))`)
        .eq('routine_id', id)
        .order('sort_order'),
    ])
    if (routineRes.data) setRoutine(routineRes.data as unknown as RoutineFull)
    if (blocksRes.data) {
      const sorted = (blocksRes.data as unknown as BlockWithDays[]).map((b) => ({
        ...b,
        days: [...(b.days ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((d) => ({
          ...d,
          exercises: [...(d.exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order),
        })),
      }))
      setBlocks(sorted)
      setExpandedBlocks(new Set(sorted.map((b) => b.id)))
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  async function addBlock() {
    if (!id) return
    const { data, error } = await supabase
      .from('routine_blocks')
      .insert({ routine_id: id, name: `Semana ${blocks.length + 1}`, sort_order: blocks.length })
      .select()
      .single()
    if (error) { toast.error(error.message); return }
    const newBlock = { ...data, days: [] } as BlockWithDays
    setBlocks((prev) => [...prev, newBlock])
    setExpandedBlocks((prev) => new Set([...prev, data.id]))
  }

  async function updateBlock(blockId: string, name: string) {
    await supabase.from('routine_blocks').update({ name }).eq('id', blockId)
    setBlocks((prev) => prev.map((b) => b.id === blockId ? { ...b, name } : b))
  }

  async function deleteBlock(blockId: string) {
    const { error } = await supabase.from('routine_blocks').delete().eq('id', blockId)
    if (error) { toast.error(error.message); return }
    setBlocks((prev) => prev.filter((b) => b.id !== blockId))
    toast.success('Semana eliminada')
  }

  async function addDay(blockId: string) {
    const block = blocks.find((b) => b.id === blockId)
    if (!block) return
    const { data, error } = await supabase
      .from('routine_days')
      .insert({ block_id: blockId, day_name: `Día ${block.days.length + 1}`, sort_order: block.days.length })
      .select()
      .single()
    if (error) { toast.error(error.message); return }
    const newDay = { ...data, exercises: [] } as DayWithExercises
    setBlocks((prev) => prev.map((b) => b.id === blockId ? { ...b, days: [...b.days, newDay] } : b))
    setExpandedDays((prev) => new Set([...prev, data.id]))
  }

  async function updateDay(blockId: string, dayId: string, patch: Partial<RoutineDay>) {
    await supabase.from('routine_days').update(patch).eq('id', dayId)
    setBlocks((prev) => prev.map((b) =>
      b.id === blockId ? { ...b, days: b.days.map((d) => d.id === dayId ? { ...d, ...patch } : d) } : b
    ))
  }

  async function deleteDay(blockId: string, dayId: string) {
    const { error } = await supabase.from('routine_days').delete().eq('id', dayId)
    if (error) { toast.error(error.message); return }
    setBlocks((prev) => prev.map((b) =>
      b.id === blockId ? { ...b, days: b.days.filter((d) => d.id !== dayId) } : b
    ))
    toast.success('Día eliminado')
  }

  async function addExercise(dayId: string, exercise: Exercise) {
    const block = blocks.find((b) => b.days.some((d) => d.id === dayId))
    const day = block?.days.find((d) => d.id === dayId)
    const sortOrder = day?.exercises.length ?? 0
    const { data, error } = await supabase
      .from('routine_exercises')
      .insert({ day_id: dayId, exercise_id: exercise.id, sort_order: sortOrder, sets: 3, reps_min: 8, reps_max: 12, is_superset: false })
      .select('*, exercise:exercise_library(*)')
      .single()
    if (error) { toast.error(error.message); return }
    const newEx = data as unknown as RoutineExerciseWithExercise
    setBlocks((prev) => prev.map((b) => ({
      ...b,
      days: b.days.map((d) => d.id === dayId ? { ...d, exercises: [...d.exercises, newEx] } : d),
    })))
    setShowExercisePicker(null)
  }

  async function updateExercise(dayId: string, exId: string, patch: Partial<RoutineExercise>) {
    await supabase.from('routine_exercises').update(patch).eq('id', exId)
    setBlocks((prev) => prev.map((b) => ({
      ...b,
      days: b.days.map((d) => d.id === dayId ? {
        ...d,
        exercises: d.exercises.map((e) => e.id === exId ? { ...e, ...patch } : e),
      } : d),
    })))
  }

  async function deleteExercise(dayId: string, exId: string) {
    const { error } = await supabase.from('routine_exercises').delete().eq('id', exId)
    if (error) { toast.error(error.message); return }
    setBlocks((prev) => prev.map((b) => ({
      ...b,
      days: b.days.map((d) => d.id === dayId ? { ...d, exercises: d.exercises.filter((e) => e.id !== exId) } : d),
    })))
  }

  if (loading) return <div><Header title="Editor de Rutina" showBack /><div className="flex justify-center py-16"><Spinner size="lg" /></div></div>

  return (
    <div>
      <Header
        title={routine?.student?.full_name ?? 'Editor de Rutina'}
        showBack
        actions={
          <Button size="sm" onClick={() => navigate(`/routines/${id}`)}>
            <Check className="h-4 w-4 mr-1" /> Finalizar
          </Button>
        }
      />

      <div className="px-4 lg:px-6 py-6 max-w-3xl space-y-4">
        {routine && (
          <div className="bg-surface-card border border-surface-border rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-xs text-ink-muted">Rutina:</span>
            <span className="text-sm font-semibold text-ink-primary">{routine.name}</span>
            <span className="ml-auto text-xs text-ink-muted">{routine.duration_days} días</span>
          </div>
        )}

        {blocks.map((block) => (
          <BlockCard
            key={block.id}
            block={block}
            expanded={expandedBlocks.has(block.id)}
            expandedDays={expandedDays}
            onToggle={() => setExpandedBlocks((prev) => {
              const next = new Set(prev)
              next.has(block.id) ? next.delete(block.id) : next.add(block.id)
              return next
            })}
            onToggleDay={(dayId) => setExpandedDays((prev) => {
              const next = new Set(prev)
              next.has(dayId) ? next.delete(dayId) : next.add(dayId)
              return next
            })}
            onUpdateBlock={(name) => updateBlock(block.id, name)}
            onDeleteBlock={() => deleteBlock(block.id)}
            onAddDay={() => addDay(block.id)}
            onUpdateDay={(dayId, patch) => updateDay(block.id, dayId, patch)}
            onDeleteDay={(dayId) => deleteDay(block.id, dayId)}
            onAddExercise={(dayId) => setShowExercisePicker({ dayId })}
            onUpdateExercise={updateExercise}
            onDeleteExercise={deleteExercise}
          />
        ))}

        <Button variant="secondary" className="w-full" icon={<Plus className="h-4 w-4" />} onClick={addBlock}>
          Agregar semana / bloque
        </Button>
      </div>

      {showExercisePicker && (
        <ExercisePicker
          onSelect={(ex) => addExercise(showExercisePicker.dayId, ex)}
          onClose={() => setShowExercisePicker(null)}
        />
      )}
    </div>
  )
}

/* ─── BlockCard ─────────────────────────────────────── */
function BlockCard({
  block, expanded, expandedDays, onToggle, onToggleDay,
  onUpdateBlock, onDeleteBlock, onAddDay,
  onUpdateDay, onDeleteDay, onAddExercise, onUpdateExercise, onDeleteExercise,
}: {
  block: BlockWithDays
  expanded: boolean
  expandedDays: Set<string>
  onToggle: () => void
  onToggleDay: (id: string) => void
  onUpdateBlock: (name: string) => void
  onDeleteBlock: () => void
  onAddDay: () => void
  onUpdateDay: (dayId: string, patch: Partial<RoutineDay>) => void
  onDeleteDay: (dayId: string) => void
  onAddExercise: (dayId: string) => void
  onUpdateExercise: (dayId: string, exId: string, patch: Partial<RoutineExercise>) => void
  onDeleteExercise: (dayId: string, exId: string) => void
}) {
  const [showDelete, setShowDelete] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(block.name)

  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-surface-elevated transition-colors"
        onClick={onToggle}
      >
        <GripVertical className="h-4 w-4 text-ink-muted shrink-0" />
        {editingName ? (
          <input
            autoFocus
            className="flex-1 bg-surface-elevated text-ink-primary text-sm font-semibold rounded-lg px-2 py-1 border border-surface-border focus:border-brand-primary outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { onUpdateBlock(name); setEditingName(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { onUpdateBlock(name); setEditingName(false) } }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1 text-sm font-semibold text-ink-primary hover:text-brand-primary transition-colors"
            onDoubleClick={(e) => { e.stopPropagation(); setEditingName(true) }}
          >
            {block.name}
          </span>
        )}
        <span className="text-xs text-ink-muted">{block.days.length} días</span>
        {expanded ? <ChevronDown className="h-4 w-4 text-ink-muted" /> : <ChevronRight className="h-4 w-4 text-ink-muted" />}
        <button onClick={(e) => { e.stopPropagation(); setShowDelete(true) }} className="text-ink-muted hover:text-status-expired transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {block.days.map((day) => (
            <DayCard
              key={day.id}
              day={day}
              expanded={expandedDays.has(day.id)}
              onToggle={() => onToggleDay(day.id)}
              onUpdateDay={(patch) => onUpdateDay(day.id, patch)}
              onDeleteDay={() => onDeleteDay(day.id)}
              onAddExercise={() => onAddExercise(day.id)}
              onUpdateExercise={(exId, patch) => onUpdateExercise(day.id, exId, patch)}
              onDeleteExercise={(exId) => onDeleteExercise(day.id, exId)}
            />
          ))}
          <button
            onClick={onAddDay}
            className="w-full flex items-center justify-center gap-2 text-xs text-ink-muted hover:text-brand-primary py-2 border border-dashed border-surface-border rounded-xl hover:border-brand-primary/50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar día
          </button>
        </div>
      )}

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={onDeleteBlock}
        title={`¿Eliminar "${block.name}"?`}
        description="Se eliminarán todos los días y ejercicios de esta semana."
        confirmLabel="Eliminar"
      />
    </div>
  )
}

/* ─── DayCard ─────────────────────────────────────── */
function DayCard({
  day, expanded, onToggle, onUpdateDay, onDeleteDay, onAddExercise, onUpdateExercise, onDeleteExercise,
}: {
  day: DayWithExercises
  expanded: boolean
  onToggle: () => void
  onUpdateDay: (patch: Partial<RoutineDay>) => void
  onDeleteDay: () => void
  onAddExercise: () => void
  onUpdateExercise: (exId: string, patch: Partial<RoutineExercise>) => void
  onDeleteExercise: (exId: string) => void
}) {
  const [showDelete, setShowDelete] = useState(false)

  return (
    <div className="bg-surface-elevated border border-surface-border rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-surface-card transition-colors"
        onClick={onToggle}
      >
        <span className="flex-1 text-sm font-medium text-ink-primary">{day.day_name}</span>
        {day.muscle_focus && <span className="text-xs text-ink-muted">{day.muscle_focus}</span>}
        <span className="text-xs text-ink-muted">{day.exercises.length} ejerc.</span>
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-ink-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-ink-muted" />}
        <button onClick={(e) => { e.stopPropagation(); setShowDelete(true) }} className="text-ink-muted hover:text-status-expired transition-colors ml-1">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-surface-border pt-2">
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Nombre del día"
              value={day.day_name}
              onChange={(e) => onUpdateDay({ day_name: e.target.value })}
              className="text-xs h-8"
            />
            <Input
              placeholder="Foco muscular"
              value={day.muscle_focus ?? ''}
              onChange={(e) => onUpdateDay({ muscle_focus: e.target.value || null })}
              className="text-xs h-8"
            />
          </div>
          <Textarea
            placeholder="Entrada en calor..."
            value={day.warmup_notes ?? ''}
            onChange={(e) => onUpdateDay({ warmup_notes: e.target.value || null })}
            rows={2}
            className="text-xs"
          />

          {day.exercises.map((ex) => (
            <ExerciseRow
              key={ex.id}
              exercise={ex}
              onUpdate={(patch) => onUpdateExercise(ex.id, patch)}
              onDelete={() => onDeleteExercise(ex.id)}
            />
          ))}

          <button
            onClick={onAddExercise}
            className="w-full flex items-center justify-center gap-2 text-xs text-ink-muted hover:text-brand-primary py-1.5 border border-dashed border-surface-border rounded-lg hover:border-brand-primary/50 transition-colors"
          >
            <Plus className="h-3 w-3" /> Agregar ejercicio
          </button>
        </div>
      )}

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={onDeleteDay}
        title={`¿Eliminar "${day.day_name}"?`}
        description="Se eliminarán todos los ejercicios de este día."
        confirmLabel="Eliminar"
      />
    </div>
  )
}

/* ─── ExerciseRow ─────────────────────────────────── */
function ExerciseRow({ exercise, onUpdate, onDelete }: {
  exercise: RoutineExerciseWithExercise
  onUpdate: (patch: Partial<RoutineExercise>) => void
  onDelete: () => void
}) {
  return (
    <div className="bg-surface-card rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <GripVertical className="h-3.5 w-3.5 text-ink-muted shrink-0" />
        <span className="flex-1 text-xs font-semibold text-ink-primary truncate">
          {exercise.exercise?.name ?? 'Ejercicio'}
        </span>
        <button onClick={onDelete} className="text-ink-muted hover:text-status-expired transition-colors">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <NumInput label="Series" value={exercise.sets} onChange={(v) => onUpdate({ sets: v })} />
        <NumInput label="Reps min" value={exercise.reps_min} onChange={(v) => onUpdate({ reps_min: v })} />
        <NumInput label="Reps max" value={exercise.reps_max} onChange={(v) => onUpdate({ reps_max: v })} />
        <NumInput label="Descanso s" value={exercise.rest_seconds} onChange={(v) => onUpdate({ rest_seconds: v })} />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <NumInput label="Peso kg" value={exercise.weight_kg} onChange={(v) => onUpdate({ weight_kg: v })} />
        <NumInput label="RIR" value={exercise.rir} onChange={(v) => onUpdate({ rir: v })} />
        <NumInput label="RPE" value={exercise.rpe} onChange={(v) => onUpdate({ rpe: v })} />
      </div>
      <input
        className="w-full bg-surface-elevated text-ink-secondary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none placeholder:text-ink-muted"
        placeholder="Notas técnicas..."
        value={exercise.technical_notes ?? ''}
        onChange={(e) => onUpdate({ technical_notes: e.target.value || null })}
      />
    </div>
  )
}

function NumInput({ label, value, onChange }: { label: string; value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <div>
      <label className="block text-[10px] text-ink-muted mb-0.5">{label}</label>
      <input
        type="number"
        min={0}
        className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none text-center"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
    </div>
  )
}

/* ─── ExercisePicker ──────────────────────────────── */
function ExercisePicker({ onSelect, onClose }: { onSelect: (ex: Exercise) => void; onClose: () => void }) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('exercise_library')
      .select('*, muscle_group:muscle_groups(name)')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => { setExercises((data as Exercise[]) ?? []); setLoading(false) })
  }, [])

  const filtered = exercises.filter(
    (e) => e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.muscle_group as unknown as { name: string })?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card border border-surface-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[70vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-ink-primary">Seleccionar ejercicio</h3>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary text-xs">Cerrar</button>
        </div>
        <div className="px-4 py-3">
          <input
            autoFocus
            placeholder="Buscar..."
            className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary outline-none placeholder:text-ink-muted"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-1.5">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-ink-muted text-sm py-8">Sin resultados</p>
          ) : (
            filtered.map((ex) => (
              <button
                key={ex.id}
                onClick={() => onSelect(ex)}
                className={cn(
                  'w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left',
                  'hover:bg-surface-elevated transition-colors'
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-primary truncate">{ex.name}</p>
                  <p className="text-xs text-ink-muted">{(ex.muscle_group as unknown as { name: string })?.name}</p>
                </div>
                <span className={cn(
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 mt-0.5',
                  ex.difficulty === 'basico' ? 'bg-status-generated/10 text-status-generated' :
                  ex.difficulty === 'intermedio' ? 'bg-status-expiring/10 text-status-expiring' :
                  'bg-status-expired/10 text-status-expired'
                )}>
                  {ex.difficulty}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
