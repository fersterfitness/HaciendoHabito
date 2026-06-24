import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Boxes, X, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { ExercisesSectionNav } from '@/components/exercises/ExercisesSectionNav'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type {
  Exercise,
  PresetBlock,
  PresetBlockCategory,
  PresetBlockExercise,
} from '@/types/database'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type BlockRow = PresetBlock & { category?: PresetBlockCategory | null }

function emptyExercise(): PresetBlockExercise {
  return {
    exercise_id: null,
    name: '',
    is_superset: false,
    superset_group: null,
    sets: 3,
    reps_scheme: '',
    rest_seconds: null,
    rpe: null,
    rir: null,
    percent_rm: null,
    weeks: null,
  }
}

export function PresetBlocksPage() {
  const { user } = useAuthStore()
  const [categories, setCategories] = useState<PresetBlockCategory[]>([])
  const [blocks, setBlocks] = useState<BlockRow[]>([])
  const [library, setLibrary] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [deleteBlock, setDeleteBlock] = useState<BlockRow | null>(null)

  // Form
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<BlockRow | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [kind, setKind] = useState<'circuit' | 'individual'>('circuit')
  const [blockNote, setBlockNote] = useState('')
  const [weeksCount, setWeeksCount] = useState(1)
  const [exercises, setExercises] = useState<PresetBlockExercise[]>([emptyExercise()])
  const [saving, setSaving] = useState(false)
  const [openWeeks, setOpenWeeks] = useState<Set<number>>(new Set())

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: cats }, { data: blks }, { data: lib }] = await Promise.all([
      supabase.from('preset_block_categories').select('*').eq('owner_id', user.id).order('sort_order'),
      supabase
        .from('preset_blocks')
        .select('*, category:preset_block_categories(*)')
        .eq('owner_id', user.id)
        .order('sort_order'),
      supabase.from('exercise_library').select('*, muscle_group:muscle_groups(id, name)').eq('is_active', true).order('name'),
    ])
    setCategories((cats as PresetBlockCategory[]) ?? [])
    setBlocks((blks as unknown as BlockRow[]) ?? [])
    setLibrary((lib as Exercise[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    void reload()
  }, [reload])

  const filtered = useMemo(
    () => (filterCategoryId ? blocks.filter((b) => b.category_id === filterCategoryId) : blocks),
    [blocks, filterCategoryId],
  )

  const grouped = useMemo(() => {
    const map = new Map<string, { cat: PresetBlockCategory | null; items: BlockRow[] }>()
    for (const c of categories) map.set(c.id, { cat: c, items: [] })
    map.set('__none__', { cat: null, items: [] })
    for (const b of filtered) {
      const key = b.category_id ?? '__none__'
      if (!map.has(key)) map.set(key, { cat: b.category ?? null, items: [] })
      map.get(key)!.items.push(b)
    }
    return [...map.values()].filter((g) => g.items.length > 0 || g.cat)
  }, [categories, filtered])

  async function addCategory() {
    if (!user || !newCategoryName.trim()) return
    const { error } = await supabase.from('preset_block_categories').insert({
      owner_id: user.id,
      name: newCategoryName.trim(),
      sort_order: categories.length,
    })
    if (error) return toast.error(error.message)
    setNewCategoryName('')
    toast.success('Categoría creada')
    void reload()
  }

  function openNew() {
    setEditing(null)
    setName('')
    setDescription('')
    setCategoryId(filterCategoryId ?? categories[0]?.id ?? '')
    setKind('circuit')
    setBlockNote('')
    setWeeksCount(1)
    setExercises([emptyExercise()])
    setOpenWeeks(new Set())
    setFormOpen(true)
  }

  function openEdit(b: BlockRow) {
    setEditing(b)
    setName(b.name)
    setDescription(b.description ?? '')
    setCategoryId(b.category_id ?? '')
    setKind(b.kind)
    setBlockNote(b.block_note ?? '')
    setWeeksCount(b.weeks_count)
    setExercises(b.payload?.exercises?.length ? b.payload.exercises : [emptyExercise()])
    setOpenWeeks(new Set())
    setFormOpen(true)
  }

  function patchExercise(idx: number, patch: Partial<PresetBlockExercise>) {
    setExercises((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)))
  }

  function setWeekValue(exIdx: number, weekIdx: number, patch: Partial<NonNullable<PresetBlockExercise['weeks']>[number]>) {
    setExercises((prev) =>
      prev.map((e, i) => {
        if (i !== exIdx) return e
        const weeks = Array.from({ length: weeksCount }, (_, w) =>
          e.weeks?.[w] ?? { reps_scheme: null, percent_rm: null, sets: null },
        )
        weeks[weekIdx] = { ...weeks[weekIdx], ...patch }
        return { ...e, weeks }
      }),
    )
  }

  async function save() {
    if (!user || !name.trim()) return toast.error('Poné un nombre al preestablecido')
    const clean = exercises
      .filter((e) => e.exercise_id || e.name.trim())
      .map((e) => ({
        ...e,
        name: e.name.trim() || library.find((l) => l.id === e.exercise_id)?.name || 'Ejercicio',
        is_superset: kind === 'circuit',
        superset_group: kind === 'circuit' ? 1 : null,
        weeks: e.weeks && e.weeks.some((w) => w.reps_scheme || w.percent_rm != null || w.sets != null) ? e.weeks : null,
      }))
    if (clean.length === 0) return toast.error('Agregá al menos un ejercicio')

    setSaving(true)
    const payload = {
      owner_id: user.id,
      name: name.trim(),
      description: description.trim() || null,
      category_id: categoryId || null,
      kind,
      block_note: blockNote.trim() || null,
      weeks_count: weeksCount,
      payload: { exercises: clean },
    }
    const { error } = editing
      ? await supabase.from('preset_blocks').update(payload).eq('id', editing.id)
      : await supabase.from('preset_blocks').insert({ ...payload, sort_order: blocks.length })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success(editing ? 'Preestablecido actualizado' : 'Preestablecido creado')
    setFormOpen(false)
    void reload()
  }

  async function confirmDelete() {
    if (!deleteBlock) return
    const { error } = await supabase.from('preset_blocks').delete().eq('id', deleteBlock.id)
    if (error) return toast.error(error.message)
    toast.success('Eliminado')
    setDeleteBlock(null)
    void reload()
  }

  return (
    <div>
      <Header title="Ejercicios" />
      <div className="page-shell-x page-shell-y space-y-5">
        <ExercisesSectionNav />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-[52rem] text-sm text-ink-secondary">
            Circuitos y bloques ya armados (ejercicios, aclaración, reps, semanas, % RM, RPE, RIR, descanso) para copiar y
            pegar en una rutina. Organizalos por categorías como en Métodos.
          </p>
          <Button size="sm" variant="gradientSecondary" icon={<Plus className="h-4 w-4" />} onClick={openNew}>
            Nuevo preestablecido
          </Button>
        </div>

        {/* Categorías */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterCategoryId(null)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-xs font-semibold',
              !filterCategoryId ? 'border-brand-secondary/40 bg-brand-secondary/10 text-brand-secondary' : 'border-surface-border text-ink-secondary',
            )}
          >
            Todas
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilterCategoryId(c.id)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-xs font-semibold',
                filterCategoryId === c.id ? 'border-brand-secondary/40 bg-brand-secondary/10 text-brand-secondary' : 'border-surface-border text-ink-secondary',
              )}
            >
              {c.name}
            </button>
          ))}
          <div className="flex items-center gap-1">
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void addCategory() }}
              placeholder="+ categoría"
              className="w-28 rounded-lg border border-surface-border bg-surface-elevated px-2 py-1 text-xs text-ink-primary outline-none focus:border-brand-secondary"
            />
          </div>
        </div>

        {/* Editor */}
        {formOpen && (
          <div className="rounded-2xl border border-surface-border bg-surface-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink-primary">{editing ? 'Editar preestablecido' : 'Nuevo preestablecido'}</p>
              <button type="button" onClick={() => setFormOpen(false)} className="text-ink-muted hover:text-ink-primary"><X className="h-4 w-4" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input label="Nombre *" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Circuito core + glúteo" />
              <label className="block text-xs font-medium text-ink-secondary">
                Categoría
                <select
                  className="mt-1 w-full rounded-xl border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-ink-primary"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Sin categoría</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
              <label className="block text-xs font-medium text-ink-secondary">
                Tipo
                <select
                  className="mt-1 w-full rounded-xl border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-ink-primary"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as 'circuit' | 'individual')}
                >
                  <option value="circuit">Circuito</option>
                  <option value="individual">Individual</option>
                </select>
              </label>
              <Input
                label="Semanas"
                type="number"
                min={1}
                max={12}
                value={weeksCount}
                onChange={(e) => setWeeksCount(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
              />
              <div className="col-span-2">
                <Input label="Aclaración del bloque" value={blockNote} onChange={(e) => setBlockNote(e.target.value)} placeholder="Ej: 3 vueltas, 1' pausa" />
              </div>
            </div>

            {/* Ejercicios */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-ink-secondary">Ejercicios</p>
              {exercises.map((ex, i) => {
                const weeksOpen = openWeeks.has(i)
                return (
                  <div key={i} className="rounded-xl border border-surface-border bg-surface-elevated/40 p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        className="flex-1 rounded-lg border border-surface-border bg-surface-elevated px-2 py-1.5 text-xs text-ink-primary"
                        value={ex.exercise_id ?? ''}
                        onChange={(e) => {
                          const lib = library.find((l) => l.id === e.target.value)
                          patchExercise(i, { exercise_id: e.target.value || null, name: lib?.name ?? '' })
                        }}
                      >
                        <option value="">— Elegir ejercicio —</option>
                        {library.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                      <button type="button" onClick={() => setExercises((p) => p.filter((_, j) => j !== i))} className="text-ink-muted hover:text-status-expired" title="Quitar">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                      <NumField label="Series" value={ex.sets} onChange={(v) => patchExercise(i, { sets: v })} />
                      <TextField label="Reps" value={ex.reps_scheme} onChange={(v) => patchExercise(i, { reps_scheme: v })} placeholder="10" />
                      <TextField
                        label="Descanso"
                        value={ex.rest_seconds != null ? String(ex.rest_seconds) : ''}
                        onChange={(v) => patchExercise(i, { rest_seconds: v.trim() ? Number(v) || null : null })}
                        placeholder="seg"
                      />
                      <NumField label="RPE" value={ex.rpe} onChange={(v) => patchExercise(i, { rpe: v })} />
                      <NumField label="RIR" value={ex.rir} onChange={(v) => patchExercise(i, { rir: v })} />
                      <NumField label="% RM" value={ex.percent_rm} onChange={(v) => patchExercise(i, { percent_rm: v })} />
                    </div>
                    {weeksCount > 1 && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setOpenWeeks((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n })}
                          className="flex items-center gap-1 text-[11px] font-semibold text-brand-secondary"
                        >
                          {weeksOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          Plan por semana ({weeksCount})
                        </button>
                        {weeksOpen && (
                          <div className="mt-1.5 space-y-1">
                            {Array.from({ length: weeksCount }, (_, w) => {
                              const wk = ex.weeks?.[w]
                              return (
                                <div key={w} className="flex items-center gap-2">
                                  <span className="w-12 shrink-0 text-[10px] font-semibold text-ink-muted">Sem {w + 1}</span>
                                  <input
                                    value={wk?.reps_scheme ?? ''}
                                    onChange={(e) => setWeekValue(i, w, { reps_scheme: e.target.value || null })}
                                    placeholder="reps"
                                    className="flex-1 rounded-lg border border-surface-border bg-surface-elevated px-2 py-1 text-xs text-ink-primary outline-none focus:border-brand-secondary"
                                  />
                                  <input
                                    type="number"
                                    value={wk?.percent_rm ?? ''}
                                    onChange={(e) => setWeekValue(i, w, { percent_rm: e.target.value === '' ? null : Number(e.target.value) })}
                                    placeholder="%RM"
                                    className="w-16 rounded-lg border border-surface-border bg-surface-elevated px-2 py-1 text-xs text-ink-primary outline-none focus:border-brand-secondary"
                                  />
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              <Button type="button" variant="ghost" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setExercises((p) => [...p, emptyExercise()])}>
                Agregar ejercicio
              </Button>
            </div>

            <Textarea label="Descripción / notas (opcional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm" />

            <div className="flex gap-2">
              <Button type="button" variant="gradientSecondary" loading={saving} onClick={() => void save()}>Guardar</Button>
              <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {/* Listado */}
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : blocks.length === 0 ? (
          <EmptyState
            icon={<Boxes className="h-8 w-8" />}
            title="Sin preestablecidos"
            description="Armá circuitos o bloques listos para copiar y pegar en tus rutinas."
            action={{ label: 'Nuevo preestablecido', onClick: openNew, icon: <Plus className="h-4 w-4" /> }}
          />
        ) : (
          <div className="space-y-5">
            {grouped.map((g) => (
              <section key={g.cat?.id ?? '__none__'}>
                <h3 className="mb-2 border-b border-surface-border pb-1 text-sm font-bold uppercase tracking-wide text-ink-primary">
                  {g.cat?.name ?? 'Sin categoría'} <span className="text-[11px] font-normal text-ink-muted">({g.items.length})</span>
                </h3>
                <ul className="space-y-2">
                  {g.items.map((b) => (
                    <li key={b.id} className="flex items-start gap-3 rounded-xl border border-surface-border bg-surface-card px-4 py-3">
                      <Boxes className="h-4 w-4 shrink-0 mt-0.5 text-brand-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink-primary">
                          {b.name}
                          <span className="ml-2 rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
                            {b.kind === 'circuit' ? 'Circuito' : 'Individual'} · {b.payload?.exercises?.length ?? 0} ej. · {b.weeks_count} sem.
                          </span>
                        </p>
                        {b.block_note && <p className="mt-0.5 text-[11px] text-ink-muted">{b.block_note}</p>}
                        {b.description && <p className="mt-1 text-xs text-ink-secondary whitespace-pre-wrap">{b.description}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => openEdit(b)} className="rounded-lg p-2 text-ink-muted hover:text-brand-secondary hover:bg-brand-secondary/10" title="Editar"><Pencil className="h-4 w-4" /></button>
                        <button type="button" onClick={() => setDeleteBlock(b)} className="rounded-lg p-2 text-ink-muted hover:text-status-expired hover:bg-status-expired/10" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteBlock}
        onClose={() => setDeleteBlock(null)}
        onConfirm={confirmDelete}
        title="¿Eliminar preestablecido?"
        description="No afecta rutinas ya creadas."
        confirmLabel="Eliminar"
      />
    </div>
  )
}

function NumField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="block text-[10px] font-medium text-ink-muted">
      {label}
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="mt-0.5 w-full rounded-lg border border-surface-border bg-surface-elevated px-2 py-1 text-xs text-ink-primary outline-none focus:border-brand-secondary"
      />
    </label>
  )
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string | null; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block text-[10px] font-medium text-ink-muted">
      {label}
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-0.5 w-full rounded-lg border border-surface-border bg-surface-elevated px-2 py-1 text-xs text-ink-primary outline-none focus:border-brand-secondary"
      />
    </label>
  )
}
