import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
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
  Layers,
  X,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { DirectoryPageShell } from '@/components/directory/DirectoryPageShell'
import { DirectoryTableShell } from '@/components/directory/DirectoryTableShell'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { PlanGeneralNotesFields } from '@/components/nutrition/PlanGeneralNotesFields'
import { WeeklyPlanGridFields } from '@/components/nutrition/WeeklyPlanGridFields'
import { NutritionPlansTabs } from '@/components/nutrition/NutritionPlansTabs'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import {
  createEmptyWeeklyGrid,
  normalizeWeeklyGrid,
  reshapeGrid,
  type WeeklyPlanGridJson,
} from '@/lib/nutrition/weeklyPlanGrid'
import { tableRowEnterStyle } from '@/lib/tableRowEnterAnimation'
import { modalPanelMotionVariants } from '@/lib/modalPanelMotion'
import {
  nutritionKickerClass,
  nutritionListRowActiveClass,
  nutritionListRowClass,
  nutritionListRowHoverClass,
  nutritionSectionTitleClass,
  nutritionShellClass,
} from '@/lib/nutrition/nutritionAreaUi'
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

/**
 * Misma grilla en cabecera y filas (anchos fijos → columnas alineadas).
 * Plan | Objetivo (flex) | Formato | Actualización (corta) | Acciones
 */
const PLAN_LIBRARY_ROW_GRID =
  'sm:grid sm:[grid-template-columns:minmax(9.5rem,1.05fr)_minmax(0,1fr)_7.25rem_5.25rem_5.5rem] sm:items-center sm:gap-x-4'

const planEditorPanelBg: CSSProperties = {
  backgroundColor: 'rgb(var(--surface-card) / 1)',
}

export function NutritionTemplatesPage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<NutritionPlanLibrary[]>([])
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftObjective, setDraftObjective] = useState('')
  const [draftNotes, setDraftNotes] = useState('')
  const [mergeWeekends, setMergeWeekends] = useState(true)
  const [grid, setGrid] = useState<WeeklyPlanGridJson>(() => createEmptyWeeklyGrid(true))
  const saveTimer = useRef<number | null>(null)
  const reduceMotion = useReducedMotion()

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

  async function createPlan() {
    if (!user) return
    const nameOrDefault = `Plan ${plans.length + 1}`
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

  useEffect(() => {
    if (!editingId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [editingId])

  useEffect(() => {
    if (!editingId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEditor()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [editingId])

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

  const editingPlan = useMemo(
    () => (editingId ? plans.find((p) => p.id === editingId) : null),
    [editingId, plans],
  )

  return (
    <div>
      <Header title="Planes de alimentación" />

      <DirectoryPageShell className={nutritionShellClass}>
        <NutritionPlansTabs />

        <DirectoryTableShell
          title="Biblioteca de planes"
          subtitle={
            search
              ? `${filteredPlans.length} coincidencias de ${plans.length}`
              : 'Clic en una fila para editar la grilla'
          }
          count={filteredPlans.length}
        >
          <div className="flex flex-col gap-2 border-b border-surface-border/70 bg-surface-elevated/20 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <Input
                placeholder="Buscar por nombre u objetivo…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="gradientSecondary"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => void createPlan()}
              className="w-full shrink-0 sm:w-auto"
            >
              Crear plan
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2 px-4 py-4 sm:px-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-11 animate-pulse rounded-2xl border border-surface-border/60 bg-surface-elevated/40"
                />
              ))}
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="px-4 py-10 sm:px-5">
              {plans.length === 0 ? (
                <EmptyState
                  icon={<BookOpen className="h-8 w-8" />}
                  title="Sin planes guardados"
                  description="Creá tu primer plan con el botón Crear plan."
                  action={{
                    label: 'Crear plan',
                    onClick: () => void createPlan(),
                    icon: <Plus className="h-3.5 w-3.5" />,
                  }}
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
            <div className="px-3 pb-3 pt-1.5 sm:px-4 sm:pb-4">
              <div
                className={cn(
                  'mb-1.5 hidden py-1 sm:grid',
                  nutritionSectionTitleClass,
                  PLAN_LIBRARY_ROW_GRID,
                )}
                aria-hidden
              >
                <span className="text-left">Plan</span>
                <span className="min-w-0 text-left">Objetivo</span>
                <span className="text-left">Formato</span>
                <span className="text-left">Actualiz.</span>
                <span className="text-right">Acciones</span>
              </div>

              <div className="flex flex-col gap-1.5">
                {filteredPlans.map((t, rowIndex) => {
                  const active = editingId === t.id
                  const updatedShort = (() => {
                    try {
                      return format(parseISO(t.updated_at), 'dd/MM/yy', { locale: es })
                    } catch {
                      return '—'
                    }
                  })()
                  const updatedTitle = `${new Date(t.updated_at).toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })} · ${relativeUpdated(t.updated_at)}`
                  return (
                    <div
                      key={t.id}
                      role="button"
                      tabIndex={0}
                      style={tableRowEnterStyle(rowIndex)}
                      onClick={() => openEditor(t)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') openEditor(t)
                      }}
                      className={cn(
                        'group grid cursor-pointer grid-cols-1 gap-2 px-3 py-2.5',
                        nutritionListRowClass,
                        PLAN_LIBRARY_ROW_GRID,
                        active ? nutritionListRowActiveClass : nutritionListRowHoverClass,
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors',
                            active
                              ? 'border-brand-secondary/35 bg-brand-secondary/15 text-brand-secondary'
                              : 'border-surface-border/70 bg-surface-elevated/50 text-ink-muted group-hover:text-brand-secondary',
                          )}
                        >
                          <FileText className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted sm:hidden">
                            Plan
                          </p>
                          <p
                            className={cn(
                              'truncate text-[13px] font-semibold leading-tight',
                              active ? 'text-brand-secondary' : 'text-ink-primary group-hover:text-brand-secondary',
                            )}
                          >
                            {t.name}
                          </p>
                          {active ? (
                            <p className="truncate text-[10px] text-brand-secondary/80 sm:hidden">Editando ahora</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted sm:hidden">
                          Objetivo
                        </p>
                        <p
                          className={cn(
                            'truncate text-[12px] leading-snug',
                            t.objective ? 'text-ink-secondary' : 'text-ink-muted',
                          )}
                          title={t.objective ?? undefined}
                        >
                          {t.objective || 'Sin objetivo definido'}
                        </p>
                      </div>

                      <div>
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted sm:hidden">
                          Formato
                        </p>
                        <span
                          className={cn(
                            'inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap',
                            t.merge_weekends
                              ? 'border-brand-tertiary/30 bg-brand-tertiary/10 text-brand-tertiary'
                              : 'border-surface-border/80 bg-surface-elevated/40 text-ink-muted',
                          )}
                        >
                          <Layers className="h-2.5 w-2.5 shrink-0" aria-hidden />
                          {t.merge_weekends ? 'Lun–vie + finde' : '7 días'}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted sm:hidden">
                          Actualización
                        </p>
                        <p
                          className="truncate text-[11px] tabular-nums text-ink-muted"
                          title={active ? 'Editando ahora' : updatedTitle}
                        >
                          {active ? (
                            <span className="text-brand-secondary/80">Ahora</span>
                          ) : (
                            <>
                              <span className="sm:hidden">{relativeUpdated(t.updated_at)}</span>
                              <span className="hidden sm:inline">{updatedShort}</span>
                            </>
                          )}
                        </p>
                      </div>

                      <div
                        className="flex items-center justify-end gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="mr-auto text-[10px] font-semibold uppercase tracking-wide text-ink-muted sm:hidden">
                          Acciones
                        </span>
                        <button
                          type="button"
                          onClick={() => openEditor(t)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-brand-secondary/12 hover:text-brand-secondary"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void clonePlan(t)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-brand-tertiary/12 hover:text-brand-tertiary"
                          title="Clonar"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deletePlan(t.id)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-status-expired/12 hover:text-status-expired"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </DirectoryTableShell>

      </DirectoryPageShell>

      {createPortal(
        <AnimatePresence>
          {editingId && editingPlan ? (
            <>
              <motion.div
                key="plan-editor-backdrop"
                className="fixed inset-0 z-[10050] bg-black/30 backdrop-blur-[3px] dark:bg-black/55"
                aria-hidden
                onClick={closeEditor}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0.15 : 0.28 }}
              />
              <motion.div
                key="plan-editor-panel"
                role="dialog"
                aria-modal
                aria-labelledby="plan-library-editor-title"
                className={cn(
                  'fixed z-[10051] flex flex-col overflow-hidden rounded-2xl',
                  'border border-surface-border/85 shadow-lg',
                  'inset-2 max-sm:inset-2',
                  'sm:inset-3 sm:left-auto sm:right-4 sm:top-4 sm:bottom-4 sm:w-full sm:max-w-4xl',
                  'lg:right-6 lg:top-6 lg:bottom-6 lg:max-w-5xl',
                )}
                style={planEditorPanelBg}
                variants={modalPanelMotionVariants(reduceMotion)}
                initial="hidden"
                animate="visible"
                exit="leave"
              >
                <div
                  className="shrink-0 border-b border-surface-border/70 bg-gradient-to-r from-brand-secondary/[0.12] via-transparent to-brand-tertiary/[0.06] px-4 py-4 sm:px-6"
                  style={planEditorPanelBg}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={nutritionKickerClass}>Editor de plan</span>
                        <span className="rounded-md border border-brand-secondary/25 bg-brand-secondary/10 px-2 py-0.5 text-[10px] font-medium text-brand-secondary">
                          Autoguardado en grilla
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          id="plan-library-editor-title"
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

                <div
                  className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5"
                  style={planEditorPanelBg}
                >
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
                    <div className="sm:col-span-2">
                      <p className="text-xs font-medium text-ink-secondary">Notas generales</p>
                      <PlanGeneralNotesFields
                        className="mt-1.5"
                        value={draftNotes}
                        onChange={(next) => {
                          setDraftNotes(next)
                          persistDraft({ name: draftName, mergeWeekends, grid })
                        }}
                      />
                    </div>
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

                  <p className="text-xs leading-relaxed text-ink-muted rounded-xl border border-surface-border/60 bg-surface-elevated/30 px-3 py-2.5">
                    Los cambios de la grilla se guardan solos al dejar de editar. Después importá este plan en la
                    ficha del paciente para generar su versión clínica.
                  </p>
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
