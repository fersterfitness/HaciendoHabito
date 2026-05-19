import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSlashSearchFocus } from '@/hooks/useSlashSearchFocus'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { ClipboardList, FileDown, Pencil, Plus, Search, Trash2, ChevronDown, Filter, X, ArrowDownUp, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Popover } from '@/components/ui/Popover'
import { PlanningWorkbookReadonlyView } from '@/components/nutrition/PlanningWorkbookReadonlyView'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { cn, formatDate } from '@/lib/utils'
import { tableRowEnterStyle } from '@/lib/tableRowEnterAnimation'
import { StudentAvatarThumb } from '@/lib/studentAvatar'
import { downloadTrainerStudentMealPlanPdf } from '@/lib/nutrition/downloadTrainerStudentMealPlanPdf'
import { createInitialPlanningWorkbook } from '@/lib/nutrition/planningWorkbookFactory'
import { parsePlanningData } from '@/lib/nutrition/planningWorkbookTypes'
import type { PlanningWorkbookStateV1 } from '@/lib/nutrition/planningWorkbookTypes'
import type { Json, TrainerStudentMealPlan } from '@/types/database'

type PlanRow = TrainerStudentMealPlan & {
  student?: {
    full_name: string
    avatar_path: string | null
    intake_ferster: { pathology?: string; pathology_detail?: string | null } | null
    intake_nutrition: { digestive_intolerances?: string } | null
  } | null
}

// Solo los 3 colores de marca
const PLAN_COLORS = [
  { bar: 'bg-brand-secondary', avatar: 'bg-brand-secondary/15 text-brand-secondary' },
  { bar: 'bg-brand-tertiary', avatar: 'bg-brand-tertiary/15 text-brand-tertiary' },
  { bar: 'bg-brand-primary', avatar: 'bg-brand-primary/15 text-brand-primary' },
]

function strColorIdx(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return Math.abs(h) % PLAN_COLORS.length
}

/** Extrae condiciones alimentarias del alumno (patología + intolerancia). */
function getStudentConditions(student: PlanRow['student']): string[] {
  const items: string[] = []
  const fi = student?.intake_ferster
  if (fi?.pathology === 'yes' && fi.pathology_detail?.trim()) {
    items.push(fi.pathology_detail.trim())
  }
  const ni = student?.intake_nutrition
  const intol = ni?.digestive_intolerances?.trim()
  if (intol && intol.toLowerCase() !== 'no' && intol.toLowerCase() !== 'ninguna') {
    items.push(intol)
  }
  return items
}

type MealPlanOriginFilter = '' | 'from_template' | 'direct'

type MealPlanTableSort =
  | 'recommended'
  | 'updated_asc'
  | 'student_asc'
  | 'student_desc'
  | 'title_asc'
  | 'title_desc'

const SORT_OPTS: { value: MealPlanTableSort; label: string }[] = [
  { value: 'recommended', label: 'Actualizado · más reciente' },
  { value: 'updated_asc', label: 'Actualizado · más antiguo' },
  { value: 'student_asc', label: 'Alumno · A→Z' },
  { value: 'student_desc', label: 'Alumno · Z→A' },
  { value: 'title_asc', label: 'Plan · A→Z' },
  { value: 'title_desc', label: 'Plan · Z→A' },
]

const SORT_SUBTITLE: Record<MealPlanTableSort, string> = {
  recommended: 'Actualización · más reciente primero',
  updated_asc: 'Actualización · más antiguo primero',
  student_asc: 'Alumno · A→Z',
  student_desc: 'Alumno · Z→A',
  title_asc: 'Título plan · A→Z',
  title_desc: 'Título plan · Z→A',
}

function sortPlans(list: PlanRow[], sort: MealPlanTableSort): PlanRow[] {
  const copy = [...list]
  const student = (p: PlanRow) => (p.student?.full_name ?? '').toLocaleLowerCase('es')
  const updated = (p: PlanRow) => new Date(p.updated_at).getTime()
  switch (sort) {
    case 'recommended':
      copy.sort((a, b) => updated(b) - updated(a) || a.title.localeCompare(b.title, 'es'))
      break
    case 'updated_asc':
      copy.sort((a, b) => updated(a) - updated(b) || a.title.localeCompare(b.title, 'es'))
      break
    case 'student_asc':
      copy.sort((a, b) => student(a).localeCompare(student(b), 'es') || a.title.localeCompare(b.title, 'es'))
      break
    case 'student_desc':
      copy.sort((a, b) => student(b).localeCompare(student(a), 'es') || a.title.localeCompare(b.title, 'es'))
      break
    case 'title_asc':
      copy.sort((a, b) => a.title.localeCompare(b.title, 'es') || student(a).localeCompare(student(b), 'es'))
      break
    case 'title_desc':
      copy.sort((a, b) => b.title.localeCompare(a.title, 'es') || student(a).localeCompare(student(b), 'es'))
      break
    default:
      break
  }
  return copy
}

function MealPlansFiltersDropdown({
  filterOrigin,
  setFilterOrigin,
}: {
  filterOrigin: MealPlanOriginFilter
  setFilterOrigin: (v: MealPlanOriginFilter) => void
}) {
  const [open, setOpen] = useState(false)
  const activeCount = filterOrigin ? 1 : 0

  return (
    <div className="relative inline-flex shrink-0">
      <Popover
        open={open}
        onOpenChange={setOpen}
        className="w-56 p-3"
        trigger={({ ref, onClick, ...a11y }) => (
          <button
            ref={ref}
            type="button"
            onClick={onClick}
            className={cn(
              'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-3.5 text-sm font-medium text-zinc-800 transition-colors',
              activeCount > 0
                ? 'border-zinc-300/90 bg-zinc-100/80 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-100'
                : 'border-zinc-200/70 bg-transparent hover:border-zinc-300 hover:bg-zinc-50/80 dark:border-zinc-700/80 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/40',
            )}
            {...a11y}
          >
            <Filter className="h-4 w-4 text-zinc-500 dark:text-zinc-400" aria-hidden />
            Filtrar
            {activeCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded bg-zinc-900 px-1.5 text-[10px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                {activeCount}
              </span>
            )}
            <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
          </button>
        )}
      >
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">Origen</p>
          {(
            [
              { value: '' as MealPlanOriginFilter, label: 'Todos' },
              { value: 'from_template' as MealPlanOriginFilter, label: 'Desde plantilla' },
              { value: 'direct' as MealPlanOriginFilter, label: 'Asignación directa' },
            ] satisfies { value: MealPlanOriginFilter; label: string }[]
          ).map((opt) => (
            <button
              key={opt.value || 'all-origin'}
              type="button"
              onClick={() => setFilterOrigin(opt.value)}
              className={cn(
                'mt-1 w-full rounded-md px-2.5 py-1.5 text-left text-xs transition-colors first:mt-0',
                filterOrigin === opt.value
                  ? 'bg-slate-500/12 font-medium text-zinc-900 dark:bg-slate-400/14 dark:text-zinc-50'
                  : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60',
              )}
            >
              {opt.label}
            </button>
          ))}

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setFilterOrigin('')
                setOpen(false)
              }}
              className="mt-2 flex w-full items-center justify-center gap-1 border-t border-zinc-200/65 pt-2 text-xs text-zinc-500 transition-colors hover:text-rose-600 dark:border-zinc-800/80 dark:hover:text-rose-400"
            >
              <X className="h-3 w-3" />
              Limpiar filtros
            </button>
          )}
      </Popover>
    </div>
  )
}

function MealPlansSortDropdown({ value, onChange }: { value: MealPlanTableSort; onChange: (v: MealPlanTableSort) => void }) {
  const [open, setOpen] = useState(false)

  const selectedLabel = SORT_OPTS.find((o) => o.value === value)?.label ?? SORT_OPTS[0].label

  return (
    <div className="relative inline-flex shrink-0">
      <Popover
        open={open}
        onOpenChange={setOpen}
        className="min-w-[16rem] max-w-[min(calc(100vw-2rem),20rem)] p-2"
        trigger={({ ref, onClick, ...a11y }) => (
          <button
            ref={ref}
            type="button"
            aria-label={`Ordenar. ${selectedLabel}`}
            title={selectedLabel}
            onClick={onClick}
            className={cn(
              'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-zinc-200/70 px-3.5 text-sm font-medium text-zinc-800 transition-colors',
              'bg-transparent hover:border-zinc-300 hover:bg-zinc-50/80 dark:border-zinc-700/80 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/40',
            )}
            {...a11y}
          >
            <ArrowDownUp className="h-4 w-4 text-zinc-500 dark:text-zinc-400" aria-hidden />
            Ordenar
            <ChevronDown className={cn('h-3 w-3 shrink-0 opacity-70 transition-transform', open && 'rotate-180')} />
          </button>
        )}
      >
          <p className="px-2 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Orden del listado</p>
          {SORT_OPTS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={cn(
                'w-full rounded-md px-2.5 py-2 text-left text-xs transition-colors',
                opt.value === value
                  ? 'bg-zinc-200/85 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
                  : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60',
              )}
            >
              {opt.label}
            </button>
          ))}
      </Popover>
    </div>
  )
}

function planWorkbookFromRow(row: PlanRow | null): PlanningWorkbookStateV1 | null {
  if (!row) return null
  const parsed = parsePlanningData(row.data as Json)
  return parsed ?? createInitialPlanningWorkbook()
}

export function MealPlansPage() {
  const navigate = useAppNavigate()
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterOrigin, setFilterOrigin] = useState<MealPlanOriginFilter>('')
  const [tableSort, setTableSort] = useState<MealPlanTableSort>('recommended')
  const searchRef = useRef<HTMLInputElement>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null)
  const [pdfBusyDetail, setPdfBusyDetail] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PlanRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  const entityColumn = profile?.role === 'nutritionist' ? 'Paciente' : 'Alumno'

  const fetchPlans = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('trainer_student_meal_plans')
      .select('*, student:students(full_name, avatar_path, intake_ferster, intake_nutrition)')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })
    setLoading(false)
    if (error) {
      console.error(error)
      toast.error(error.message ?? 'No se pudieron cargar los planes.')
      return
    }
    setPlans((data ?? []) as PlanRow[])
  }, [user?.id])

  useEffect(() => {
    void fetchPlans()
  }, [fetchPlans])

  useSlashSearchFocus(searchRef)

  const selectedPlan = useMemo(() => plans.find((p) => p.id === selectedPlanId) ?? null, [plans, selectedPlanId])
  const detailWb = useMemo(() => planWorkbookFromRow(selectedPlan), [selectedPlan])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return plans.filter((p) => {
      const title = p.title.toLowerCase()
      const nm = (p.student?.full_name ?? '').toLowerCase()
      if (q && !title.includes(q) && !nm.includes(q)) return false
      if (filterOrigin === 'from_template' && !p.cloned_from_id) return false
      if (filterOrigin === 'direct' && p.cloned_from_id) return false
      return true
    })
  }, [plans, search, filterOrigin])

  const filteredSorted = useMemo(() => sortPlans(filtered, tableSort), [filtered, tableSort])

  useEffect(() => {
    if (!selectedPlanId) return
    if (!filteredSorted.some((p) => p.id === selectedPlanId)) setSelectedPlanId(null)
  }, [filteredSorted, selectedPlanId])

  async function handlePdf(p: PlanRow) {
    setPdfBusyId(p.id)
    try {
      await downloadTrainerStudentMealPlanPdf(p, {
        professionalName: profile?.full_name,
        studentName: p.student?.full_name ?? null,
      })
      toast.success('PDF descargado.')
    } catch (e) {
      console.error(e)
      toast.error('No se pudo generar el PDF.')
    } finally {
      setPdfBusyId(null)
    }
  }

  async function handlePdfDetail() {
    if (!selectedPlan) return
    setPdfBusyDetail(true)
    try {
      await downloadTrainerStudentMealPlanPdf(selectedPlan, {
        professionalName: profile?.full_name,
        studentName: selectedPlan.student?.full_name ?? null,
      })
      toast.success('PDF descargado.')
    } catch (e) {
      console.error(e)
      toast.error('No se pudo generar el PDF.')
    } finally {
      setPdfBusyDetail(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !user?.id) return
    setDeleting(true)
    const deletedId = deleteTarget.id
    const { error } = await supabase
      .from('trainer_student_meal_plans')
      .delete()
      .eq('id', deletedId)
      .eq('owner_id', user.id)
    setDeleting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Plan eliminado.')
    setDeleteTarget(null)
    if (selectedPlanId === deletedId) setSelectedPlanId(null)
    void fetchPlans()
  }

  function startRename(p: PlanRow, e: React.MouseEvent) {
    e.stopPropagation()
    setRenamingId(p.id)
    setRenameValue(p.title)
    setTimeout(() => renameInputRef.current?.select(), 30)
  }

  async function commitRename(id: string) {
    const trimmed = renameValue.trim()
    if (!trimmed || !user?.id) { setRenamingId(null); return }
    const { error } = await supabase
      .from('trainer_student_meal_plans')
      .update({ title: trimmed })
      .eq('id', id)
      .eq('owner_id', user.id)
    if (error) { toast.error(error.message); return }
    setPlans((prev) => prev.map((p) => p.id === id ? { ...p, title: trimmed } : p))
    setRenamingId(null)
    toast.success('Plan renombrado.')
  }

  function openFullPage(p: PlanRow) {
    navigate(`/students/${p.student_id}/meal-plan/${p.id}`)
  }

  return (
    <div>
      <Header title="Planes de alimentación" />

      <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-6 lg:px-6 lg:py-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
          <div className="relative min-h-10 min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2">
              <Search className="h-4 w-4 text-zinc-400 dark:text-zinc-500" aria-hidden />
            </span>
            <input
              ref={searchRef}
              type="search"
              placeholder={`Buscar por título del plan o ${entityColumn.toLowerCase()}… ( / para enfocar )`}
              autoComplete="off"
              spellCheck={false}
              aria-label="Buscar planes de alimentación"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                'h-10 w-full rounded-md border border-zinc-200/75 bg-transparent pl-10 pr-3 text-[14px] text-zinc-900 outline-none shadow-none',
                'placeholder:text-zinc-400',
                'focus-visible:border-zinc-300 focus-visible:ring-1 focus-visible:ring-zinc-300/50',
                'dark:border-zinc-700/80 dark:text-zinc-100 dark:placeholder:text-zinc-500',
                'dark:focus-visible:border-zinc-600 dark:focus-visible:ring-zinc-600/35',
              )}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end md:gap-2">
            <MealPlansFiltersDropdown filterOrigin={filterOrigin} setFilterOrigin={setFilterOrigin} />
            <MealPlansSortDropdown value={tableSort} onChange={setTableSort} />

            {filterOrigin && (
              <span className="inline-flex h-10 items-center gap-1.5 rounded-md border border-zinc-200/75 px-2.5 text-xs font-medium text-zinc-900 dark:border-zinc-700/80 dark:text-zinc-100">
                {filterOrigin === 'from_template' ? 'Desde plantilla' : 'Asignación directa'}
                <button
                  type="button"
                  className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                  aria-label="Quitar filtro origen"
                  onClick={() => setFilterOrigin('')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}

            <Button
              type="button"
              variant="gradientPrimary"
              title="Armar plan y asignar"
              onClick={() => navigate('/nutrition/planning')}
              icon={<Plus className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2.25} aria-hidden />}
            >
              Nuevo Plan
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" accent="trainerCta" />
          </div>
        ) : plans.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-8 w-8" />}
            title="No hay planes asignados"
            description="Asigná un plan desde Plan de alimentación o desde la ficha del alumno."
            action={{
              label: 'Nuevo Plan',
              onClick: () => navigate('/nutrition/planning'),
              icon: <Plus className="h-4 w-4" />,
            }}
          />
        ) : filteredSorted.length === 0 ? (
          <EmptyState
            icon={<Filter className="h-8 w-8" />}
            title="Sin resultados para los filtros"
            description="Probá con otra búsqueda o limpiá filtros desde el botón Filtrar."
          />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-surface-border/80 bg-surface-card shadow-card">
            <div className="flex flex-col gap-2 border-b border-surface-border/70 bg-surface-elevated/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-tight text-ink-primary">Listado</h2>
                <p className="truncate text-[11px] text-ink-muted">
                  {SORT_SUBTITLE[tableSort]}
                  {search.trim() ? ` · texto "${search.trim()}"` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <span className="inline-flex items-center rounded-full border border-surface-border/70 bg-surface-card px-2.5 py-1 text-[11px] font-semibold tabular-nums text-ink-secondary">
                  {filteredSorted.length === 1 ? '1 plan' : `${filteredSorted.length} planes`}
                </span>
                {filterOrigin && (
                  <button
                    type="button"
                    onClick={() => setFilterOrigin('')}
                    className="text-[11px] font-medium text-ink-muted underline-offset-4 hover:text-ink-primary hover:underline"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[min(72vh,40rem)] overflow-auto">
              <table className="w-full min-w-[860px] border-collapse text-[13px] leading-snug">
                <thead className="sticky top-0 z-[1] border-b border-surface-border/70 bg-surface-card/92 backdrop-blur-md">
                  <tr className="text-left">
                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-5">Plan</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-5">{entityColumn}</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-5">Actualización</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-5">Condición</th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-5">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/70 bg-surface-card">
                  {filteredSorted.map((p, rowIndex) => {
                    const isSelected = selectedPlanId === p.id
                    const ci = strColorIdx(p.student?.full_name ?? p.id)
                    const colors = PLAN_COLORS[ci]
                    const isRenaming = renamingId === p.id
                    return (
                      <tr
                        key={p.id}
                        style={tableRowEnterStyle(rowIndex)}
                        className={cn(
                          'cursor-pointer transition-colors',
                          isSelected ? 'bg-surface-elevated/45' : 'hover:bg-surface-elevated/35',
                        )}
                        onClick={() => !isRenaming && setSelectedPlanId(p.id)}
                      >
                        {/* Columna Plan con barra de color + renombrar inline */}
                        <td className={cn('hh-row-drop-in min-w-[10rem] px-0 py-0 sm:min-w-[12rem]')}>
                          <div className="flex items-center gap-0">
                            <div className={cn('w-1 self-stretch shrink-0 rounded-none', colors.bar)} />
                            <div className="flex-1 px-4 py-2.5 sm:px-5">
                              {isRenaming ? (
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    ref={renameInputRef}
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') void commitRename(p.id)
                                      if (e.key === 'Escape') setRenamingId(null)
                                    }}
                                    onBlur={() => void commitRename(p.id)}
                                    className="flex-1 min-w-0 rounded-lg border border-brand-secondary/40 bg-surface-input px-2.5 py-1 text-sm font-semibold text-ink-primary outline-none focus:ring-1 focus:ring-brand-secondary/50"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onMouseDown={(e) => { e.preventDefault(); void commitRename(p.id) }}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-secondary/15 text-brand-secondary hover:bg-brand-secondary/25 transition-colors shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 group/title">
                                  <span className="break-words font-semibold leading-snug tracking-tight text-ink-primary">{p.title}</span>
                                  <button
                                    type="button"
                                    title="Renombrar"
                                    onClick={(e) => startRename(p, e)}
                                    className="opacity-0 group-hover/title:opacity-100 shrink-0 rounded p-0.5 text-ink-muted hover:text-brand-secondary transition-all"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        {/* Columna Alumno con foto de perfil */}
                        <td
                          className={cn(
                            'hh-row-drop-in max-w-[13rem] truncate px-4 py-2.5 text-[13px] font-normal text-ink-secondary sm:max-w-[15rem] sm:px-5',
                          )}
                          title={p.student?.full_name ?? undefined}
                        >
                          <div className="flex items-center gap-2">
                            <StudentAvatarThumb
                              storagePath={p.student?.avatar_path}
                              name={p.student?.full_name ?? '?'}
                              fallbackClassName={cn('text-[10px] font-bold', colors.avatar)}
                            />
                            <span className="truncate">{p.student?.full_name ?? '—'}</span>
                          </div>
                        </td>
                        <td className={cn('hh-row-drop-in whitespace-nowrap px-4 py-2.5 text-xs text-ink-muted sm:px-5')}>
                          {formatDate(p.updated_at)}
                        </td>
                        <td className={cn('hh-row-drop-in max-w-[16rem] px-4 py-2.5 sm:px-5')}>
                          {(() => {
                            const conditions = getStudentConditions(p.student)
                            if (conditions.length === 0) {
                              return <span className="text-xs text-ink-muted">—</span>
                            }
                            return (
                              <div className="flex flex-wrap gap-1">
                                {conditions.map((c, i) => (
                                  <span
                                    key={i}
                                    title={c}
                                    className="inline-flex items-center rounded border border-status-expiring/30 bg-status-expiring/10 px-2 py-0.5 text-[10px] font-medium text-status-expiring max-w-[14rem] truncate"
                                  >
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )
                          })()}
                        </td>
                        <td className={cn('hh-row-drop-in px-4 py-2.5 sm:px-5')}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedPlanId(p.id)
                              }}
                              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-elevated hover:text-ink-primary"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Detalle
                            </button>
                            <button
                              disabled={pdfBusyId === p.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                void handlePdf(p)
                              }}
                              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-[#ff5508]/10 hover:text-[#ff5508] disabled:opacity-50 dark:hover:bg-[#ff5508]/14 dark:hover:text-[#ffa065]"
                            >
                              <FileDown className="h-3.5 w-3.5" />
                              {pdfBusyId === p.id ? 'PDF…' : 'PDF'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteTarget(p)
                              }}
                              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-status-expired/12 hover:text-status-expired"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {selectedPlan && detailWb && (
        <>
          <button
            type="button"
            aria-label="Cerrar detalle del plan"
            className={cn(
              'fixed inset-0 z-[9990] bg-black/30 backdrop-blur-[3px] dark:bg-black/55',
              'motion-reduce:animate-none motion-safe:animate-backdrop-soft',
            )}
            onClick={() => setSelectedPlanId(null)}
          />
          <div
            role="dialog"
            aria-modal
            aria-labelledby="meal-plan-detail-title"
            className={cn(
              'fixed z-[9991] flex flex-col overflow-hidden rounded-2xl border border-surface-border/85 bg-surface-card shadow-lg dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)]',
              'motion-reduce:animate-none motion-safe:max-sm:animate-panel-soft motion-safe:sm:animate-panel-slide-in',
              'inset-3 sm:inset-auto sm:left-auto sm:right-5 sm:top-5 sm:bottom-5 sm:h-[calc(100dvh-2.5rem)] sm:w-full sm:max-w-5xl lg:right-6 lg:top-6 lg:bottom-6 xl:max-w-6xl',
            )}
          >
            <div className="flex shrink-0 flex-col gap-3 border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-800">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{entityColumn}</p>
                  <p className="truncate text-sm text-ink-secondary">{selectedPlan.student?.full_name ?? '—'}</p>
                  <h2 id="meal-plan-detail-title" className="mt-1 break-words text-lg font-semibold tracking-tight text-ink-primary">
                    {selectedPlan.title}
                  </h2>
                  <p className="mt-1 text-[11px] text-ink-muted">Actualizado {formatDate(selectedPlan.updated_at)}</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-transparent p-2 text-ink-muted transition-colors hover:border-zinc-200 hover:bg-zinc-100 hover:text-ink-primary dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                  aria-label="Cerrar"
                  onClick={() => setSelectedPlanId(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<ClipboardList className="h-3.5 w-3.5" />}
                  onClick={() => openFullPage(selectedPlan)}
                >
                  Abrir página completa
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={pdfBusyDetail}
                  icon={<FileDown className="h-3.5 w-3.5" />}
                  onClick={() => void handlePdfDetail()}
                >
                  PDF
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={() => setDeleteTarget(selectedPlan)}
                >
                  Eliminar
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 lg:px-6">
              <PlanningWorkbookReadonlyView wb={detailWb} documentUpdatedAt={selectedPlan.updated_at} />
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="¿Eliminar plan asignado?"
        description={`Se borrará "${deleteTarget?.title}" para ${deleteTarget?.student?.full_name ?? 'el alumno'}. El alumno dejará de verlo en la app. Esta acción no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        loading={deleting}
      />
    </div>
  )
}
