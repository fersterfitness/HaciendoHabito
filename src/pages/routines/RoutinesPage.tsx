import { controlMdClassName } from '@/lib/formControlClasses'
import { appFocusRingClassName } from '@/lib/appFocusRingClasses'
import { rowLinkClick } from '@/lib/rowLink'
import { IS_V2 } from '@/lib/uiVersion'
import { SegmentedV2 } from '@/components/v2/ui'
import { useEffect, useState, useMemo, useRef, useCallback, lazy, Suspense } from 'react'
import { useSlashSearchFocus } from '@/hooks/useSlashSearchFocus'
import { Link, useSearchParams, Navigate } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import {
  Archive,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Dumbbell,
  Search,
  Pencil,
  Trash2,
  Copy,
  FileText,
  ChevronDown,
  Filter,
  X,
  ArrowDownUp,
  Check,
} from 'lucide-react'
import { useRoutines } from '@/hooks/useRoutines'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Popover } from '@/components/ui/Popover'
import { cn, formatDate } from '@/lib/utils'
import { RoutineWeekSquares } from '@/components/checkIn/RoutineWeekSquares'
import { loadBlockCountsByRoutine, loadWeekStatusByOwner, weekStatusOrEmpty } from '@/lib/checkIn/routineWeekProgress'
import type { LatestWeekStatus } from '@/lib/checkIn/latestWeekStatus'
import { tableRowEnterStyle } from '@/lib/tableRowEnterAnimation'
import { StudentAvatarThumb } from '@/lib/studentAvatar'
import { RoutineDeletionHistoryPanel } from '@/components/routines/RoutineDeletionHistoryPanel'
import { StudentRoutineWeekPanel } from '@/components/checkIn/StudentRoutineWeekPanel'
import { NewRoutineModal } from '@/components/routines/NewRoutineModal'
import { AdvisoriesSectionNav } from '@/components/layout/AdvisoriesSectionNav'

const RoutinePdfsPanelLazy = lazy(() =>
  import('@/pages/routines/RoutinePdfsPanel').then((m) => ({ default: m.RoutinePdfsPanel })),
)
import type { Routine, RoutineStatus, Student } from '@/types/database'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'
import { SegmentedControl } from '@/components/ui/SegmentedControl'

type RoutineWithStudent = Routine & {
  student?: { full_name: string; level?: string; status?: string; avatar_path?: string | null } | null
}

const ROUTINE_COLORS = IS_V2
  ? [
      // Un solo tono neutro: el color por alumno no significaba nada.
      { bar: 'bg-ink-muted/30', avatar: 'bg-surface-elevated text-ink-secondary' },
    ]
  : [
      { bar: 'bg-brand-secondary', avatar: 'bg-brand-secondary/15 text-brand-secondary' },
      { bar: 'bg-brand-tertiary', avatar: 'bg-brand-tertiary/15 text-brand-tertiary' },
      { bar: 'bg-brand-primary', avatar: 'bg-brand-primary/15 text-brand-primary' },
    ]

function strColorIdx(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return Math.abs(h) % ROUTINE_COLORS.length
}

/** «2026-10-03» → «3/10». */
function shortDate(ymd: string | null | undefined): string {
  if (!ymd) return '—'
  const [, m, d] = ymd.slice(0, 10).split('-').map(Number)
  return m && d ? `${d}/${m}` : '—'
}

const LEVEL_LABELS: Record<string, string> = {
  inicial: 'Inicial',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

const ROUTINE_STATUS_OPTIONS: { value: RoutineStatus; label: string }[] = [
  { value: 'activa', label: 'Activa' },
  { value: 'por_vencer', label: 'Por vencer' },
  { value: 'vencida', label: 'Vencida' },
  { value: 'completada', label: 'Completada' },
  { value: 'pausada', label: 'Pausada' },
  { value: 'cancelada', label: 'Cancelada' },
]

function phraseRoutineStatus(status: RoutineStatus): string {
  return ROUTINE_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
}

type RoutineLevelFilter = '' | 'inicial' | 'intermedio' | 'avanzado'
type RoutineStatusFilter = '' | RoutineStatus

type RoutineTableSort =
  | 'recommended'
  | 'student_asc'
  | 'student_desc'
  | 'end_asc'
  | 'end_desc'
  | 'name_asc'
  | 'name_desc'

const ROUTINE_SORT_OPTS: { value: RoutineTableSort; label: string }[] = [
  { value: 'recommended', label: 'Activas primero · alumno' },
  { value: 'student_asc', label: 'Alumno · A→Z' },
  { value: 'student_desc', label: 'Alumno · Z→A' },
  { value: 'name_asc', label: 'Rutina · A→Z' },
  { value: 'name_desc', label: 'Rutina · Z→A' },
  { value: 'end_asc', label: 'Vence · más próximo' },
  { value: 'end_desc', label: 'Vence · más lejano' },
]

const ROUTINE_SORT_SUBTITLE: Record<RoutineTableSort, string> = {
  recommended: 'Activas primero · alumno',
  student_asc: 'Alumno · A→Z',
  student_desc: 'Alumno · Z→A',
  name_asc: 'Nombre rutina · A→Z',
  name_desc: 'Nombre rutina · Z→A',
  end_asc: 'Fin período · próximo primero',
  end_desc: 'Fin período · lejano primero',
}

/** Nombre del alumno; si fue eliminado, el que quedó guardado en la rutina. */
function routineStudentName(r: RoutineWithStudent): string {
  if (r.student?.full_name) return r.student.full_name
  return r.former_student_name ? `${r.former_student_name} (eliminado)` : ''
}

function sortRoutinesList(list: RoutineWithStudent[], sort: RoutineTableSort): RoutineWithStudent[] {
  const copy = [...list]
  const studentName = (r: RoutineWithStudent) => routineStudentName(r)
  const activeRank = (r: RoutineWithStudent) => (r.status === 'activa' || r.status === 'por_vencer' ? 0 : 1)
  const endCmp = (a: RoutineWithStudent, b: RoutineWithStudent) => a.end_date.localeCompare(b.end_date)
  const nameR = (a: RoutineWithStudent, b: RoutineWithStudent) => a.name.localeCompare(b.name, 'es')

  switch (sort) {
    case 'recommended':
      copy.sort((a, b) => activeRank(a) - activeRank(b) || endCmp(a, b) || studentName(a).localeCompare(studentName(b), 'es'))
      break
    case 'student_asc':
      copy.sort((a, b) => studentName(a).localeCompare(studentName(b), 'es') || nameR(a, b))
      break
    case 'student_desc':
      copy.sort((a, b) => studentName(b).localeCompare(studentName(a), 'es') || nameR(a, b))
      break
    case 'name_asc':
      copy.sort((a, b) => nameR(a, b) || studentName(a).localeCompare(studentName(b), 'es'))
      break
    case 'name_desc':
      copy.sort((a, b) => nameR(b, a) || studentName(a).localeCompare(studentName(b), 'es'))
      break
    case 'end_asc':
      copy.sort((a, b) => endCmp(a, b) || studentName(a).localeCompare(studentName(b), 'es'))
      break
    case 'end_desc':
      copy.sort((a, b) => endCmp(b, a) || studentName(a).localeCompare(studentName(b), 'es'))
      break
    default:
      break
  }
  return copy
}

/** v2: lo que se usa poco (rutinas eliminadas) queda en un menú «…». */
function RoutinesMoreMenu({ showDeleted, onToggleDeleted }: { showDeleted: boolean; onToggleDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      className="w-56 p-1"
      trigger={({ ref, onClick, ...a11y }) => (
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          title="Más acciones"
          aria-label="Más acciones"
          className="inline-flex h-10 items-center justify-center rounded-md border border-surface-border/75 px-3 text-ink-secondary transition-colors hover:text-ink-primary"
          {...a11y}
        >
          <MoreHorizontal className="h-4 w-4 opacity-70" aria-hidden />
        </button>
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-ink-primary transition-colors hover:bg-surface-elevated"
        onClick={() => {
          setOpen(false)
          onToggleDeleted()
        }}
      >
        <Archive className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
        {showDeleted ? 'Ocultar eliminadas' : 'Ver rutinas eliminadas'}
      </button>
    </Popover>
  )
}

function RoutinesFiltersDropdown({
  filterLevel,
  setFilterLevel,
  filterStatus,
  setFilterStatus,
}: {
  filterLevel: RoutineLevelFilter
  setFilterLevel: (v: RoutineLevelFilter) => void
  filterStatus: RoutineStatusFilter
  setFilterStatus: (v: RoutineStatusFilter) => void
}) {
  const [open, setOpen] = useState(false)
  const activeCount = (filterLevel ? 1 : 0) + (filterStatus ? 1 : 0)

  return (
    <div className="relative inline-flex shrink-0">
      <Popover
        open={open}
        onOpenChange={setOpen}
        className="w-56 space-y-2.5 p-3"
        trigger={({ ref, onClick, ...a11y }) => (
          <button
            ref={ref}
            type="button"
            onClick={onClick}
            className={cn(
              'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-3.5 text-sm font-medium text-ink-primary transition-colors',
              activeCount > 0
                ? 'border-surface-inputBorder/90 bg-surface-elevated/80 '
                : 'border-surface-border/70 bg-transparent hover:border-surface-inputBorder hover:bg-surface-elevated/80 ',
            )}
            {...a11y}
          >
            <Filter className="h-4 w-4 text-ink-muted " aria-hidden />
            Filtrar
            {activeCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded bg-zinc-900 px-1.5 text-3xs font-semibold text-white ">
                {activeCount}
              </span>
            )}
            <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
          </button>
        )}
      >
          <div>
            <p className="mb-1.5 text-3xs font-semibold text-ink-muted ">Nivel</p>
            {(['', 'inicial', 'intermedio', 'avanzado'] as RoutineLevelFilter[]).map((v) => (
              <button
                key={v || 'all-nivel'}
                type="button"
                onClick={() => setFilterLevel(v)}
                className={cn(
                  'w-full rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                  filterLevel === v
                    ? 'bg-slate-500/12 font-medium text-ink-primary dark:bg-slate-400/14 '
                    : 'text-ink-secondary hover:bg-surface-elevated/60 ',
                )}
              >
                {v === '' ? 'Todos' : LEVEL_LABELS[v]}
              </button>
            ))}
          </div>

          <div className="border-t border-surface-border/65 pt-2 ">
            <p className="mb-1.5 text-3xs font-semibold text-ink-muted">Estado rutina</p>
            {([{ value: '' as RoutineStatusFilter, label: 'Todos' }, ...ROUTINE_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]).map(
              (opt) => (
                <button
                  key={opt.value || 'all-st'}
                  type="button"
                  onClick={() => setFilterStatus(opt.value)}
                  className={cn(
                    'w-full rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                    filterStatus === opt.value
                      ? 'bg-slate-500/12 font-medium text-ink-primary dark:bg-slate-400/14 '
                      : 'text-ink-secondary hover:bg-surface-elevated/60 ',
                  )}
                >
                  {opt.label}
                </button>
              ),
            )}
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setFilterLevel('')
                setFilterStatus('')
                setOpen(false)
              }}
              className="flex w-full items-center justify-center gap-1 border-t border-surface-border/65 pt-2 text-xs text-ink-muted transition-colors hover:text-rose-600 dark:hover:text-rose-400"
            >
              <X className="h-3 w-3" />
              Limpiar filtros
            </button>
          )}
      </Popover>
    </div>
  )
}

function RoutinesSortDropdown({ value, onChange }: { value: RoutineTableSort; onChange: (v: RoutineTableSort) => void }) {
  const [open, setOpen] = useState(false)

  const selectedLabel = ROUTINE_SORT_OPTS.find((o) => o.value === value)?.label ?? ROUTINE_SORT_OPTS[0].label

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
              'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-surface-border/70 px-3.5 text-sm font-medium text-ink-primary transition-colors',
              'bg-transparent hover:border-surface-inputBorder hover:bg-surface-elevated/80 ',
            )}
            {...a11y}
          >
            <ArrowDownUp className="h-4 w-4 text-ink-muted " aria-hidden />
            Ordenar
            <ChevronDown className={cn('h-3 w-3 shrink-0 opacity-70 transition-transform', open && 'rotate-180')} />
          </button>
        )}
      >
          <p className="px-2 pb-1.5 pt-0.5 text-3xs font-semibold text-ink-muted">Orden del listado</p>
          {ROUTINE_SORT_OPTS.map((opt) => (
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
                  ? 'bg-surface-border/85 font-medium text-ink-primary '
                  : 'text-ink-secondary hover:bg-surface-elevated/60 ',
              )}
            >
              {opt.label}
            </button>
          ))}
      </Popover>
    </div>
  )
}

export function RoutinesPage() {
  const navigate = useAppNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabPlantillas = searchParams.get('tab') === 'plantillas'
  const tabPdfs = searchParams.get('tab') === 'pdfs'
  const showNewRoutineModal = searchParams.get('create') === '1'

  const openNewRoutineModal = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('create', '1')
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const closeNewRoutineModal = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('create')
        next.delete('student')
        next.delete('blueprint')
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])
  const { user } = useAuthStore()
  const { routines, loading, fetchRoutines, deleteRoutine, updateRoutine } = useRoutines()
  const [search, setSearch] = useState('')
  const [filterLevel, setFilterLevel] = useState<RoutineLevelFilter>('')
  const [filterStatus, setFilterStatus] = useState<RoutineStatusFilter>('')
  const [tableSort, setTableSort] = useState<RoutineTableSort>('recommended')
  const [showDeleted, setShowDeleted] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const [deleteTarget, setDeleteTarget] = useState<RoutineWithStudent | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [weekByStudent, setWeekByStudent] = useState<Map<string, LatestWeekStatus>>(() => new Map())
  const [blocksByRoutine, setBlocksByRoutine] = useState<Map<string, number>>(() => new Map())

  const [duplicateTarget, setDuplicateTarget] = useState<RoutineWithStudent | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [dupStudentId, setDupStudentId] = useState('')
  const [duplicating, setDuplicating] = useState(false)

  useEffect(() => {
    if (!duplicateTarget || !user) return
    supabase
      .from('students')
      .select('id, full_name')
      .eq('owner_id', user.id)
      .order('full_name')
      .then(({ data }) => {
        setStudents((data as Student[]) ?? [])
        setDupStudentId('')
      })
  }, [duplicateTarget, user])

  async function handleDuplicate() {
    if (!duplicateTarget || !dupStudentId || !user) return
    setDuplicating(true)
    try {
      const { data: blocks } = await supabase
        .from('routine_blocks')
        .select('*')
        .eq('routine_id', duplicateTarget.id)
        .order('sort_order')
      const blockIds = (blocks ?? []).map((b) => b.id as string)
      const [{ data: days }, { data: exercises }] = await Promise.all([
        blockIds.length
          ? supabase.from('routine_days').select('*').in('block_id', blockIds).order('sort_order')
          : Promise.resolve({ data: [] }),
        blockIds.length
          ? supabase.from('routine_exercises').select('*').in('day_id',
              ((await supabase.from('routine_days').select('id').in('block_id', blockIds)).data ?? []).map((d) => d.id as string)
            ).order('sort_order')
          : Promise.resolve({ data: [] }),
      ])

      const { data: newRoutine, error: routineErr } = await supabase
        .from('routines')
        .insert({
          owner_id: user.id,
          student_id: dupStudentId,
          name: `${duplicateTarget.name} (copia)`,
          objective: duplicateTarget.objective,
          level: duplicateTarget.level,
          start_date: duplicateTarget.start_date,
          end_date: duplicateTarget.end_date,
          duration_days: duplicateTarget.duration_days,
          price: duplicateTarget.price,
          status: 'activa',
          notes: duplicateTarget.notes,
        })
        .select('id')
        .single()
      if (routineErr || !newRoutine) {
        toast.error(routineErr?.message ?? 'Error al duplicar')
        return
      }

      const blockIdMap = new Map<string, string>()
      for (const b of blocks ?? []) {
        const { data: nb } = await supabase
          .from('routine_blocks')
          .insert({
            routine_id: newRoutine.id,
            name: b.name,
            sort_order: b.sort_order,
            notes: b.notes,
            start_date: b.start_date,
            end_date: b.end_date,
          })
          .select('id')
          .single()
        if (nb) blockIdMap.set(b.id as string, nb.id as string)
      }

      const dayIdMap = new Map<string, string>()
      for (const d of days ?? []) {
        const newBlockId = blockIdMap.get(d.block_id as string)
        if (!newBlockId) continue
        const { data: nd } = await supabase
          .from('routine_days')
          .insert({
            block_id: newBlockId,
            day_name: d.day_name,
            day_of_week: d.day_of_week,
            muscle_focus: d.muscle_focus,
            warmup_notes: d.warmup_notes,
            sort_order: d.sort_order,
          })
          .select('id')
          .single()
        if (nd) dayIdMap.set(d.id as string, nd.id as string)
      }

      const exRows = (exercises ?? [])
        .map((ex) => {
          const newDayId = dayIdMap.get(ex.day_id as string)
          if (!newDayId) return null
          const { id: _id, day_id: _day, exercise: _ex, ...rest } = ex as Record<string, unknown>
          void _id
          void _day
          void _ex
          return { ...rest, day_id: newDayId }
        })
        .filter(Boolean)
      if (exRows.length) await supabase.from('routine_exercises').insert(exRows)

      toast.success('Rutina duplicada')
      fetchRoutines()
      setDuplicateTarget(null)
    } finally {
      setDuplicating(false)
    }
  }

  useEffect(() => {
    fetchRoutines()
  }, [fetchRoutines])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void loadWeekStatusByOwner(user.id).then((map) => {
      if (!cancelled) setWeekByStudent(map)
    })
    return () => {
      cancelled = true
    }
  }, [user, routines])

  useEffect(() => {
    const ids = routines.map((r) => r.id)
    if (!ids.length) {
      setBlocksByRoutine(new Map())
      return
    }
    let cancelled = false
    void loadBlockCountsByRoutine(ids).then((map) => {
      if (!cancelled) setBlocksByRoutine(map)
    })
    return () => {
      cancelled = true
    }
  }, [routines])

  useSlashSearchFocus(searchRef, !tabPlantillas && !tabPdfs)

  function startRename(r: RoutineWithStudent, e: React.MouseEvent) {
    e.stopPropagation()
    setRenamingId(r.id)
    setRenameValue(r.name)
    setTimeout(() => renameInputRef.current?.select(), 30)
  }

  async function commitRename(id: string) {
    const trimmed = renameValue.trim()
    if (!trimmed) { setRenamingId(null); return }
    const updated = await updateRoutine(id, { name: trimmed })
    if (updated) setRenamingId(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const ok = await deleteRoutine(deleteTarget.id)
    setDeleting(false)
    if (ok) {
      setDeleteTarget(null)
      fetchRoutines()
    }
  }

  const list = routines as RoutineWithStudent[]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return list.filter((r) => {
      const nm = routineStudentName(r).toLowerCase()
      const rn = r.name.toLowerCase()
      if (q && !nm.includes(q) && !rn.includes(q)) return false
      // Las completadas viven en el historial: no se mezclan con activas salvo que se filtre por ese estado.
      if (filterStatus !== 'completada' && r.status === 'completada') return false
      if (filterLevel && r.level !== filterLevel) return false
      if (filterStatus && r.status !== filterStatus) return false
      return true
    })
  }, [list, search, filterLevel, filterStatus])

  const filteredSorted = useMemo(() => sortRoutinesList(filtered, tableSort), [filtered, tableSort])

  const filterActiveCount = (filterLevel ? 1 : 0) + (filterStatus ? 1 : 0)

  /** v2: pastillas de estado con su cantidad (las que no tienen ninguna no se muestran). */
  const statusOptions = useMemo(() => {
    const count = (st: RoutineStatus) => list.filter((r) => r.status === st).length
    const opts: { value: RoutineStatusFilter; label: string; count: number }[] = [
      { value: '', label: 'Todas', count: list.filter((r) => r.status !== 'completada').length },
      { value: 'activa', label: 'Activas', count: count('activa') },
      { value: 'por_vencer', label: 'Por vencer', count: count('por_vencer') },
      { value: 'vencida', label: 'Vencidas', count: count('vencida') },
      { value: 'pausada', label: 'Pausadas', count: count('pausada') },
      { value: 'completada', label: 'Completadas', count: count('completada') },
    ]
    return opts.filter((o) => o.value === '' || o.count > 0 || o.value === filterStatus)
  }, [list, filterStatus])

  if (tabPlantillas) {
    return <Navigate to="/exercises/blueprints" replace />
  }

  return (
    <div>
      <Header
        title="Rutinas"
        actions={
          IS_V2 ? (
            <Button size="sm" title="Nueva rutina" onClick={openNewRoutineModal} icon={<Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />}>
              Nueva rutina
            </Button>
          ) : undefined
        }
      />
      <div className="px-4 pt-4 lg:px-6">
        <AdvisoriesSectionNav />
      </div>

      <div className="px-4 lg:px-6">
        <SegmentedControl
          size="sm"
          ariaLabel="Rutinas"
          value={tabPdfs ? 'pdfs' : 'mine'}
          onChange={(id) => {
            if (id === 'pdfs') {
              setSearchParams({ tab: 'pdfs' }, { replace: true })
              return
            }
            setSearchParams(
              (prev) => {
                const next = new URLSearchParams(prev)
                next.delete('tab')
                return next
              },
              { replace: true },
            )
          }}
          items={[
            { id: 'mine', label: 'Mis rutinas' },
            { id: 'pdfs', label: 'PDFs', icon: FileText },
          ]}
        />
      </div>

      <div className="space-y-4 px-4 py-6 lg:px-6 lg:py-8">
        {tabPdfs ? (
          <Suspense
            fallback={
              <div className="flex justify-center py-16">
                <Spinner size="lg" />
              </div>
            }
          >
            <RoutinePdfsPanelLazy />
          </Suspense>
        ) : (
          <div className="max-w-[1600px] space-y-4">
            {IS_V2 ? null : <StudentRoutineWeekPanel />}
            {IS_V2 ? null : <RoutineDeletionHistoryPanel onRestored={() => void fetchRoutines()} />}

            {IS_V2 ? (
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative min-w-0 lg:max-w-xs lg:flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2">
                    <Search className="h-4 w-4 text-ink-muted" aria-hidden />
                  </span>
                  <input
                    ref={searchRef}
                    type="search"
                    placeholder="Buscar rutina o alumno…"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Buscar rutinas"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-10 w-full rounded-md border border-surface-border/75 bg-transparent pl-10 pr-3 text-sm text-ink-primary outline-none placeholder:text-ink-muted focus-visible:border-surface-inputBorder focus-visible:ring-1 focus-visible:ring-surface-inputBorder/50"
                  />
                </div>
                <div className="-mx-4 overflow-x-auto px-4 scrollbar-hide lg:mx-0 lg:shrink-0 lg:overflow-visible lg:px-0 [&>div]:flex-nowrap">
                  <SegmentedV2
                    value={filterStatus || ('all' as const)}
                    onChange={(v) => setFilterStatus(v === 'all' || v === filterStatus ? '' : (v as RoutineStatusFilter))}
                    options={statusOptions.map((o) => ({ value: o.value || ('all' as const), label: o.label, count: o.count }))}
                  />
                </div>
                <div className="flex items-center gap-2 lg:ml-auto">
                  <RoutinesFiltersDropdown
                    filterLevel={filterLevel}
                    setFilterLevel={setFilterLevel}
                    filterStatus={filterStatus}
                    setFilterStatus={setFilterStatus}
                  />
                  <RoutinesSortDropdown value={tableSort} onChange={setTableSort} />
                  <RoutinesMoreMenu showDeleted={showDeleted} onToggleDeleted={() => setShowDeleted((v) => !v)} />
                  {filterLevel ? (
                    <span className="inline-flex h-10 items-center gap-1.5 rounded-md border border-surface-border/75 px-2.5 text-xs font-medium text-ink-primary">
                      {LEVEL_LABELS[filterLevel]}
                      <Button variant="ghost" size="iconSm" type="button" className="-m-1.5 text-ink-muted" aria-label="Quitar filtro nivel" onClick={() => setFilterLevel('')}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
            {IS_V2 ? <RoutineDeletionHistoryPanel controlledOpen={showDeleted} onRestored={() => void fetchRoutines()} /> : null}

            {IS_V2 ? null : (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
              <div className="relative min-h-10 min-w-0 flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2">
                  <Search className="h-4 w-4 text-ink-muted " aria-hidden />
                </span>
                <input
                  ref={searchRef}
                  type="search"
                  placeholder="Buscar por alumno o rutina…"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Buscar rutinas"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={cn(
                    'h-10 w-full rounded-md border border-surface-border/75 bg-transparent pl-10 pr-3 text-sm text-ink-primary outline-none shadow-none',
                    'placeholder:text-ink-muted',
                    'focus-visible:border-surface-inputBorder focus-visible:ring-1 focus-visible:ring-surface-inputBorder/50',
                    ' ',
                    ' ',
                  )}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 md:justify-end md:gap-2">
                <RoutinesFiltersDropdown
                  filterLevel={filterLevel}
                  setFilterLevel={setFilterLevel}
                  filterStatus={filterStatus}
                  setFilterStatus={setFilterStatus}
                />
                <RoutinesSortDropdown value={tableSort} onChange={setTableSort} />

                {filterLevel && (
                  <span className="inline-flex h-10 items-center gap-1.5 rounded-md border border-surface-border/75 px-2.5 text-xs font-medium text-ink-primary ">
                    {LEVEL_LABELS[filterLevel]}
                    <Button
                      variant="ghost"
                      size="iconSm"
                      type="button"
                      className="-m-1.5 text-ink-muted"
                      aria-label="Quitar filtro nivel"
                      onClick={() => setFilterLevel('')}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                )}
                {filterStatus && (
                  <span className="inline-flex h-10 items-center gap-1.5 rounded-md border border-surface-border/75 px-2.5 text-xs font-medium text-ink-primary ">
                    {phraseRoutineStatus(filterStatus)}
                    <Button
                      variant="ghost"
                      size="iconSm"
                      type="button"
                      className="-m-1.5 text-ink-muted"
                      aria-label="Quitar filtro estado"
                      onClick={() => setFilterStatus('')}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                )}

                <Button
                  type="button"
                  variant="gradientSecondary"
                  title="Nueva rutina"
                  onClick={openNewRoutineModal}
                  icon={<Plus className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />}
                >
                  Nueva rutina
                </Button>
              </div>
            </div>
            )}

            {loading ? (
              <div className="flex justify-center py-16">
                <Spinner size="lg" />
              </div>
            ) : list.length === 0 ? (
              <EmptyState
                icon={<Dumbbell className="h-8 w-8" />}
                title="No hay rutinas todavía"
                description="Creá la primera rutina para un alumno."
                action={{
                  label: 'Nueva rutina',
                  onClick: openNewRoutineModal,
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
                <div className={IS_V2 ? "hidden" : "flex flex-col gap-2 border-b border-surface-border/70 bg-surface-elevated/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"}>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold tracking-tight text-ink-primary">Listado</h2>
                    <p className="truncate text-2xs text-ink-muted">
                      {ROUTINE_SORT_SUBTITLE[tableSort]}
                      {search.trim() ? ` · texto “${search.trim()}”` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="inline-flex items-center rounded-full border border-surface-border/70 bg-surface-card px-2.5 py-1 text-2xs font-semibold tabular-nums text-ink-secondary">
                      {filteredSorted.length === 1 ? '1 rutina' : `${filteredSorted.length} rutinas`}
                    </span>
                    {filterActiveCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setFilterLevel('')
                          setFilterStatus('')
                        }}
                        className="text-2xs font-medium text-ink-muted underline-offset-4 hover:text-ink-primary hover:underline"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                </div>

                {/* v2 · celu: una tarjeta por rutina en vez de la tabla ancha. */}
                {IS_V2 ? (
                  <ul className="divide-y divide-surface-border/70 sm:hidden">
                    {filteredSorted.map((r) => {
                      const colors = ROUTINE_COLORS[strColorIdx(routineStudentName(r) || r.id)]
                      const st = weekStatusOrEmpty(weekByStudent, r.student_id ?? '')
                      return (
                        <li key={r.id} className="relative">
                          <button
                            type="button"
                            onClick={() => navigate(`/routines/${r.id}`)}
                            className="flex w-full items-start gap-3 py-3 pl-4 pr-3 text-left"
                          >
                            <span className={cn('absolute inset-y-0 left-0 w-1', colors.bar)} aria-hidden />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-ink-primary">{r.name}</p>
                              <p className="mt-0.5 truncate text-xs text-ink-muted">
                                {routineStudentName(r) || '—'} · {shortDate(r.start_date)} → {shortDate(r.end_date)}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <Badge status={r.status} />
                                <RoutineWeekSquares
                                  totalWeeks={blocksByRoutine.get(r.id) ?? 0}
                                  currentWeek={st.weekNumber}
                                  finished={st.finished}
                                  lastWeek={st.lastWeek}
                                />
                              </div>
                            </div>
                            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
                <div className={cn('max-h-[min(72vh,40rem)] overflow-auto', IS_V2 && 'hidden sm:block')}>
                  <table className={cn('w-full border-collapse text-body-sm leading-snug hh-table', IS_V2 ? 'min-w-[720px]' : 'min-w-[980px]')}>
                    <thead className="sticky top-0 z-[1] border-b border-surface-border/70 bg-surface-card/92 backdrop-blur-md">
                      <tr className="text-left">
                        <th className="whitespace-nowrap px-4 py-2.5 text-3xs font-semibold text-ink-muted sm:px-5">Rutina</th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-3xs font-semibold text-ink-muted sm:px-5">Alumno</th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-3xs font-semibold text-ink-muted sm:px-5">Período</th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-3xs font-semibold text-ink-muted sm:px-5">Nivel</th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-3xs font-semibold text-ink-muted sm:px-5">Estado</th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-3xs font-semibold text-ink-muted sm:px-5">Semana</th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-right text-3xs font-semibold text-ink-muted sm:px-5">
                          {IS_V2 ? <span className="sr-only">Acciones</span> : 'Acciones'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border/70 bg-surface-card">
                      {filteredSorted.map((r, rowIndex) => {
                        const ci = strColorIdx(routineStudentName(r) || r.id)
                        const colors = ROUTINE_COLORS[ci]
                        return (
                        <tr
                          key={r.id}
                          style={tableRowEnterStyle(rowIndex)}
                          className="group cursor-pointer transition-colors hover:bg-surface-elevated/35"
                          onClick={() => renamingId !== r.id && navigate(`/routines/${r.id}`)}
                        >
                          {/* Rutina con barra de color + rename inline */}
                          <td className={cn('hh-row-drop-in min-w-[10rem] px-0 py-0 sm:min-w-[12rem]')}>
                            <div className="flex items-stretch gap-0">
                              <div className={cn('w-1 self-stretch shrink-0', colors.bar)} />
                              <div className="flex-1 px-4 py-2.5 sm:px-5">
                                {renamingId === r.id ? (
                                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      ref={renameInputRef}
                                      value={renameValue}
                                      onChange={(e) => setRenameValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') void commitRename(r.id)
                                        if (e.key === 'Escape') setRenamingId(null)
                                      }}
                                      onBlur={() => void commitRename(r.id)}
                                      className="flex-1 min-w-0 rounded-lg border border-brand-secondary/40 bg-surface-input px-2.5 py-1 text-sm font-semibold text-ink-primary outline-none focus:ring-1 focus:ring-brand-secondary/50"
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onMouseDown={(e) => { e.preventDefault(); void commitRename(r.id) }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-secondary/15 text-brand-secondary hover:bg-brand-secondary/25 transition-colors shrink-0"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 group/title">
                                    <Link
                                      to={`/routines/${r.id}`}
                                      onClick={rowLinkClick}
                                      className={cn('break-words rounded-sm font-semibold leading-snug tracking-tight text-ink-primary', appFocusRingClassName)}
                                    >
                                      {r.name}
                                    </Link>
                                    <button
                                      type="button"
                                      title="Renombrar"
                                      onClick={(e) => startRename(r, e)}
                                      className="opacity-0 group-hover/title:opacity-100 shrink-0 rounded p-0.5 text-ink-muted hover:text-brand-secondary transition-all"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          {/* Alumno con foto */}
                          <td
                            className={cn(
                              'hh-row-drop-in max-w-[13rem] px-4 py-2.5 text-body-sm font-normal text-ink-secondary sm:max-w-[15rem] sm:px-5',
                            )}
                            title={routineStudentName(r) || undefined}
                          >
                            <div className="flex items-center gap-2">
                              <StudentAvatarThumb
                                storagePath={(r.student as RoutineWithStudent['student'])?.avatar_path}
                                name={routineStudentName(r) || '?'}
                                fallbackClassName={cn('text-3xs font-semibold', colors.avatar)}
                              />
                              <span className="truncate">{routineStudentName(r) || '—'}</span>
                            </div>
                          </td>
                          <td className={cn('hh-row-drop-in whitespace-nowrap px-4 py-2.5 text-xs text-ink-muted sm:px-5')}>
                            {IS_V2 ? `${shortDate(r.start_date)} → ${shortDate(r.end_date)}` : `${formatDate(r.start_date)} → ${formatDate(r.end_date)}`}
                          </td>
                          <td className={cn('hh-row-drop-in px-4 py-2.5 sm:px-5')}>
                            <Badge status={r.level} />
                          </td>
                          <td className={cn('hh-row-drop-in px-4 py-2.5 sm:px-5')}>
                            <Badge status={r.status} />
                          </td>
                          <td className={cn('hh-row-drop-in px-4 py-2.5 sm:px-5')} onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const st = weekStatusOrEmpty(weekByStudent, r.student_id ?? '')
                              return (
                                <RoutineWeekSquares
                                  totalWeeks={blocksByRoutine.get(r.id) ?? 0}
                                  currentWeek={st.weekNumber}
                                  finished={st.finished}
                                  lastWeek={st.lastWeek}
                                />
                              )
                            })()}
                          </td>
                          <td className={cn('hh-row-drop-in px-4 py-2.5 sm:px-5')}>
                            {IS_V2 ? (
                              <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-lg:opacity-100">
                                <Button variant="ghost" size="iconSm" type="button" className="text-ink-muted" title="Editar datos" aria-label="Editar datos"
                                  onClick={(e) => { e.stopPropagation(); navigate(`/routines/${r.id}/edit`) }}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="iconSm" type="button" className="text-ink-muted" title="Duplicar" aria-label="Duplicar"
                                  onClick={(e) => { e.stopPropagation(); setDuplicateTarget(r) }}>
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="iconSm" type="button" className="text-ink-muted hover:bg-status-expired/10 hover:text-status-expired" title="Eliminar" aria-label="Eliminar"
                                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(r) }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigate(`/routines/${r.id}/edit`)
                                }}
                                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-elevated hover:text-ink-primary"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Datos
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDuplicateTarget(r)
                                }}
                                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-elevated hover:text-ink-primary"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Duplicar
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteTarget(r)
                                }}
                                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-status-expired/12 hover:text-status-expired"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Eliminar
                              </button>
                            </div>
                            )}
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
        )}
      </div>

      <NewRoutineModal
        open={showNewRoutineModal}
        title="Registrar rutina"
        onClose={closeNewRoutineModal}
        onCreated={(id) => navigate(id ? `/routines/${id}` : '/exercises/blueprints')}
        initialStudentId={searchParams.get('student') ?? undefined}
        initialBlueprintId={searchParams.get('blueprint') ?? undefined}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="¿Eliminar rutina?"
        description={`Se eliminarán todos los bloques, días y ejercicios de "${deleteTarget?.name}". Podés recuperarla desde «Ver rutinas eliminadas» si el alumno sigue en la lista.`}
        confirmLabel="Sí, eliminar"
        loading={deleting}
      />

      {duplicateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-surface-border bg-surface-card p-5 shadow-lg">
            <h2 className="text-base font-bold text-ink-primary">Duplicar rutina</h2>
            <p className="text-sm text-ink-secondary">
              <span className="font-medium text-ink-primary">&quot;{duplicateTarget.name}&quot;</span> será copiada con todos sus ejercicios a:
            </p>
            <select
              value={dupStudentId}
              onChange={(e) => setDupStudentId(e.target.value)}
              className={cn(controlMdClassName, 'w-full cursor-pointer')}
            >
              <option value="">Seleccionar alumno...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDuplicateTarget(null)}
                className="rounded-xl border border-surface-border px-4 py-2 text-sm text-ink-secondary hover:text-ink-primary"
              >
                Cancelar
              </button>
              <Button size="sm" icon={<Copy className="h-3.5 w-3.5" />} onClick={handleDuplicate} loading={duplicating} disabled={!dupStudentId}>
                Duplicar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
