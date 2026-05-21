import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Trash2, Pencil, Plus, Check, Copy, Search, BookOpen, FileText } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { WeeklyPlanGridFields } from '@/components/nutrition/WeeklyPlanGridFields'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import {
  createEmptyWeeklyGrid,
  normalizeWeeklyGrid,
  reshapeGrid,
  type WeeklyPlanGridJson,
} from '@/lib/nutrition/weeklyPlanGrid'
import type { NutritionPlanLibrary } from '@/types/database'
import toast from 'react-hot-toast'

export function NutritionTemplatesPage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<NutritionPlanLibrary[]>([])
  const [newName, setNewName] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftObjective, setDraftObjective] = useState('')
  const [draftNotes, setDraftNotes] = useState('')
  const [mergeWeekends, setMergeWeekends] = useState(true)
  const [grid, setGrid] = useState<WeeklyPlanGridJson>(() => createEmptyWeeklyGrid(true))
  const saveTimer = useRef<number | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('nutrition_plan_library')
      .select('*')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setPlans((data as NutritionPlanLibrary[]) ?? [])
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const persistDraft = useCallback(
    (next: { name: string; mergeWeekends: boolean; grid: WeeklyPlanGridJson }) => {
      if (!user || !editingId) return
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(async () => {
        const { error } = await supabase
          .from('nutrition_plan_library')
          .update({
            name: next.name.trim() || 'Sin nombre',
            objective: draftObjective.trim() || null,
            notes: draftNotes.trim() || null,
            merge_weekends: next.mergeWeekends,
            grid: next.grid as unknown as Record<string, unknown>,
          })
          .eq('id', editingId)
          .eq('owner_id', user.id)

        if (error) toast.error(error.message)
      }, 880)
    },
    [user, editingId, draftObjective, draftNotes]
  )

  async function createPlan() {
    if (!user) return
    const nameOrDefault = newName.trim() || `Plan ${plans.length + 1}`
    const baseline = createEmptyWeeklyGrid(true)
    const { data, error } = await supabase
      .from('nutrition_plan_library')
      .insert({
        owner_id: user.id,
        name: nameOrDefault,
        objective: null,
        notes: null,
        tags: [],
        merge_weekends: true,
        grid: baseline as unknown as Record<string, unknown>,
      })
      .select('*')
      .single()

    if (error) {
      toast.error(error.message)
      return
    }
    const row = data as NutritionPlanLibrary
    setPlans((prev) => [row, ...prev])
    setEditingId(row.id)
    setDraftName(row.name)
    setDraftObjective(row.objective ?? '')
    setDraftNotes(row.notes ?? '')
    setMergeWeekends(row.merge_weekends)
    setGrid(normalizeWeeklyGrid(row.grid, row.merge_weekends))
    setNewName('')
    toast.success('Plan creado')
  }

  function openEditor(t: NutritionPlanLibrary) {
    setEditingId(t.id)
    setDraftName(t.name)
    setDraftObjective(t.objective ?? '')
    setDraftNotes(t.notes ?? '')
    const mw = t.merge_weekends
    setMergeWeekends(mw)
    setGrid(normalizeWeeklyGrid(t.grid, mw))
  }

  function closeEditor() {
    setEditingId(null)
  }

  async function deletePlan(id: string) {
    if (!user) return
    if (!confirm('¿Eliminar este plan de la biblioteca?')) return
    const { error } = await supabase.from('nutrition_plan_library').delete().eq('id', id).eq('owner_id', user.id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Plan eliminado')
    setPlans((prev) => prev.filter((t) => t.id !== id))
    if (editingId === id) closeEditor()
  }

  async function clonePlan(row: NutritionPlanLibrary) {
    if (!user) return
    const { data, error } = await supabase
      .from('nutrition_plan_library')
      .insert({
        owner_id: user.id,
        name: `${row.name} (copia)`,
        objective: row.objective,
        notes: row.notes,
        tags: row.tags ?? [],
        merge_weekends: row.merge_weekends,
        grid: row.grid,
      })
      .select('*')
      .single()

    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Plan clonado')
    const cloned = data as NutritionPlanLibrary
    setPlans((prev) => [cloned, ...prev])
    openEditor(cloned)
  }

  async function renameNow() {
    if (!user || !editingId) return
    const { error } = await supabase
      .from('nutrition_plan_library')
      .update({
        name: draftName.trim() || 'Sin nombre',
        objective: draftObjective.trim() || null,
        notes: draftNotes.trim() || null,
      })
      .eq('id', editingId)
      .eq('owner_id', user.id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Plan actualizado')
    load()
  }

  const toggleMergeWeekendsTemplate = (checked: boolean) => {
    if (!editingId) return
    if (checked === mergeWeekends) return
    const nextGrid = reshapeGrid(normalizeWeeklyGrid(grid, mergeWeekends), mergeWeekends, checked)
    setMergeWeekends(checked)
    setGrid(nextGrid)
    persistDraft({ name: draftName, mergeWeekends: checked, grid: nextGrid })
  }

  const filteredPlans = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return plans
    return plans.filter((p) => p.name.toLowerCase().includes(q) || (p.objective ?? '').toLowerCase().includes(q))
  }, [plans, search])

  return (
    <div>
      <Header title="Planes de alimentación" />
      <div className="px-4 lg:px-6 py-6 space-y-6 max-w-6xl mx-auto">
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-xl bg-brand-primary/15 text-brand-primary dark:text-brand-primary">
                <BookOpen className="h-5 w-5" />
              </span>
              <div>
                <CardTitle className="mb-1">Nuevo plan base</CardTitle>
                <p className="text-sm text-ink-muted">
                  Biblioteca reusable: creá un plan modelo y luego importalo en cualquier paciente.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center shrink-0">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre opcional…"
                className="rounded-xl bg-surface-input border border-surface-inputBorder px-3 py-2 text-sm min-w-[14rem] focus:outline-none focus:border-brand-primary"
              />
              <Button
                type="button"
                variant="gradientSecondary"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => createPlan()}
              >
                Crear plan
              </Button>
            </div>
          </div>
        </Card>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-ink-primary">Biblioteca de planes</h2>
              <p className="text-xs text-ink-muted">
                {plans.length} {plans.length === 1 ? 'plan guardado' : 'planes guardados'}
                {search ? ` · ${filteredPlans.length} coinciden` : ''}
              </p>
            </div>
            <div className="min-w-[16rem]">
              <Input
                placeholder="Buscar plan u objetivo…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" accent="trainerCta" />
            </div>
          ) : filteredPlans.length === 0 ? (
            plans.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="h-8 w-8" />}
                title="Sin planes guardados"
                description="Creá tu primer plan base desde el formulario de arriba."
              />
            ) : (
              <EmptyState
                icon={<Search className="h-8 w-8" />}
                title={`Sin resultados para "${search}"`}
                description="Probá con otro nombre o limpiá el buscador."
              />
            )
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredPlans.map((t) => (
                <div
                  key={t.id}
                  className="group flex flex-col rounded-2xl border border-surface-border/80 bg-surface-card p-4 hover:border-brand-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-md bg-brand-primary/10 text-brand-primary dark:text-brand-primary border border-brand-primary/15">
                      <FileText className="h-3 w-3" />
                      Plan
                    </span>
                    <button
                      type="button"
                      onClick={() => deletePlan(t.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-ink-muted hover:text-status-expired hover:bg-status-expired/10"
                      title="Eliminar plan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-sm font-semibold text-ink-primary mb-1 leading-tight">{t.name}</p>
                  {t.objective ? (
                    <p className="text-xs text-ink-secondary mb-1.5 leading-snug line-clamp-2">{t.objective}</p>
                  ) : (
                    <p className="text-xs text-ink-muted italic mb-1.5">Sin objetivo definido</p>
                  )}
                  <p className="text-[11px] text-ink-muted mt-auto pt-3 border-t border-surface-border/60">
                    Actualizado {new Date(t.updated_at).toLocaleDateString('es-AR')}
                  </p>

                  <div className="mt-3 flex gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      icon={<Pencil className="w-3.5 h-3.5" />}
                      onClick={() => openEditor(t)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      icon={<Copy className="w-3.5 h-3.5" />}
                      onClick={() => clonePlan(t)}
                    >
                      Clonar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {editingId && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap gap-3 items-center">
                <CardTitle>Editar plan base</CardTitle>
                <label className="text-xs text-ink-secondary flex gap-2 items-center">
                  Nombre
                  <input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="rounded-xl bg-surface-input border border-surface-inputBorder px-2 py-1 text-sm min-w-[12rem]"
                  />
                  <button
                    type="button"
                    onClick={() => renameNow()}
                    className="p-2 rounded-lg border border-surface-border hover:border-brand-primary/50 text-ink-secondary"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </label>
              </div>
              <button type="button" onClick={closeEditor} className="text-sm text-brand-primary hover:underline">
                Cerrar
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-3 mb-4">
              <label className="text-xs text-ink-secondary">
                Objetivo del plan
                <input
                  value={draftObjective}
                  onChange={(e) => {
                    const v = e.target.value
                    setDraftObjective(v)
                    persistDraft({ name: draftName, mergeWeekends, grid })
                  }}
                  placeholder="Ej: Recomp. corporal, mantenimiento..."
                  className="mt-1 rounded-xl bg-surface-input border border-surface-inputBorder px-2.5 py-2 text-sm w-full"
                />
              </label>
              <label className="text-xs text-ink-secondary md:col-span-2">
                Notas generales
                <textarea
                  value={draftNotes}
                  onChange={(e) => {
                    const v = e.target.value
                    setDraftNotes(v)
                    persistDraft({ name: draftName, mergeWeekends, grid })
                  }}
                  rows={2}
                  className="mt-1 rounded-xl bg-surface-input border border-surface-inputBorder px-2.5 py-2 text-sm w-full"
                />
              </label>
            </div>
            <WeeklyPlanGridFields
              mergeWeekends={mergeWeekends}
              grid={grid}
              onMergeWeekendsChange={toggleMergeWeekendsTemplate}
              onGridChange={(next) => {
                const normalized = normalizeWeeklyGrid(next, mergeWeekends)
                setGrid(normalized)
                persistDraft({ name: draftName, mergeWeekends, grid: normalized })
              }}
            />
            <p className="text-xs text-ink-muted mt-4">
              Los cambios de grilla se guardan al pausar la edición. Este plan luego se importa al paciente y genera una versión clínica.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
