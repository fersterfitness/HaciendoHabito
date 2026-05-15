import { useEffect, useState, useMemo, useRef, useCallback, lazy, Suspense } from 'react'
import { useSlashSearchFocus } from '@/hooks/useSlashSearchFocus'
import { useSearchParams } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import {
  Plus,
  Dumbbell,
  Search,
  Pencil,
  Trash2,
  Copy,
  LayoutTemplate,
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
import { cn, formatDate, daysUntil } from '@/lib/utils'
import { tableRowEnterStyle } from '@/lib/tableRowEnterAnimation'
import { studentAvatarPublicUrl } from '@/lib/studentAvatar'
import { RoutineBlueprintsPanel } from '@/pages/routines/RoutineBlueprintsPanel'
import { NewRoutineModal } from '@/components/routines/NewRoutineModal'

const RoutinePdfsPanelLazy = lazy(() =>
  import('@/pages/routines/RoutinePdfsPanel').then((m) => ({ default: m.RoutinePdfsPanel })),
)
import type { Routine, RoutineStatus, Student } from '@/types/database'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'

type RoutineWithStudent = Routine & {
  student?: { full_name: string; level?: string; status?: string; avatar_path?: string | null } | null
}

const ROUTINE_COLORS = [
  { bar: 'bg-brand-secondary', avatar: 'bg-brand-secondary/15 text-brand-secondary' },
  { bar: 'bg-brand-tertiary', avatar: 'bg-brand-tertiary/15 text-brand-tertiary' },
  { bar: 'bg-[#ff4800]', avatar: 'bg-[#ff5508]/15 text-[#ff5508] dark:bg-[#ff5508]/18 dark:text-[#ffa065]' },
]

function strColorIdx(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return Math.abs(h) % ROUTINE_COLORS.length
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
  { value: 'pausada', label: 'Pausada' },
  { value: 'cancelada', label: 'Cancelada' },
]

function phraseRoutineStatus(status: RoutineStatus): string {
  return ROUTINE_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
}

/** Píldora de estado (Activa → verde, etc.) — alineado con ficha alumno */
function routineStatusBadgeClass(status: RoutineStatus): string {
  const base = 'inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide'
  switch (status) {
    case 'activa':
      return cn(
        base,
        'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/[0.14] dark:text-emerald-400',
      )
    case 'por_vencer':
      return cn(
        base,
        'border-status-expiring/40 bg-status-expiring/10 text-status-expiring',
      )
    case 'vencida':
      return cn(
        base,
        'border-rose-400/45 bg-rose-500/12 text-rose-800 dark:border-rose-400/35 dark:bg-rose-500/10 dark:text-rose-400',
      )
    case 'pausada':
      return cn(base, 'border-zinc-400/55 bg-zinc-500/12 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-600/15 dark:text-zinc-400')
    case 'cancelada':
      return cn(base, 'border-zinc-300/80 bg-zinc-500/8 text-zinc-600 dark:border-zinc-700 dark:text-zinc-500')
    default:
      return cn(base, 'border-zinc-200/80 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400')
  }
}

function RoutineDaysChip({ endDate }: { endDate: string }) {
  const days = daysUntil(endDate)
  if (days < 0) {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-md border border-status-expired/25 bg-status-expired/10 px-2 py-0.5 text-xs font-semibold text-status-expired">
        Vencida
      </span>
    )
  }
  if (days === 0) {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-md border border-status-expired/25 bg-status-expired/10 px-2 py-0.5 text-xs font-semibold text-status-expired">
        Hoy
      </span>
    )
  }
  if (days <= 7) {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-md border border-status-expiring/30 bg-status-expiring/10 px-2 py-0.5 text-xs font-semibold text-status-expiring">
        {days}d
      </span>
    )
  }
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-md border border-emerald-500/25 bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-400">
      {days}d
    </span>
  )
}

type RoutineLevelFilter = '' | 'inicial' | 'intermedio' | 'avanzado'
type RoutineStatusFilter = '' | RoutineStatus
/** Filtro por fecha de fin de período */
type RoutineExpiryFilter = '' | 'pronto' | 'vencido'

type RoutineTableSort =
  | 'recommended'
  | 'student_asc'
  | 'student_desc'
  | 'end_asc'
  | 'end_desc'
  | 'name_asc'
  | 'name_desc'

const ROUTINE_SORT_OPTS: { value: RoutineTableSort; label: string }[] = [
  { value: 'recommended', label: 'Activas primero · vencimiento' },
  { value: 'student_asc', label: 'Alumno · A→Z' },
  { value: 'student_desc', label: 'Alumno · Z→A' },
  { value: 'name_asc', label: 'Rutina · A→Z' },
  { value: 'name_desc', label: 'Rutina · Z→A' },
  { value: 'end_asc', label: 'Vence · más próximo' },
  { value: 'end_desc', label: 'Vence · más lejano' },
]

const ROUTINE_SORT_SUBTITLE: Record<RoutineTableSort, string> = {
  recommended: 'Activas primero · vencimiento ↑',
  student_asc: 'Alumno · A→Z',
  student_desc: 'Alumno · Z→A',
  name_asc: 'Nombre rutina · A→Z',
  name_desc: 'Nombre rutina · Z→A',
  end_asc: 'Fin período · próximo primero',
  end_desc: 'Fin período · lejano primero',
}

function sortRoutinesList(list: RoutineWithStudent[], sort: RoutineTableSort): RoutineWithStudent[] {
  const copy = [...list]
  const studentName = (r: RoutineWithStudent) => r.student?.full_name ?? ''
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

function RoutinesFiltersDropdown({
  filterLevel,
  setFilterLevel,
  filterStatus,
  setFilterStatus,
  filterExpiry,
  setFilterExpiry,
}: {
  filterLevel: RoutineLevelFilter
  setFilterLevel: (v: RoutineLevelFilter) => void
  filterStatus: RoutineStatusFilter
  setFilterStatus: (v: RoutineStatusFilter) => void
  filterExpiry: RoutineExpiryFilter
  setFilterExpiry: (v: RoutineExpiryFilter) => void
}) {
  const [open, setOpen] = useState(false)
  const activeCount = (filterLevel ? 1 : 0) + (filterStatus ? 1 : 0) + (filterExpiry ? 1 : 0)

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
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">Nivel</p>
            {(['', 'inicial', 'intermedio', 'avanzado'] as RoutineLevelFilter[]).map((v) => (
              <button
                key={v || 'all-nivel'}
                type="button"
                onClick={() => setFilterLevel(v)}
                className={cn(
                  'w-full rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                  filterLevel === v
                    ? 'bg-slate-500/12 font-medium text-zinc-900 dark:bg-slate-400/14 dark:text-zinc-50'
                    : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60',
                )}
              >
                {v === '' ? 'Todos' : LEVEL_LABELS[v]}
              </button>
            ))}
          </div>

          <div className="border-t border-zinc-200/65 pt-2 dark:border-zinc-800/80">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Estado rutina</p>
            {([{ value: '' as RoutineStatusFilter, label: 'Todos' }, ...ROUTINE_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]).map(
              (opt) => (
                <button
                  key={opt.value || 'all-st'}
                  type="button"
                  onClick={() => setFilterStatus(opt.value)}
                  className={cn(
                    'w-full rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                    filterStatus === opt.value
                      ? 'bg-slate-500/12 font-medium text-zinc-900 dark:bg-slate-400/14 dark:text-zinc-50'
                      : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60',
                  )}
                >
                  {opt.label}
                </button>
              ),
            )}
          </div>

          <div className="border-t border-zinc-200/65 pt-2 dark:border-zinc-800/80">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Período</p>
            {([
              { value: '' as RoutineExpiryFilter, label: 'Todos' },
              { value: 'pronto' as RoutineExpiryFilter, label: 'Vence en ≤14 días' },
              { value: 'vencido' as RoutineExpiryFilter, label: 'Período ya vencido' },
            ]).map((opt) => (
              <button
                key={opt.value || 'all-exp'}
                type="button"
                onClick={() => setFilterExpiry(opt.value)}
                className={cn(
                  'w-full rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                  filterExpiry === opt.value
                    ? 'bg-slate-500/12 font-medium text-zinc-900 dark:bg-slate-400/14 dark:text-zinc-50'
                    : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setFilterLevel('')
                setFilterStatus('')
                setFilterExpiry('')
                setOpen(false)
              }}
              className="flex w-full items-center justify-center gap-1 border-t border-zinc-200/65 pt-2 text-xs text-zinc-500 transition-colors hover:text-rose-600 dark:border-zinc-800/80 dark:hover:text-rose-400"
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
  const { routines, loading, fetchRoutines, deleteRoutine } = useRoutines()
  const [search, setSearch] = useState('')
  const [filterLevel, setFilterLevel] = useState<RoutineLevelFilter>('')
  const [filterStatus, setFilterStatus] = useState<RoutineStatusFilter>('')
  const [filterExpiry, setFilterExpiry] = useState<RoutineExpiryFilter>('')
  const [tableSort, setTableSort] = useState<RoutineTableSort>('recommended')
  const searchRef = useRef<HTMLInputElement>(null)
  const [deleteTarget, setDeleteTarget] = useState<RoutineWithStudent | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

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
      const nm = r.student?.full_name?.toLowerCase() ?? ''
      const rn = r.name.toLowerCase()
      if (q && !nm.includes(q) && !rn.includes(q)) return false
      if (filterLevel && r.level !== filterLevel) return false
      if (filterStatus && r.status !== filterStatus) return false
      if (filterExpiry) {
        const dLeft = daysUntil(r.end_date)
        if (filterExpiry === 'vencido' && dLeft >= 0) return false
        if (filterExpiry === 'pronto' && !(dLeft >= 0 && dLeft <= 14)) return false
      }
      return true
    })
  }, [list, search, filterLevel, filterStatus, filterExpiry])

  const filteredSorted = useMemo(() => sortRoutinesList(filtered, tableSort), [filtered, tableSort])

  const filterActiveCount = (filterLevel ? 1 : 0) + (filterStatus ? 1 : 0) + (filterExpiry ? 1 : 0)

  return (
    <div>
      <Header title="Rutinas" />

      <div className="flex gap-2 border-b border-surface-border px-4 pt-4 lg:px-6">
        <button
          type="button"
          onClick={() =>
            setSearchParams(
              (prev) => {
                const next = new URLSearchParams(prev)
                next.delete('tab')
                return next
              },
              { replace: true },
            )
          }
          className={cn(
            '-mb-px rounded-t-xl border border-b-0 px-4 py-2.5 text-sm font-semibold transition-colors',
            !tabPlantillas && !tabPdfs
              ? 'border-surface-border bg-surface-card text-ink-primary'
              : 'border-transparent text-ink-muted hover:bg-surface-muted/40 hover:text-ink-secondary',
          )}
        >
          Mis rutinas
        </button>
        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'plantillas' }, { replace: true })}
          className={cn(
            'flex items-center gap-2 rounded-t-xl border border-b-0 px-4 py-2.5 text-sm font-semibold transition-colors -mb-px',
            tabPlantillas
              ? 'border-surface-border bg-surface-card text-ink-primary'
              : 'border-transparent text-ink-muted hover:bg-surface-muted/40 hover:text-ink-secondary',
          )}
        >
          <LayoutTemplate className="h-4 w-4 shrink-0" aria-hidden />
          Plantillas
        </button>
        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'pdfs' }, { replace: true })}
          className={cn(
            'flex items-center gap-2 rounded-t-xl border border-b-0 px-4 py-2.5 text-sm font-semibold transition-colors -mb-px',
            tabPdfs
              ? 'border-surface-border bg-surface-card text-ink-primary'
              : 'border-transparent text-ink-muted hover:bg-surface-muted/40 hover:text-ink-secondary',
          )}
        >
          <FileText className="h-4 w-4 shrink-0" aria-hidden />
          PDFs
        </button>
      </div>

      <div className="space-y-4 px-4 py-6 lg:px-6 lg:py-8">
        {tabPlantillas ? (
          <RoutineBlueprintsPanel />
        ) : tabPdfs ? (
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
          <div className="mx-auto max-w-[1600px] space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
              <div className="relative min-h-10 min-w-0 flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2">
                  <Search className="h-4 w-4 text-zinc-400 dark:text-zinc-500" aria-hidden />
                </span>
                <input
                  ref={searchRef}
                  type="search"
                  placeholder="Buscar por alumno o rutina… ( / para enfocar )"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Buscar rutinas"
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
                <RoutinesFiltersDropdown
                  filterLevel={filterLevel}
                  setFilterLevel={setFilterLevel}
                  filterStatus={filterStatus}
                  setFilterStatus={setFilterStatus}
                  filterExpiry={filterExpiry}
                  setFilterExpiry={setFilterExpiry}
                />
                <RoutinesSortDropdown value={tableSort} onChange={setTableSort} />

                {filterLevel && (
                  <span className="inline-flex h-10 items-center gap-1.5 rounded-md border border-zinc-200/75 px-2.5 text-xs font-medium text-zinc-900 dark:border-zinc-700/80 dark:text-zinc-100">
                    {LEVEL_LABELS[filterLevel]}
                    <button
                      type="button"
                      className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                      aria-label="Quitar filtro nivel"
                      onClick={() => setFilterLevel('')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
                {filterStatus && (
                  <span className="inline-flex h-10 items-center gap-1.5 rounded-md border border-zinc-200/75 px-2.5 text-xs font-medium text-zinc-900 dark:border-zinc-700/80 dark:text-zinc-100">
                    {phraseRoutineStatus(filterStatus)}
                    <button
                      type="button"
                      className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                      aria-label="Quitar filtro estado"
                      onClick={() => setFilterStatus('')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
                {filterExpiry && (
                  <span className="inline-flex h-10 items-center gap-1.5 rounded-md border border-status-expiring/35 bg-status-expiring/8 px-2.5 text-xs font-medium text-status-expiring">
                    {filterExpiry === 'pronto' ? 'Vence ≤14 días' : 'Período vencido'}
                    <button
                      type="button"
                      className="opacity-80 hover:opacity-100"
                      aria-label="Quitar filtro período"
                      onClick={() => setFilterExpiry('')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}

                <Button
                  type="button"
                  variant="gradientPrimary"
                  title="Nueva rutina"
                  onClick={openNewRoutineModal}
                  icon={<Plus className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2.25} aria-hidden />}
                >
                  Nueva rutina
                </Button>
              </div>
            </div>

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
                <div className="flex flex-col gap-2 border-b border-surface-border/70 bg-surface-elevated/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold tracking-tight text-ink-primary">Listado</h2>
                    <p className="truncate text-[11px] text-ink-muted">
                      {ROUTINE_SORT_SUBTITLE[tableSort]}
                      {search.trim() ? ` · texto “${search.trim()}”` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="inline-flex items-center rounded-full border border-surface-border/70 bg-surface-card px-2.5 py-1 text-[11px] font-semibold tabular-nums text-ink-secondary">
                      {filteredSorted.length === 1 ? '1 rutina' : `${filteredSorted.length} rutinas`}
                    </span>
                    {filterActiveCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setFilterLevel('')
                          setFilterStatus('')
                          setFilterExpiry('')
                        }}
                        className="text-[11px] font-medium text-ink-muted underline-offset-4 hover:text-ink-primary hover:underline"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-[min(72vh,40rem)] overflow-auto">
                  <table className="w-full min-w-[980px] border-collapse text-[13px] leading-snug">
                    <thead className="sticky top-0 z-[1] border-b border-surface-border/70 bg-surface-card/92 backdrop-blur-md">
                      <tr className="text-left">
                        <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-5">Rutina</th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-5">Alumno</th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-5">Período</th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-5">Nivel</th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-5">Estado</th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-5">Vence</th>
                        <th className="whitespace-nowrap px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-5">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border/70 bg-surface-card">
                      {filteredSorted.map((r, rowIndex) => {
                        const ci = strColorIdx(r.student?.full_name ?? r.id)
                        const colors = ROUTINE_COLORS[ci]
                        return (
                        <tr
                          key={r.id}
                          style={tableRowEnterStyle(rowIndex)}
                          className="cursor-pointer transition-colors hover:bg-surface-elevated/35"
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
                                    <span className="break-words font-semibold leading-snug tracking-tight text-ink-primary">{r.name}</span>
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
                              'hh-row-drop-in max-w-[13rem] px-4 py-2.5 text-[13px] font-normal text-ink-secondary sm:max-w-[15rem] sm:px-5',
                            )}
                            title={r.student?.full_name ?? undefined}
                          >
                            <div className="flex items-center gap-2">
                              {(() => {
                                const photoUrl = studentAvatarPublicUrl((r.student as RoutineWithStudent['student'])?.avatar_path ?? null)
                                return photoUrl ? (
                                  <img
                                    src={photoUrl}
                                    alt={r.student?.full_name ?? ''}
                                    className="h-6 w-6 shrink-0 rounded-md border border-surface-border object-cover"
                                  />
                                ) : (
                                  <div className={cn('flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold shrink-0', colors.avatar)}>
                                    {(r.student?.full_name ?? '?').charAt(0).toUpperCase()}
                                  </div>
                                )
                              })()}
                              <span className="truncate">{r.student?.full_name ?? '—'}</span>
                            </div>
                          </td>
                          <td className={cn('hh-row-drop-in whitespace-nowrap px-4 py-2.5 text-xs text-ink-muted sm:px-5')}>
                            {formatDate(r.start_date)} → {formatDate(r.end_date)}
                          </td>
                          <td className={cn('hh-row-drop-in px-4 py-2.5 sm:px-5')}>
                            <Badge status={r.level} />
                          </td>
                          <td className={cn('hh-row-drop-in px-4 py-2.5 sm:px-5')}>
                            <span className={routineStatusBadgeClass(r.status)}>{phraseRoutineStatus(r.status)}</span>
                          </td>
                          <td className={cn('hh-row-drop-in px-4 py-2.5 sm:px-5')}>
                            <RoutineDaysChip endDate={r.end_date} />
                          </td>
                          <td className={cn('hh-row-drop-in px-4 py-2.5 sm:px-5')}>
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
        onCreated={(id) => navigate(`/routines/${id}`)}
        initialStudentId={searchParams.get('student') ?? undefined}
        initialBlueprintId={searchParams.get('blueprint') ?? undefined}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="¿Eliminar rutina?"
        description={`Se eliminarán todos los bloques, días y ejercicios de "${deleteTarget?.name}". Esta acción no se puede deshacer.`}
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
              className="w-full rounded-xl border border-surface-inputBorder bg-surface-input px-3 py-2.5 text-sm text-ink-primary"
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
