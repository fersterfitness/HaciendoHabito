import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Layers } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { ExercisesSectionNav } from '@/components/exercises/ExercisesSectionNav'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { TrainingMethod, TrainingMethodCategory } from '@/types/database'
import toast from 'react-hot-toast'

type MethodRow = TrainingMethod & { category?: TrainingMethodCategory | null }

export function TrainingMethodsPage() {
  const { user } = useAuthStore()
  const [categories, setCategories] = useState<TrainingMethodCategory[]>([])
  const [methods, setMethods] = useState<MethodRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null)

  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingMethod, setEditingMethod] = useState<MethodRow | null>(null)
  const [methodName, setMethodName] = useState('')
  const [methodCategoryId, setMethodCategoryId] = useState('')
  const [methodReps, setMethodReps] = useState('')
  const [methodSets, setMethodSets] = useState('')
  const [methodGuide, setMethodGuide] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteMethod, setDeleteMethod] = useState<MethodRow | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: cats }, { data: mets }] = await Promise.all([
      supabase
        .from('training_method_categories')
        .select('*')
        .eq('owner_id', user.id)
        .order('sort_order'),
      supabase
        .from('training_methods')
        .select('*, category:training_method_categories(*)')
        .eq('owner_id', user.id)
        .order('sort_order'),
    ])
    setCategories((cats as TrainingMethodCategory[]) ?? [])
    setMethods((mets as unknown as MethodRow[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    void reload()
  }, [reload])

  const filtered = useMemo(() => {
    if (!filterCategoryId) return methods
    return methods.filter((m) => m.category_id === filterCategoryId)
  }, [methods, filterCategoryId])

  const grouped = useMemo(() => {
    const map = new Map<string, { cat: TrainingMethodCategory | null; items: MethodRow[] }>()
    for (const c of categories) {
      map.set(c.id, { cat: c, items: [] })
    }
    map.set('__none__', { cat: null, items: [] })
    for (const m of filtered) {
      const key = m.category_id ?? '__none__'
      if (!map.has(key)) map.set(key, { cat: m.category ?? null, items: [] })
      map.get(key)!.items.push(m)
    }
    return Array.from(map.values()).filter((g) => g.items.length > 0 || g.cat)
  }, [categories, filtered])

  function openNewMethod() {
    setFormOpen(true)
    setEditingMethod(null)
    setMethodName('')
    setMethodCategoryId(filterCategoryId ?? categories[0]?.id ?? '')
    setMethodReps('')
    setMethodSets('')
    setMethodGuide('')
  }

  function openEditMethod(m: MethodRow) {
    setFormOpen(true)
    setEditingMethod(m)
    setMethodName(m.name)
    setMethodCategoryId(m.category_id ?? '')
    setMethodReps(m.default_reps_scheme ?? '')
    setMethodSets(m.default_sets != null ? String(m.default_sets) : '')
    setMethodGuide(m.coach_guide ?? '')
  }

  async function addCategory() {
    if (!user || !newCategoryName.trim()) return
    const { error } = await supabase.from('training_method_categories').insert({
      owner_id: user.id,
      name: newCategoryName.trim(),
      sort_order: categories.length,
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Categoría creada')
      setNewCategoryName('')
      void reload()
    }
  }

  async function saveMethod() {
    if (!user || !methodName.trim()) {
      toast.error('El nombre del método es obligatorio')
      return
    }
    setSaving(true)
    const setsN = methodSets.trim() ? Number(methodSets) : null
    const payload = {
      owner_id: user.id,
      name: methodName.trim(),
      category_id: methodCategoryId || null,
      default_reps_scheme: methodReps.trim() || null,
      default_sets: setsN && setsN > 0 ? setsN : null,
      coach_guide: methodGuide.trim() || null,
    }
    if (editingMethod) {
      const { error } = await supabase.from('training_methods').update(payload).eq('id', editingMethod.id)
      if (error) toast.error(error.message)
      else {
        toast.success('Método actualizado')
        setEditingMethod(null)
        setFormOpen(false)
        void reload()
      }
    } else {
      const { error } = await supabase.from('training_methods').insert({ ...payload, sort_order: methods.length })
      if (error) toast.error(error.message)
      else {
        toast.success('Método creado')
        setEditingMethod(null)
        setFormOpen(false)
        void reload()
      }
    }
    setSaving(false)
  }

  async function confirmDeleteMethod() {
    if (!deleteMethod) return
    const { error } = await supabase.from('training_methods').delete().eq('id', deleteMethod.id)
    if (error) toast.error(error.message)
    else {
      toast.success('Método eliminado')
      void reload()
    }
    setDeleteMethod(null)
  }

  return (
    <div>
      <Header title="Ejercicios" />

      <div className="page-shell-x page-shell-y space-y-4">
        <ExercisesSectionNav />

        <p className="text-xs text-ink-muted leading-relaxed max-w-2xl">
          Cargá sistemas reutilizables (wave loading, cluster, etc.) por categoría. La guía del coach es privada: no
          aparece en el PDF ni para el alumno. En la rutina podés elegir un método y seguir editando reps a mano.
        </p>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1 max-w-xs">
            <Input
              label="Nueva categoría"
              placeholder="Ej: Hipertrofia, Fuerza…"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void addCategory()}
            />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void addCategory()}>
            Agregar categoría
          </Button>
        </div>

        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFilterCategoryId(null)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                filterCategoryId === null
                  ? 'border-brand-secondary/30 bg-brand-secondary/10 text-ink-primary'
                  : 'border-transparent bg-surface-elevated text-ink-secondary'
              }`}
            >
              Todas
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilterCategoryId(c.id)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterCategoryId === c.id
                    ? 'border-brand-secondary/30 bg-brand-secondary/10 text-ink-primary'
                    : 'border-transparent bg-surface-elevated text-ink-secondary'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="gradientSecondary"
            icon={<Plus className="h-4 w-4" />}
            onClick={openNewMethod}
          >
            Nuevo método
          </Button>
        </div>

        {formOpen && (
          <div className="rounded-2xl border border-surface-border bg-surface-card p-4 space-y-3 max-w-xl">
            <p className="text-sm font-semibold text-ink-primary">
              {editingMethod ? 'Editar método' : 'Nuevo método'}
            </p>
            <Input label="Nombre *" value={methodName} onChange={(e) => setMethodName(e.target.value)} />
            <label className="block text-xs font-medium text-ink-secondary">
              Categoría
              <select
                className="mt-1 w-full rounded-xl border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-ink-primary"
                value={methodCategoryId}
                onChange={(e) => setMethodCategoryId(e.target.value)}
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Reps sugeridas (opcional)"
                placeholder="ej: 6 / 8 / 10 / 12"
                value={methodReps}
                onChange={(e) => setMethodReps(e.target.value)}
              />
              <Input
                label="Series sugeridas"
                type="number"
                min={1}
                max={20}
                value={methodSets}
                onChange={(e) => setMethodSets(e.target.value)}
              />
            </div>
            <Textarea
              label="Guía del coach (privada, no va al PDF)"
              rows={6}
              placeholder="Qué es el método, cómo aplicarlo, progresión…"
              value={methodGuide}
              onChange={(e) => setMethodGuide(e.target.value)}
              className="min-h-[8rem] resize-y text-sm"
            />
            <div className="flex gap-2">
              <Button type="button" variant="gradientSecondary" loading={saving} onClick={() => void saveMethod()}>
                Guardar
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setFormOpen(false)
                  setEditingMethod(null)
                  setMethodName('')
                  setMethodReps('')
                  setMethodSets('')
                  setMethodGuide('')
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : methods.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-8 w-8" />}
            title="Sin métodos cargados"
            description="Creá categorías y métodos para usarlos al armar rutinas."
            action={{ label: 'Nuevo método', onClick: openNewMethod, icon: <Plus className="h-4 w-4" /> }}
          />
        ) : (
          <div className="space-y-6">
            {grouped.map(({ cat, items }) => (
              <section key={cat?.id ?? 'none'}>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">
                  {cat?.name ?? 'Sin categoría'}
                </h2>
                <ul className="space-y-2">
                  {items.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-surface-border bg-surface-card px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-primary">{m.name}</p>
                        {m.default_reps_scheme ? (
                          <p className="text-xs text-ink-muted mt-0.5">Reps: {m.default_reps_scheme}</p>
                        ) : null}
                        {m.coach_guide ? (
                          <p className="text-xs text-ink-secondary mt-1 line-clamp-2 whitespace-pre-wrap">
                            {m.coach_guide}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          className="p-2 text-ink-muted hover:text-ink-primary"
                          onClick={() => openEditMethod(m)}
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="p-2 text-ink-muted hover:text-status-expired"
                          onClick={() => setDeleteMethod(m)}
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
        open={!!deleteMethod}
        onClose={() => setDeleteMethod(null)}
        onConfirm={() => void confirmDeleteMethod()}
        title={`¿Eliminar «${deleteMethod?.name}»?`}
        description="Las rutinas que lo usen quedarán sin método vinculado."
        confirmLabel="Eliminar"
      />
    </div>
  )
}
