import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Trash2,
  Pencil,
  Plus,
  Check,
  Copy,
  Search,
  BookOpen,
  FileText,
  X,
  CalendarDays,
  Target,
  Layers,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { DirectoryPageShell } from '@/components/directory/DirectoryPageShell'
import { DirectoryStatGrid } from '@/components/directory/DirectoryStatGrid'
import { DirectoryTableShell } from '@/components/directory/DirectoryTableShell'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { WeeklyPlanGridFields } from '@/components/nutrition/WeeklyPlanGridFields'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import {
  createEmptyWeeklyGrid,
  normalizeWeeklyGrid,
  reshapeGrid,
  type WeeklyPlanGridJson,
} from '@/lib/nutrition/weeklyPlanGrid'
import { cn } from '@/lib/utils'
import type { NutritionPlanLibrary } from '@/types/database'
import toast from 'react-hot-toast'

function relativeUpdated(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: es })
  } catch {
    return '—'
  }
}

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
  const editorRef = useRef<HTMLDivElement>(null)

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
    [user, editingId, draftObjective, draftNotes],
  )

  const scrollToEditor = useCallback(() => {
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

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
    scrollToEditor()
  }

  function openEditor(t: NutritionPlanLibrary) {
    setEditingId(t.id)
    setDraftName(t.name)
    setDraftObjective(t.objective ?? '')
    setDraftNotes(t.notes ?? '')
    const mw = t.merge_weekends
    setMergeWeekends(mw)
    setGrid(normalizeWeeklyGrid(t.grid, mw))
    scrollToEditor()
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

  const stats = useMemo(() => {
    const withObjective = plans.filter((p) => (p.objective ?? '').trim().length > 0).length
    const mergedWeekends = plans.filter((p) => p.merge_weekends).length
    return { total: plans.length, withObjective, mergedWeekends }
  }, [plans])

  const editingPlan = useMemo(
    () => (editingId ? plans.find((p) => p.id === editingId) : null),
    [editingId, plans],
  )

  return (
    <div>
      <Header title="Planes de alimentación" />

      <DirectoryPageShell className="space-y-5">
        {/* Hero crear */}
        <section
          className={cn(
            'relative overflow-hidden rounded-xl border border-brand-secondary/20',
            'bg-gradient-to-br from-brand-secondary/[0.1] via-brand-secondary/[0.04] to-transparent',
            'px-4 py-3 sm:px-5 sm:py-3.5',
          )}
        >
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-brand-secondary/8 blur-2xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-0.5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-brand-secondary/90">
                Biblioteca reusable
              </p>
              <h2 className="text-sm font-semibold text-ink-primary">
                Nuevo plan base
              </h2>
              <p className="max-w-md text-xs text-ink-muted leading-snug">
                Modelá la grilla una vez e importala en pacientes.
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void createPlan()}
                placeholder="Nombre (opcional)"
                className={cn(
                  'h-9 w-full min-w-0 rounded-lg border border-surface-border/80 bg-surface-card/80 px-3 text-sm text-ink-primary',
                  'placeholder:text-ink-muted outline-none transition-shadow',
                  'focus:border-brand-secondary/50 focus:ring-2 focus:ring-brand-secondary/15 sm:min-w-[12rem]',
                )}
              />
              <Button
                type="button"
                size="sm"
                variant="gradientSecondary"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => void createPlan()}
                className="shrink-0"
              >
                Crear plan
              </Button>
            </div>
          </div>
        </section>

        <DirectoryStatGrid
          items={[
            { label: 'Planes guardados', value: stats.total, lucideIcon: BookOpen, tone: 'neutral' },
            { label: 'Con objetivo', value: stats.withObjective, lucideIcon: Target, tone: 'info' },
            {
              label: 'Sáb–dom unidos',
              value: stats.mergedWeekends,
              lucideIcon: CalendarDays,
              tone: 'neutral',
            },
          ]}
        />

        <DirectoryTableShell
          title="Biblioteca de planes"
          subtitle={
            search
              ? `${filteredPlans.length} coincidencias de ${plans.length}`
              : 'Clic en una fila para editar la grilla'
          }
          count={filteredPlans.length}
        >
          <div className="flex flex-col gap-2 border-b border-surface-border/70 bg-surface-elevated/20 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
            <div className="min-w-0 flex-1">
              <Input
                placeholder="Buscar por nombre u objetivo…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
              />
            </div>
          </div>

          {loading ? (
            <div className="px-4 py-6 sm:px-5">
              <TableSkeleton rows={4} cols={4} />
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="px-4 py-10 sm:px-5">
              {plans.length === 0 ? (
                <EmptyState
                  icon={<BookOpen className="h-8 w-8" />}
                  title="Sin planes guardados"
                  description="Creá tu primer plan con el botón de arriba."
                />
              ) : (
                <EmptyState
                  icon={<Search className="h-8 w-8" />}
                  title={`Sin resultados para «${search}»`}
                  description="Probá otro término o limpiá el buscador."
                />
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-surface-border/80 bg-surface-elevated/40">
                    <th className="w-[1%] px-3 py-3 sm:px-4" aria-hidden />
                    <th className="whitespace-nowrap px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-4">
                      Plan
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-4">
                      Objetivo
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-4">
                      Grilla
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-4">
                      Actualizado
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-4">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlans.map((t) => {
                    const active = editingId === t.id
                    return (
                      <tr
                        key={t.id}
                        className={cn(
                          'group cursor-pointer transition-[background-color,box-shadow] duration-150',
                          active
                            ? 'bg-brand-secondary/[0.09] shadow-[inset_3px_0_0_0_rgb(var(--brand-secondary))]'
                            : 'hover:bg-surface-elevated/35',
                          'border-b border-surface-border/60 last:border-b-0',
                        )}
                        onClick={() => openEditor(t)}
                      >
                        <td className="px-2 py-3 sm:px-3">
                          <span
                            className={cn(
                              'block h-8 w-1 rounded-full transition-colors',
                              active ? 'bg-brand-secondary' : 'bg-transparent group-hover:bg-brand-secondary/35',
                            )}
                            aria-hidden
                          />
                        </td>
                        <td className="px-3 py-3 sm:px-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className={cn(
                                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors',
                                active
                                  ? 'border-brand-secondary/35 bg-brand-secondary/15 text-brand-secondary'
                                  : 'border-surface-border/70 bg-surface-elevated/50 text-ink-muted group-hover:text-brand-secondary',
                              )}
                            >
                              <FileText className="h-4 w-4" aria-hidden />
                            </span>
                            <div className="min-w-0">
                              <p
                                className={cn(
                                  'truncate text-sm font-semibold',
                                  active ? 'text-brand-secondary' : 'text-ink-primary',
                                )}
                              >
                                {t.name}
                              </p>
                              {active ? (
                                <p className="text-[10px] font-medium text-brand-secondary/80 mt-0.5">
                                  Editando ahora
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[14rem] px-3 py-3 sm:max-w-xs sm:px-4">
                          {t.objective ? (
                            <p className="line-clamp-2 text-sm leading-snug text-ink-secondary">{t.objective}</p>
                          ) : (
                            <span className="text-sm text-ink-muted">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 sm:px-4">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-medium',
                              t.merge_weekends
                                ? 'border-brand-tertiary/30 bg-brand-tertiary/10 text-brand-tertiary'
                                : 'border-surface-border/80 bg-surface-elevated/40 text-ink-muted',
                            )}
                          >
                            <Layers className="h-3 w-3 shrink-0" aria-hidden />
                            {t.merge_weekends ? 'Lun–vie + finde' : '7 días'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                          <p className="text-sm tabular-nums text-ink-secondary">
                            {new Date(t.updated_at).toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                          <p className="text-[10px] text-ink-muted mt-0.5">{relativeUpdated(t.updated_at)}</p>
                        </td>
                        <td className="px-2 py-2.5 sm:px-3" onClick={(e) => e.stopPropagation()}>
                          <div
                            className={cn(
                              'flex items-center justify-end gap-0.5 rounded-xl border border-surface-border/60',
                              'bg-surface-card/60 p-0.5 transition-opacity',
                              'opacity-70 group-hover:opacity-100',
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => openEditor(t)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-brand-secondary/12 hover:text-brand-secondary"
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void clonePlan(t)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-brand-tertiary/12 hover:text-brand-tertiary"
                              title="Clonar"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void deletePlan(t.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-status-expired/12 hover:text-status-expired"
                              title="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DirectoryTableShell>

        {editingId && editingPlan ? (
          <section
            ref={editorRef}
            className={cn(
              'overflow-hidden rounded-2xl border border-brand-secondary/30',
              'bg-surface-card shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.35)]',
            )}
          >
            <div className="border-b border-surface-border/70 bg-gradient-to-r from-brand-secondary/[0.12] via-transparent to-brand-tertiary/[0.06] px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-secondary">
                      Editor de plan
                    </span>
                    <span className="rounded-md border border-brand-secondary/25 bg-brand-secondary/10 px-2 py-0.5 text-[10px] font-medium text-brand-secondary">
                      Autoguardado en grilla
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className={cn(
                        'min-w-0 flex-1 rounded-xl border border-surface-border/80 bg-surface-card px-3 py-2',
                        'text-base font-semibold text-ink-primary outline-none sm:min-w-[14rem] sm:text-lg',
                        'focus:border-brand-secondary/50 focus:ring-2 focus:ring-brand-secondary/20',
                      )}
                      aria-label="Nombre del plan"
                    />
                    <button
                      type="button"
                      onClick={() => void renameNow()}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-surface-border/80 text-ink-secondary transition-colors hover:border-brand-secondary/40 hover:text-brand-secondary"
                      title="Guardar nombre y metadatos"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-surface-border/80 text-ink-muted transition-colors hover:bg-surface-elevated hover:text-ink-primary"
                  aria-label="Cerrar editor"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-ink-secondary">
                  Objetivo del plan
                  <input
                    value={draftObjective}
                    onChange={(e) => {
                      setDraftObjective(e.target.value)
                      persistDraft({ name: draftName, mergeWeekends, grid })
                    }}
                    placeholder="Ej: Recomp. corporal, mantenimiento…"
                    className="mt-1.5 w-full rounded-xl border border-surface-inputBorder bg-surface-input px-3 py-2 text-sm outline-none focus:border-brand-secondary/50 focus:ring-2 focus:ring-brand-secondary/15"
                  />
                </label>
                <label className="block text-xs font-medium text-ink-secondary sm:col-span-2">
                  Notas generales
                  <textarea
                    value={draftNotes}
                    onChange={(e) => {
                      setDraftNotes(e.target.value)
                      persistDraft({ name: draftName, mergeWeekends, grid })
                    }}
                    rows={2}
                    className="mt-1.5 w-full rounded-xl border border-surface-inputBorder bg-surface-input px-3 py-2 text-sm outline-none focus:border-brand-secondary/50 focus:ring-2 focus:ring-brand-secondary/15"
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

              <p className="text-xs text-ink-muted leading-relaxed rounded-xl border border-surface-border/60 bg-surface-elevated/30 px-3 py-2.5">
                Los cambios de la grilla se guardan solos al dejar de editar. Después importá este plan en la ficha
                del paciente para generar su versión clínica.
              </p>
            </div>
          </section>
        ) : null}
      </DirectoryPageShell>
    </div>
  )
}
