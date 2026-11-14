import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { appFocusRingClassName } from '@/lib/appFocusRingClasses'
import { rowLinkClick } from '@/lib/rowLink'
import { Link, useSearchParams } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { StudentDetailView } from './StudentDetailPage'
import {
  Plus,
  Search,
  Users,
  Pencil,
  Trash2,
  ChevronDown,
  Filter,
  Dumbbell,
  X,
  Download,
  Tag,
  ArrowDownUp,
  Utensils,
  ChevronRight,
  MoreHorizontal,
  Archive,
  LayoutGrid,
  List,
} from 'lucide-react'
import { useStudents } from '@/hooks/useStudents'
import { fetchCurrentAssignmentsForStudents, PAYMENT_STATUS_LABELS, effectivePaymentStatus } from '@/lib/studentPlanAssignments'
import type { PlanAssignmentPaymentStatus } from '@/types/database'
import type { StudentPlanAssignment } from '@/types/database'
import { StudentTagChips } from '@/components/students/StudentTagChips'
import { studentTrainerTags } from '@/lib/students/studentTrainerPrefs'
import { Header } from '@/components/layout/Header'
import { SegmentedV2 } from '@/components/v2/ui'
import { IS_V2 } from '@/lib/uiVersion'
import { AdvisoriesSectionNav } from '@/components/layout/AdvisoriesSectionNav'
import { WomenCycleOverview } from '@/components/students/WomenCycleOverview'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Tooltip } from '@/components/ui/Tooltip'
import { Popover } from '@/components/ui/Popover'
import { cn } from '@/lib/utils'
import { useSlashSearchFocus } from '@/hooks/useSlashSearchFocus'
import { tableRowEnterStyle } from '@/lib/tableRowEnterAnimation'
import { Button } from '@/components/ui/Button'
import {
  directoryFilterChipClassName,
  directoryPopoverDividerClassName,
  directoryToolbarBtnClassName,
} from '@/lib/primaryGradientCtaClasses'
import { Input } from '@/components/ui/Input'
import { DirectoryPageShell } from '@/components/directory/DirectoryPageShell'
import { StudentAvatar } from '@/components/students/StudentAvatar'
import { StudentCardsV2 } from './StudentCardsV2'
import { RoutineWeekSquares } from '@/components/checkIn/RoutineWeekSquares'
import { loadBlockCountsByRoutine, loadWeekStatusByOwner, weekStatusOrEmpty } from '@/lib/checkIn/routineWeekProgress'
import { loadRmTestWeeksByOwner, RM_TEST_EVERY_WEEKS } from '@/lib/checkIn/rmTestReminder'
import type { LatestWeekStatus } from '@/lib/checkIn/latestWeekStatus'
import { NewStudentModal } from '@/components/students/NewStudentModal'
import { StudentDeletionHistoryPanel } from '@/components/students/StudentDeletionHistoryPanel'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { TableSkeleton } from '@/components/ui/Skeleton'
import toast from 'react-hot-toast'
import type { Student, StudentStatus } from '@/types/database'
import { SegmentedControl } from '@/components/ui/SegmentedControl'

const LEVEL_LABELS: Record<string, string> = {
  inicial: 'Inicial',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null
  const today = new Date()
  const bd = new Date(birthDate + 'T00:00:00')
  let age = today.getFullYear() - bd.getFullYear()
  const m = today.getMonth() - bd.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--
  return age >= 0 && age < 120 ? age : null
}

const STATUS_OPTIONS: { value: StudentStatus; label: string }[] = [
  { value: 'activo',   label: 'Activo' },
  { value: 'inactivo', label: 'Inactivo' },
  { value: 'pausado',  label: 'Pausado' },
  { value: 'baja',     label: 'Baja' },
]

/** Días que faltan para `dateStr` (negativo si ya venció). */
function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(dateStr + 'T00:00:00')
  return Math.round((end.getTime() - today.getTime()) / 86_400_000)
}

function PlanDaysChip({ date, remainingWeeks }: { date: string; remainingWeeks?: number }) {
  const days = daysUntil(date)
  const pill =
    'inline-flex items-center rounded px-2 py-0.5 text-2xs font-medium border border-black/[0.06] whitespace-nowrap dark:border-white/[0.08]'

  if (remainingWeeks != null && remainingWeeks > 0) {
    return (
      <span className={cn(pill, 'border-surface-border bg-surface-elevated text-ink-secondary')}>
        {remainingWeeks === 1 ? 'Última semana' : `${remainingWeeks} sem.`}
      </span>
    )
  }

  if (days < 0) {
    return <span className={cn(pill, 'border-status-expired/25 bg-status-expired/8 text-status-expired')}>Vencido</span>
  }
  if (days === 0) {
    return <span className={cn(pill, 'border-status-expiring/30 bg-status-expiring/10 text-status-expiring')}>Vence hoy</span>
  }
  if (days <= 7) {
    return (
      <span className={cn(pill, 'border-status-expiring/25 bg-status-expiring/8 text-status-expiring')}>
        {days} {days === 1 ? 'día' : 'días'}
      </span>
    )
  }
  return (
    <span className={cn(pill, 'border-surface-border bg-surface-elevated text-ink-secondary')}>
      {days} días
    </span>
  )
}

/** Badge clicable con dropdown para cambiar el estado del alumno. */
function StatusToggle({
  student,
  onChanged,
  remainingWeeks,
  hidePlanDays = false,
}: {
  student: Student
  onChanged: (id: string, status: StudentStatus) => void
  remainingWeeks?: number
  /** Con rutina en curso el avance lo muestra la columna Semana: no repetir fechas ni semanas. */
  hidePlanDays?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function changeStatus(next: StudentStatus) {
    if (next === student.status) { setOpen(false); return }
    setBusy(true)
    const { error } = await supabase
      .from('students')
      .update({ status: next })
      .eq('id', student.id)
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success('Estado actualizado')
    onChanged(student.id, next)
    setOpen(false)
  }

  return (
    <div className="relative inline-flex items-center gap-2">
      <Popover
        open={open}
        onOpenChange={(next) => setOpen(next)}
        className="w-36"
        trigger={({ ref, onClick, ...a11y }) => (
          <button
            ref={ref}
            type="button"
            disabled={busy}
            onClick={onClick}
            className="-mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-surface-elevated"
            title="Cambiar estado"
            {...a11y}
          >
            {IS_V2 ? (
              // v2: «Activo» es lo normal y va en gris; solo resalta lo que no lo es.
              <span className={cn('inline-flex items-center gap-1.5 text-xs', student.status === 'activo' ? 'text-ink-secondary' : 'font-medium text-ink-primary')}>
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    student.status === 'activo' ? 'bg-status-ok' : student.status === 'pausado' ? 'bg-status-pending' : student.status === 'baja' ? 'bg-status-expired' : 'bg-ink-muted',
                  )}
                  aria-hidden
                />
                {STATUS_OPTIONS.find((o) => o.value === student.status)?.label ?? student.status}
              </span>
            ) : (
              <Badge status={student.status} />
            )}
            <ChevronDown className={cn('h-3 w-3 shrink-0 text-ink-muted', IS_V2 && 'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100')} />
          </button>
        )}
      >
        <div className="py-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => void changeStatus(opt.value)}
              className={cn(
                'w-full px-3 py-2.5 text-left text-xs font-medium transition-colors hover:bg-surface-elevated',
                opt.value === student.status
                  ? 'bg-slate-500/15 text-ink-primary dark:bg-slate-400/14'
                  : 'text-ink-secondary',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Popover>
      {student.plan_end_date && !hidePlanDays && (
        <PlanDaysChip date={student.plan_end_date} remainingWeeks={remainingWeeks} />
      )}
    </div>
  )
}

type LevelFilter  = '' | 'inicial' | 'intermedio' | 'avanzado'
type StatusFilter = '' | StudentStatus
type ExpiryFilter = '' | 'pronto' | 'vencido'

/** Opciones de orden de la tabla (botón neutro tipo Gray UI). */
type TableSort = 'recommended' | 'name_asc' | 'name_desc' | 'plan_asc' | 'plan_desc' | 'weeks_left'

const TABLE_SORT_OPTS: { value: TableSort; label: string }[] = [
  { value: 'weeks_left', label: 'Por terminar rutina · primero' },
  { value: 'recommended', label: 'Activos primero, luego nombre (A→Z)' },
  { value: 'name_asc', label: 'Nombre · A→Z' },
  { value: 'name_desc', label: 'Nombre · Z→A' },
  { value: 'plan_asc', label: 'Vencimiento plan · más próximo' },
  { value: 'plan_desc', label: 'Vencimiento plan · más lejano' },
]

/** Texto corto bajo el título del listado. */
const SORT_SUBTITLE: Record<TableSort, string> = {
  weeks_left: 'Por terminar primero',
  recommended: 'Activos primero · A→Z',
  name_asc: 'Nombre · A→Z',
  name_desc: 'Nombre · Z→A',
  plan_asc: 'Plan · próximo primero',
  plan_desc: 'Plan · lejano primero',
}

function comparePlanEnd(a: string | null, b: string | null): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return a.localeCompare(b)
}

/** Orden estable respecto del nombre dentro de mismos valores de orden. */
function sortStudentsClone(
  list: Student[],
  sort: TableSort,
  remainingWeeks?: (studentId: string) => number,
): Student[] {
  const nameCmp = (a: Student, b: Student) => a.full_name.localeCompare(b.full_name, 'es')
  const rankActivo = (s: Student) => (s.status === 'activo' ? 0 : 1)
  const copy = [...list]
  switch (sort) {
    case 'recommended':
      copy.sort((a, b) => rankActivo(a) - rankActivo(b) || nameCmp(a, b))
      break
    case 'name_asc':
      copy.sort(nameCmp)
      break
    case 'name_desc':
      copy.sort((a, b) => nameCmp(b, a))
      break
    case 'plan_asc':
      copy.sort((a, b) => comparePlanEnd(a.plan_end_date, b.plan_end_date) || nameCmp(a, b))
      break
    case 'plan_desc':
      copy.sort((a, b) => comparePlanEnd(b.plan_end_date, a.plan_end_date) || nameCmp(a, b))
      break
    case 'weeks_left':
      copy.sort((a, b) => {
        const ra = remainingWeeks?.(a.id) ?? 99
        const rb = remainingWeeks?.(b.id) ?? 99
        return ra - rb || nameCmp(a, b)
      })
      break
    default:
      break
  }
  return copy
}

function exportStudentsCSV(students: Student[]) {
  const rows = [
    ['Nombre', 'Email', 'Teléfono', 'Nivel', 'Estado', 'Nacimiento', 'Venc. Plan'],
    ...students.map((s) => [
      s.full_name,
      s.email ?? '',
      s.phone ?? '',
      LEVEL_LABELS[s.level] ?? s.level,
      s.status,
      s.birth_date ?? '',
      s.plan_end_date ?? '',
    ]),
  ]
  const csv  = 'sep=;\n' + rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `alumnos_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ─── FiltersDropdown ──────────────────────────────────────────────────────────
function FiltersDropdown({
  filterLevel, setFilterLevel,
  filterStatus, setFilterStatus,
  filterExpiry, setFilterExpiry,
  filterTag, setFilterTag, allTags,
  filterGender, setFilterGender,
}: {
  filterLevel: LevelFilter
  setFilterLevel: (v: LevelFilter) => void
  filterStatus: StatusFilter
  setFilterStatus: (v: StatusFilter) => void
  filterExpiry: ExpiryFilter
  setFilterExpiry: (v: ExpiryFilter) => void
  filterTag: string
  setFilterTag: (v: string) => void
  allTags: string[]
  /** Solo v2: el filtro por sexo vive acá en vez de pestañas aparte. */
  filterGender?: '' | 'F' | 'M'
  setFilterGender?: (v: '' | 'F' | 'M') => void
}) {
  const [open, setOpen] = useState(false)
  const activeCount =
    (filterLevel ? 1 : 0) + (filterStatus ? 1 : 0) + (filterExpiry ? 1 : 0) + (filterTag ? 1 : 0) + (filterGender ? 1 : 0)

  return (
    <div className="relative inline-flex shrink-0">
      <Popover
        open={open}
        onOpenChange={setOpen}
        className="w-56 p-3 space-y-2.5"
        trigger={({ ref, onClick, ...a11y }) => (
          <button
            ref={ref}
            type="button"
            onClick={onClick}
            className={cn(
              directoryToolbarBtnClassName,
              activeCount > 0 && 'border-brand-secondary/35 bg-brand-secondary/10 text-ink-primary',
            )}
            {...a11y}
          >
            <Filter className="h-4 w-4 opacity-70" aria-hidden />
            <span className="hidden sm:inline">Filtrar</span>
            {activeCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-brand-secondary px-1.5 text-3xs font-semibold text-white">
                {activeCount}
              </span>
            )}
            <ChevronDown className={cn('h-3 w-3 transition-transform hidden sm:inline-block', open && 'rotate-180')} />
          </button>
        )}
      >
          {/* Nivel */}
          <div>
            <p className="text-3xs text-ink-muted font-semibold mb-1.5">Nivel</p>
            {(['', 'inicial', 'intermedio', 'avanzado'] as LevelFilter[]).map((v) => (
              <button
                key={v || 'all-nivel'}
                type="button"
                onClick={() => setFilterLevel(v)}
                className={cn(
                  'w-full rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                  filterLevel === v
                    ? 'bg-slate-500/12 text-ink-primary font-medium dark:bg-slate-400/14'
                    : 'text-ink-secondary hover:bg-surface-elevated',
                )}
              >
                {v === '' ? 'Todos' : LEVEL_LABELS[v]}
              </button>
            ))}
          </div>

          <div className={directoryPopoverDividerClassName}>
            <p className="text-3xs text-ink-muted font-semibold mb-1.5">Estado</p>
            {([{ value: '' as StatusFilter, label: 'Todos' }, ...STATUS_OPTIONS]).map((opt) => (
              <button
                key={opt.value || 'all-status'}
                type="button"
                onClick={() => setFilterStatus(opt.value)}
                className={cn(
                  'w-full rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                  filterStatus === opt.value
                    ? 'bg-slate-500/12 text-ink-primary font-medium dark:bg-slate-400/14'
                    : 'text-ink-secondary hover:bg-surface-elevated',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* v2: el vencimiento del plan ya está en las pastillas de arriba. */}
          {setFilterGender ? null : (
          <div className={directoryPopoverDividerClassName}>
            <p className="text-3xs text-ink-muted font-semibold mb-1.5">Plan</p>
            {([
              { value: '' as ExpiryFilter, label: 'Todos' },
              { value: 'pronto' as ExpiryFilter, label: 'Vence en ≤14 días' },
              { value: 'vencido' as ExpiryFilter, label: 'Plan vencido' },
            ]).map((opt) => (
              <button
                key={opt.value || 'all-expiry'}
                type="button"
                onClick={() => setFilterExpiry(opt.value)}
                className={cn(
                  'w-full rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                  filterExpiry === opt.value
                    ? 'bg-slate-500/12 text-ink-primary font-medium dark:bg-slate-400/14'
                    : 'text-ink-secondary hover:bg-surface-elevated',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          )}

          {setFilterGender ? (
            <div className={directoryPopoverDividerClassName}>
              <p className="text-3xs text-ink-muted font-semibold mb-1.5">Sexo</p>
              {([{ value: '' as const, label: 'Todos' }, { value: 'F' as const, label: 'Mujeres' }, { value: 'M' as const, label: 'Hombres' }]).map((opt) => (
                <button
                  key={opt.value || 'all-gender'}
                  type="button"
                  onClick={() => setFilterGender(opt.value)}
                  className={cn(
                    'w-full rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                    filterGender === opt.value
                      ? 'bg-slate-500/12 text-ink-primary font-medium dark:bg-slate-400/14'
                      : 'text-ink-secondary hover:bg-surface-elevated',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}

          {allTags.length > 0 && (
            <div className={directoryPopoverDividerClassName}>
              <p className="text-3xs text-ink-muted font-semibold mb-1.5">Etiqueta</p>
              {(['', ...allTags]).map((t) => (
                <button
                  key={t || 'all-tag'}
                  type="button"
                  onClick={() => setFilterTag(t)}
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                    filterTag === t
                      ? 'bg-slate-500/12 text-ink-primary font-medium dark:bg-slate-400/14'
                      : 'text-ink-secondary hover:bg-surface-elevated',
                  )}
                >
                  {t ? <><Tag className="h-3 w-3 shrink-0" />{t}</> : 'Todas'}
                </button>
              ))}
            </div>
          )}

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => { setFilterLevel(''); setFilterStatus(''); setFilterExpiry(''); setFilterTag(''); setFilterGender?.(''); setOpen(false) }}
              className={cn('w-full flex items-center justify-center gap-1 text-xs text-ink-muted transition-colors hover:text-status-expired', directoryPopoverDividerClassName)}
            >
              <X className="h-3 w-3" />
              Limpiar filtros
            </button>
          )}
      </Popover>
    </div>
  )
}

/** v2: lo que se usa poco (exportar, eliminados) queda en un menú «…». */
function MoreActionsMenu({ onExport, showDeleted, onToggleDeleted }: { onExport: () => void; showDeleted: boolean; onToggleDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const item = 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-ink-primary transition-colors hover:bg-surface-elevated'
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      className="w-52 p-1"
      trigger={({ ref, onClick, ...a11y }) => (
        <button ref={ref} type="button" onClick={onClick} className={directoryToolbarBtnClassName} title="Más acciones" aria-label="Más acciones" {...a11y}>
          <MoreHorizontal className="h-4 w-4 opacity-70" aria-hidden />
        </button>
      )}
    >
      <button type="button" className={item} onClick={() => { setOpen(false); onExport() }}>
        <Download className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
        Exportar a CSV
      </button>
      <button type="button" className={item} onClick={() => { setOpen(false); onToggleDeleted() }}>
        <Archive className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
        {showDeleted ? 'Ocultar eliminados' : 'Ver eliminados'}
      </button>
    </Popover>
  )
}

function SortDropdown({ value, onChange }: { value: TableSort; onChange: (v: TableSort) => void }) {
  const [open, setOpen] = useState(false)

  const selectedLabel =
    TABLE_SORT_OPTS.find((o) => o.value === value)?.label ?? TABLE_SORT_OPTS[0].label

  return (
    <div className="relative inline-flex shrink-0">
      <Popover
        open={open}
        onOpenChange={setOpen}
        className="min-w-[15.5rem] max-w-[min(calc(100vw-2rem),20rem)] p-2"
        trigger={({ ref, onClick, ...a11y }) => (
          <button
            ref={ref}
            type="button"
            aria-label={`Ordenar tabla. Actual: ${selectedLabel}`}
            onClick={onClick}
            title={selectedLabel}
            className={directoryToolbarBtnClassName}
            {...a11y}
          >
            <ArrowDownUp className="h-4 w-4 opacity-70" aria-hidden />
            <span className="hidden sm:inline">Ordenar</span>
            <ChevronDown className={cn('h-3 w-3 shrink-0 opacity-70 transition-transform hidden sm:inline-block', open && 'rotate-180')} />
          </button>
        )}
      >
          <p className="px-2 pb-1.5 pt-0.5 text-3xs font-semibold text-ink-muted">
            Orden de la tabla
          </p>
          {TABLE_SORT_OPTS.map((opt) => (
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
                  ? 'bg-brand-secondary/12 font-medium text-ink-primary'
                  : 'text-ink-secondary hover:bg-surface-elevated',
              )}
            >
              {opt.label}
            </button>
          ))}
      </Popover>
    </div>
  )
}

export function StudentsPage() {
  const navigate = useAppNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const role = useAuthStore((state) => state.profile?.role)
  const user = useAuthStore((state) => state.user)
  const isPsychologist = role === 'psychologist'
  const entityLabel = role === 'nutritionist' || isPsychologist ? 'Pacientes' : 'Alumnos'
  const entityLabelSingular = role === 'nutritionist' || isPsychologist ? 'paciente' : 'alumno'
  const showNewStudentModal = searchParams.get('create') === '1'

  const openNewStudentModal = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('create', '1')
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const closeNewStudentModal = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('create')
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const { students, loading, fetchStudents, filterStudents, deleteStudent } = useStudents()
  const [localStudents, setLocalStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [filterLevel,  setFilterLevel]  = useState<LevelFilter>('')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('')
  const [filterExpiry, setFilterExpiry] = useState<ExpiryFilter>('')
  const [filterTag,    setFilterTag]    = useState('')
  const [filterGender, setFilterGender] = useState<'' | 'F' | 'M'>('')

  // Enlaces del menú («Estado»): ?estado=activo|pausado y ?plan=pronto|vencido aplican el filtro y se limpian de la URL.
  useEffect(() => {
    const estado = searchParams.get('estado')
    const plan = searchParams.get('plan')
    if (!estado && !plan) return
    if (estado === 'activo' || estado === 'pausado') {
      setFilterStatus(estado)
      setFilterExpiry('')
    }
    if (plan === 'pronto' || plan === 'vencido') {
      setFilterExpiry(plan)
      setFilterStatus('')
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('estado')
        next.delete('plan')
        return next
      },
      { replace: true },
    )
  }, [searchParams, setSearchParams])
  const [tableSort, setTableSort] = useState<TableSort>('weeks_left')
  const TABLE_PAGE_SIZE = 50
  const [tableVisibleCount, setTableVisibleCount] = useState(TABLE_PAGE_SIZE)
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [activeRoutineStudentIds, setActiveRoutineStudentIds] = useState<Set<string>>(new Set())
  const [weekByStudent, setWeekByStudent] = useState<Map<string, LatestWeekStatus>>(() => new Map())
  // v2: la lista se ve en tarjetas (con color) o en tabla; se recuerda en este navegador.
  const [listView, setListView] = useState<'cards' | 'table'>(() => {
    try {
      return localStorage.getItem('hh-students-view') === 'table' ? 'table' : 'cards'
    } catch {
      return 'cards'
    }
  })
  const chooseListView = (v: 'cards' | 'table') => {
    setListView(v)
    try {
      localStorage.setItem('hh-students-view', v)
    } catch {
      /* sin storage: dura hasta recargar */
    }
  }
  const [weeksByStudent, setWeeksByStudent] = useState<Map<string, number>>(() => new Map())
  const [rmTestDueIds, setRmTestDueIds] = useState<Set<string>>(() => new Set())
  const [hasMealPlanStudentIds, setHasMealPlanStudentIds] = useState<Set<string>>(new Set())
  const [currentPlanByStudent, setCurrentPlanByStudent] = useState<Record<string, import('@/types/database').StudentPlanAssignment>>({})
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const studentPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchStudents()
    if (!user) return
    void loadRmTestWeeksByOwner(user.id)
      .then((rows) => setRmTestDueIds(new Set(rows.filter((r) => r.weeks >= RM_TEST_EVERY_WEEKS).map((r) => r.id))))
      .catch(() => setRmTestDueIds(new Set()))
    supabase
      .from('routines')
      .select('id, student_id, status')
      .eq('owner_id', user.id)
      .in('status', ['activa', 'por_vencer'])
      .not('student_id', 'is', null)
      .order('updated_at', { ascending: false })
      .then(async ({ data }) => {
        const ids = new Set<string>()
        const routineOfStudent = new Map<string, string>()
        for (const r of data ?? []) {
          const sid = r.student_id as string
          ids.add(sid)
          if (!routineOfStudent.has(sid)) routineOfStudent.set(sid, r.id as string)
        }
        setActiveRoutineStudentIds(ids)
        const [weekMap, blockCounts] = await Promise.all([
          loadWeekStatusByOwner(user.id),
          loadBlockCountsByRoutine([...routineOfStudent.values()]),
        ])
        setWeekByStudent(weekMap)
        const weeks = new Map<string, number>()
        for (const [sid, rid] of routineOfStudent) weeks.set(sid, blockCounts.get(rid) ?? 0)
        setWeeksByStudent(weeks)
      })
  }, [fetchStudents, user])

  useEffect(() => {
    if (students.length === 0) {
      setCurrentPlanByStudent({})
      return
    }
    let cancelled = false
    void (async () => {
      const map = await fetchCurrentAssignmentsForStudents(students.map((s) => s.id))
      if (!cancelled) setCurrentPlanByStudent(map)
    })()
    return () => { cancelled = true }
  }, [students])

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      // Entrenador/admin: planes en `trainer_student_meal_plans`
      if (role === 'trainer' || role === 'admin') {
        const { data } = await supabase
          .from('trainer_student_meal_plans')
          .select('student_id')
          .eq('owner_id', user.id)
        if (cancelled) return
        setHasMealPlanStudentIds(new Set((data ?? []).map((r) => r.student_id as string)))
        return
      }
      // Nutricionista: plan activo en `nutrition_patient_plan_versions`
      if (role === 'nutritionist') {
        const { data } = await supabase
          .from('nutrition_patient_plan_versions')
          .select('student_id')
          .eq('owner_id', user.id)
          .eq('is_active', true)
        if (cancelled) return
        setHasMealPlanStudentIds(new Set((data ?? []).map((r) => r.student_id as string)))
        return
      }
      setHasMealPlanStudentIds(new Set())
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, role])

  useSlashSearchFocus(searchRef)

  useEffect(() => {
    if (!selectedStudentId) return
    const id = window.requestAnimationFrame(() => {
      studentPanelRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(id)
  }, [selectedStudentId])

  useEffect(() => {
    if (!selectedStudentId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedStudentId(null)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [selectedStudentId])

  useEffect(() => { setLocalStudents(students) }, [students])

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value)
      filterStudents(value)
    },
    [filterStudents]
  )

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const removedId = deleteTarget.id
    const ok = await deleteStudent(removedId)
    setDeleting(false)
    if (ok) {
      setDeleteTarget(null)
      setSelectedStudentId((cur) => (cur === removedId ? null : cur))
      fetchStudents(search)
    }
  }

  // Actualización optimista del estado sin refetch
  function handleStatusChanged(id: string, status: StudentStatus) {
    setLocalStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    )
  }

  /** Sincroniza cambios desde el panel lateral (tags, prefs, etc.) sin refetch. */
  function handleStudentPatch(patch: Partial<Student> & { id: string }) {
    setLocalStudents((prev) =>
      prev.map((s) => (s.id === patch.id ? { ...s, ...patch } : s)),
    )
  }

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const s of localStudents) {
      studentTrainerTags(s).forEach((t) => tagSet.add(t))
    }
    return Array.from(tagSet).sort()
  }, [localStudents])

  const filtered = useMemo(() => localStudents.filter((s) => {
    if (filterLevel  && s.level  !== filterLevel)  return false
    if (filterStatus && s.status !== filterStatus) return false
    if (filterExpiry) {
      if (!s.plan_end_date) return false
      const d = daysUntil(s.plan_end_date)
      if (filterExpiry === 'pronto'  && !(d >= 0 && d <= 14)) return false
      if (filterExpiry === 'vencido' && d >= 0)               return false
    }
    if (filterTag && !studentTrainerTags(s).includes(filterTag)) return false
    if (filterGender === 'F' && s.gender !== 'F') return false
    if (filterGender === 'M' && s.gender !== 'M') return false
    return true
  }), [localStudents, filterLevel, filterStatus, filterExpiry, filterTag, filterGender])

  const v2Summary = useMemo(() => {
    let activos = 0
    let pausados = 0
    let pronto = 0
    let vencido = 0
    for (const s of localStudents) {
      if (s.status === 'activo') activos++
      if (s.status === 'pausado') pausados++
      if (s.plan_end_date) {
        const d = daysUntil(s.plan_end_date)
        if (d >= 0 && d <= 14) pronto++
        else if (d < 0) vencido++
      }
    }
    return { total: localStudents.length, activos, pausados, pronto, vencido }
  }, [localStudents])
  const [showDeleted, setShowDeleted] = useState(false)

  /** v2: un solo selector rápido para estado y vencimiento del plan. */
  type Quick = 'all' | 'activo' | 'pausado' | 'pronto' | 'vencido'
  const quick: Quick = filterExpiry || (filterStatus === 'activo' || filterStatus === 'pausado' ? filterStatus : 'all')
  const setQuick = (q: Quick) => {
    const next: Quick = q === quick ? 'all' : q
    setFilterStatus(next === 'activo' || next === 'pausado' ? next : '')
    setFilterExpiry(next === 'pronto' || next === 'vencido' ? next : '')
  }
  const quickOptions = (
    [
      { value: 'all' as Quick, label: 'Todos', count: v2Summary.total },
      { value: 'activo' as Quick, label: 'Activos', count: v2Summary.activos },
      { value: 'pausado' as Quick, label: 'Pausados', count: v2Summary.pausados },
      { value: 'pronto' as Quick, label: 'Por vencer', count: v2Summary.pronto },
      { value: 'vencido' as Quick, label: 'Vencidos', count: v2Summary.vencido },
    ]
  ).filter((o) => o.value === 'all' || o.count > 0 || o.value === quick)

  const newStudentButton = (
    <Button
      type="button"
      variant="gradientSecondary"
      size={IS_V2 ? 'sm' : 'md'}
      onClick={openNewStudentModal}
      title={role === 'nutritionist' ? 'Nuevo paciente' : 'Nuevo alumno'}
      icon={<Plus className={IS_V2 ? 'h-3.5 w-3.5 shrink-0' : 'h-4 w-4 shrink-0'} strokeWidth={2.25} aria-hidden />}
    >
      {role === 'nutritionist' ? 'Nuevo paciente' : 'Nuevo alumno'}
    </Button>
  )

  const remainingWeeksOf = useCallback((studentId: string) => {
    const total = weeksByStudent.get(studentId) ?? 0
    const st = weekByStudent.get(studentId)
    if (st?.finished) return 0
    if (st?.lastWeek) return 1
    if (!total) return 99
    const current = st?.weekNumber ?? 0
    return Math.max(0, total - current)
  }, [weekByStudent, weeksByStudent])

  const sortedForTable = useMemo(
    () => sortStudentsClone(filtered, tableSort, remainingWeeksOf),
    [filtered, tableSort, remainingWeeksOf],
  )

  const visibleForTable = useMemo(
    () => sortedForTable.slice(0, tableVisibleCount),
    [sortedForTable, tableVisibleCount],
  )

  useEffect(() => {
    setTableVisibleCount(TABLE_PAGE_SIZE)
  }, [search, filterLevel, filterStatus, filterExpiry, filterTag, filterGender, tableSort])

  return (
    <div>
      <Header title={entityLabel} actions={IS_V2 ? newStudentButton : undefined} />

      <DirectoryPageShell>
        <AdvisoriesSectionNav />
        {filterGender === 'F' ? (
          <WomenCycleOverview students={filtered} weekByStudent={weekByStudent} />
        ) : null}
        {IS_V2 ? (
          <>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="min-w-0 lg:w-56 lg:shrink-0">
                <Input
                  ref={searchRef}
                  type="search"
                  placeholder={`Buscar ${entityLabelSingular}…`}
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={`Buscar ${entityLabelSingular}`}
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                />
              </div>
              {/* En pantallas medianas los filtros rápidos se deslizan, para que el buscador no quede aplastado. */}
              <div className="-mx-4 overflow-x-auto px-4 scrollbar-hide lg:mx-0 lg:min-w-0 lg:flex-1 lg:px-0 [&>div]:flex-nowrap">
                <SegmentedV2 value={quick} onChange={setQuick} options={quickOptions} />
              </div>
              <div className="flex items-center gap-2 lg:ml-auto">
                <FiltersDropdown
                  filterLevel={filterLevel}
                  setFilterLevel={setFilterLevel}
                  filterStatus={filterStatus}
                  setFilterStatus={setFilterStatus}
                  filterExpiry={filterExpiry}
                  setFilterExpiry={setFilterExpiry}
                  filterTag={filterTag}
                  setFilterTag={setFilterTag}
                  allTags={allTags}
                  filterGender={filterGender}
                  setFilterGender={setFilterGender}
                />
                <div className="hidden gap-1 sm:inline-flex" role="group" aria-label="Vista">
                  <Button type="button" size="iconSm" variant={listView === 'cards' ? 'secondary' : 'ghost'} aria-label="Ver en tarjetas" aria-pressed={listView === 'cards'} onClick={() => chooseListView('cards')}>
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="iconSm" variant={listView === 'table' ? 'secondary' : 'ghost'} aria-label="Ver en tabla" aria-pressed={listView === 'table'} onClick={() => chooseListView('table')}>
                    <List className="h-4 w-4" />
                  </Button>
                </div>
                <SortDropdown value={tableSort} onChange={setTableSort} />
                <MoreActionsMenu
                  onExport={() => exportStudentsCSV(filtered)}
                  showDeleted={showDeleted}
                  onToggleDeleted={() => setShowDeleted((v) => !v)}
                />
              </div>
            </div>
            {filterLevel || filterTag || filterGender ? (
              <div className="flex flex-wrap items-center gap-2">
                {filterLevel ? (
                  <span className={directoryFilterChipClassName}>
                    {LEVEL_LABELS[filterLevel]}
                    <Button variant="ghost" size="iconSm" type="button" className="-m-1.5 text-ink-muted" onClick={() => setFilterLevel('')} aria-label="Quitar filtro nivel">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                ) : null}
                {filterGender ? (
                  <span className={directoryFilterChipClassName}>
                    {filterGender === 'F' ? 'Mujeres' : 'Hombres'}
                    <Button variant="ghost" size="iconSm" type="button" className="-m-1.5 text-ink-muted" onClick={() => setFilterGender('')} aria-label="Quitar filtro sexo">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                ) : null}
                {filterTag ? (
                  <span className={directoryFilterChipClassName}>
                    <Tag className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                    {filterTag}
                    <Button variant="ghost" size="iconSm" type="button" className="-m-1.5 text-ink-muted" onClick={() => setFilterTag('')} aria-label="Quitar etiqueta">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
        <>
        <SegmentedControl
          size="sm"
          ariaLabel="Filtrar por sexo"
          value={filterGender || 'all'}
          onChange={(id) => setFilterGender(id === 'all' ? '' : (id as 'F' | 'M'))}
          items={[
            { id: 'all', label: 'Todos' },
            { id: 'F', label: 'Mujeres' },
            { id: 'M', label: 'Hombres' },
          ]}
        />
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
          <div className="min-w-0 flex-1 max-w-xl">
            <Input
              ref={searchRef}
              type="search"
              placeholder={`Buscar ${entityLabelSingular} por nombre o email…`}
              autoComplete="off"
              spellCheck={false}
              aria-label={`Buscar ${entityLabelSingular}`}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end md:gap-2">
            <button
              type="button"
              onClick={() => exportStudentsCSV(filtered)}
              title="Exportar lista a CSV"
              aria-label="Exportar lista a CSV"
              className={cn(directoryToolbarBtnClassName, 'hidden sm:inline-flex')}
            >
              <Download className="h-4 w-4 opacity-70" aria-hidden />
              <span className="hidden sm:inline">Exportar</span>
            </button>

            <FiltersDropdown
              filterLevel={filterLevel}
              setFilterLevel={setFilterLevel}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              filterExpiry={filterExpiry}
              setFilterExpiry={setFilterExpiry}
              filterTag={filterTag}
              setFilterTag={setFilterTag}
              allTags={allTags}
            />

            <SortDropdown value={tableSort} onChange={setTableSort} />

            {filterLevel && (
              <span className={directoryFilterChipClassName}>
                {LEVEL_LABELS[filterLevel]}
                <Button variant="ghost" size="iconSm" type="button" className="-m-1.5 text-ink-muted" onClick={() => setFilterLevel('')} aria-label="Quitar filtro nivel">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </span>
            )}
            {filterStatus && (
              <span className={directoryFilterChipClassName}>
                {STATUS_OPTIONS.find((o) => o.value === filterStatus)?.label}
                <Button variant="ghost" size="iconSm" type="button" className="-m-1.5 text-ink-muted" onClick={() => setFilterStatus('')} aria-label="Quitar filtro estado">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </span>
            )}
            {filterExpiry && (
              <span className="inline-flex h-10 items-center gap-1.5 rounded-md border border-status-expiring/30 bg-status-expiring/8 px-2.5 text-xs font-medium text-status-expiring">
                {filterExpiry === 'pronto' ? 'Vence pronto' : 'Plan vencido'}
                <button type="button" className="opacity-70 hover:opacity-100" onClick={() => setFilterExpiry('')} aria-label="Quitar filtro plan">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            {filterTag && (
              <span className={directoryFilterChipClassName}>
                <Tag className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                {filterTag}
                <Button variant="ghost" size="iconSm" type="button" className="-m-1.5 text-ink-muted" onClick={() => setFilterTag('')} aria-label="Quitar etiqueta">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </span>
            )}

            {newStudentButton}
          </div>
        </div>
        </>
        )}

        <StudentDeletionHistoryPanel
          controlledOpen={IS_V2 ? showDeleted : undefined}
          entityLabel={entityLabel}
          entityLabelSingular={entityLabelSingular}
          entityLabelColumn={role === 'nutritionist' ? 'Paciente' : 'Alumno'}
          onRestored={() => void fetchStudents(search)}
        />

        {loading ? (
          <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card p-4">
            <div className="mb-4 h-4 w-32 animate-pulse rounded bg-surface-elevated" />
            <TableSkeleton rows={6} cols={5} />
          </div>
        ) : localStudents.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title={`No hay ${entityLabelSingular}s todavía`}
            description={`Creá tu primer ${entityLabelSingular} para comenzar a gestionar rutinas y planes.`}
            action={{
              label: `Nuevo ${entityLabelSingular}`,
              onClick: openNewStudentModal,
              icon: <Plus className="h-4 w-4" />,
            }}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Filter className="h-8 w-8" />}
            title="Sin resultados para los filtros"
            description="Probá con otros filtros o limpiá la selección."
          />
        ) : (
          <>
            {IS_V2 && listView === 'cards' ? (
              <StudentCardsV2
                students={visibleForTable}
                selectedStudentId={selectedStudentId}
                onOpen={(studentId) => setSelectedStudentId(studentId)}
                onAvatarUpdated={() => { void fetchStudents(search) }}
                activeRoutineStudentIds={activeRoutineStudentIds}
                weekByStudent={weekByStudent}
                weeksByStudent={weeksByStudent}
                rmTestDueIds={rmTestDueIds}
                currentPlanByStudent={currentPlanByStudent}
              />
            ) : (
            <StudentDirectoryTable
              entityLabel={entityLabel}
              entityLabelColumn={role === 'nutritionist' ? 'Paciente' : 'Alumno'}
              sortSubtitle={SORT_SUBTITLE[tableSort]}
              students={visibleForTable}
              selectedStudentId={selectedStudentId}
              onAvatarUpdated={() => { void fetchStudents(search) }}
              activeRoutineStudentIds={activeRoutineStudentIds}
              weekByStudent={weekByStudent}
              weeksByStudent={weeksByStudent}
              rmTestDueIds={rmTestDueIds}
              hasMealPlanStudentIds={hasMealPlanStudentIds}
              currentPlanByStudent={currentPlanByStudent}
              onRowClick={(studentId) => setSelectedStudentId(studentId)}
              onEdit={(id) => navigate(`/students/${id}/edit`)}
              onDelete={(s) => setDeleteTarget(s)}
              onStatusChanged={handleStatusChanged}
              onFilterTag={setFilterTag}
            />
            )}
            {sortedForTable.length > tableVisibleCount ? (
              <div className="flex justify-center border-t border-surface-border/80 py-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setTableVisibleCount((n) => Math.min(n + TABLE_PAGE_SIZE, sortedForTable.length))
                  }
                >
                  Mostrar más ({sortedForTable.length - tableVisibleCount} restantes)
                </Button>
              </div>
            ) : null}
          </>
        )}
      </DirectoryPageShell>

      {selectedStudentId && (
        <>
          <button
            type="button"
            aria-label="Cerrar panel"
            className={cn(
              'fixed inset-0 z-[9990] bg-black/30 backdrop-blur-[3px] dark:bg-black/55',
              'motion-reduce:animate-none motion-safe:animate-backdrop-soft',
            )}
            onClick={() => setSelectedStudentId(null)}
          />
          <div
            ref={studentPanelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal
            aria-labelledby="student-sheet-title"
            className={cn(
              'fixed z-[9991] flex flex-col overflow-hidden border border-surface-border/85 bg-surface-panel shadow-lg dark:bg-surface-panel dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)]',
              'rounded-2xl motion-reduce:animate-none motion-safe:max-sm:animate-none motion-safe:sm:animate-panel-slide-in',
              'left-3 right-3 top-3 bottom-3 w-auto h-[calc(100dvh-1.5rem)] max-h-[calc(100dvh-1.5rem)]',
              'sm:inset-auto sm:left-auto sm:right-5 sm:top-5 sm:bottom-5 sm:h-[calc(100dvh-2.5rem)] sm:max-h-none sm:w-full sm:max-w-3xl lg:right-6 lg:top-6 lg:bottom-6',
              IS_V2 ? 'lg:max-w-5xl' : 'lg:max-w-4xl',
            )}
          >
            <StudentDetailView
              key={selectedStudentId}
              studentId={selectedStudentId}
              variant="panel"
              onClosePanel={() => setSelectedStudentId(null)}
              onStudentPatch={handleStudentPatch}
            />
          </div>
        </>
      )}

      <NewStudentModal
        open={showNewStudentModal}
        title={role === 'nutritionist' ? 'Nuevo paciente' : 'Nuevo alumno'}
        onClose={closeNewStudentModal}
        onCreated={(id) => navigate(`/students/${id}`)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        requireConfirm
        title={`¿Eliminar a ${deleteTarget?.full_name}?`}
        description={`Esta acción no se puede deshacer. Se eliminarán todos los datos asociados al ${entityLabelSingular}; sus rutinas se conservan.`}
        confirmLabel="Sí, eliminar"
        loading={deleting}
      />
    </div>
  )
}

function StudentDirectoryTable({
  entityLabel,
  entityLabelColumn,
  sortSubtitle,
  students,
  selectedStudentId,
  onAvatarUpdated,
  onRowClick,
  onEdit,
  onDelete,
  onStatusChanged,
  onFilterTag,
  activeRoutineStudentIds,
  weekByStudent,
  weeksByStudent,
  rmTestDueIds,
  hasMealPlanStudentIds,
  currentPlanByStudent,
}: {
  entityLabel: string
  entityLabelColumn: string
  sortSubtitle: string
  students: Student[]
  selectedStudentId: string | null
  onAvatarUpdated: () => void
  onRowClick: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (student: Student) => void
  onStatusChanged: (id: string, status: StudentStatus) => void
  onFilterTag?: (tag: string) => void
  activeRoutineStudentIds: Set<string>
  weekByStudent: Map<string, LatestWeekStatus>
  weeksByStudent: Map<string, number>
  /** Alumnos con 12+ semanas desde el último test de RM. */
  rmTestDueIds: Set<string>
  hasMealPlanStudentIds: Set<string>
  currentPlanByStudent: Record<string, StudentPlanAssignment>
}) {
  const iconWrapBase = 'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors'
  /** Indicador presente (color) / ausente (tenue): sin tachado, que ensuciaba la fila. */
  const indicatorClass = (on: boolean, tone: 'routine' | 'plan') =>
    cn(
      iconWrapBase,
      on
        ? tone === 'routine'
          ? 'bg-brand-primary/12 text-brand-primary ring-1 ring-inset ring-brand-primary/20'
          : 'bg-brand-tertiary/12 text-brand-tertiary ring-1 ring-inset ring-brand-tertiary/20'
        : 'text-ink-muted/35',
    )
  const tableHeader = (
    <div className="flex items-center justify-between gap-3 border-b border-surface-border/70 bg-surface-elevated/30 px-4 py-2.5 sm:py-3">
      <div className="min-w-0 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-ink-primary">{entityLabel}</h2>
        <span className="text-2xs tabular-nums text-ink-muted">
          · {students.length}
        </span>
        <span className="hidden sm:inline text-2xs text-ink-muted truncate">· {sortSubtitle}</span>
      </div>
      <span className="sm:hidden text-3xs text-ink-muted truncate">{sortSubtitle}</span>
    </div>
  )

  return (
    <section className="overflow-hidden rounded-2xl border border-surface-border/80 bg-surface-card shadow-card">
      {/* v2: la cantidad ya está en las pestañas y el orden en «Ordenar». */}
      {IS_V2 ? null : tableHeader}

      {/* ── Mobile cards (< sm) ──────────────────────────────────── */}
      <div className="sm:hidden divide-y divide-surface-border/60">
        {students.map((student, rowIndex) => {
          const isSelected = selectedStudentId === student.id
          const hasRoutine = activeRoutineStudentIds.has(student.id)
          const hasPlan = hasMealPlanStudentIds.has(student.id)
          const age = calcAge(student.birth_date ?? null)
          return (
            <div
              key={student.id}
              onClick={() => onRowClick(student.id)}
              style={tableRowEnterStyle(rowIndex)}
              className={cn(
                'hh-row-drop-in flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors active:bg-surface-elevated/50',
                'outline-none focus-within:bg-surface-elevated/35',
                isSelected ? 'bg-surface-elevated/50 border-l-[3px] border-l-brand-primary' : 'hover:bg-surface-elevated/30 border-l-[3px] border-l-transparent',
              )}
            >
              <StudentAvatar
                studentId={student.id}
                fullName={student.full_name}
                avatarPath={student.avatar_path ?? null}
                size="sm"
                stopRowNavigation
                onPathChange={() => onAvatarUpdated()}
              />
              <div className="min-w-0 flex-1">
                {/* 1: nombre · 2: estado + rutina · 3: nivel, edad, plan y etiquetas. Editar/eliminar están en la ficha. */}
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug text-ink-primary">{student.full_name}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <StatusToggle student={student} onChanged={onStatusChanged} hidePlanDays={hasRoutine} />
                  {hasRoutine ? (
                    <RoutineWeekSquares
                      totalWeeks={weeksByStudent.get(student.id) ?? 0}
                      currentWeek={weekStatusOrEmpty(weekByStudent, student.id).weekNumber}
                      finished={weekStatusOrEmpty(weekByStudent, student.id).finished}
                      lastWeek={weekStatusOrEmpty(weekByStudent, student.id).lastWeek}
                    />
                  ) : (
                    <span className="text-3xs font-medium text-ink-muted">Sin rutina</span>
                  )}
                  {hasPlan ? (
                    <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-3xs font-semibold text-emerald-700 dark:text-emerald-300">
                      Plan alim.
                    </span>
                  ) : null}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-2xs text-ink-muted">
                    {LEVEL_LABELS[student.level] ?? student.level}
                    {age !== null ? ` · ${age} años` : ''}
                  </span>
                  {rmTestDueIds.has(student.id) ? (
                    <span
                      className="inline-flex items-center rounded px-1.5 py-0.5 text-3xs font-semibold bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-300"
                      title="12 semanas de rutina desde el último test de RM"
                    >
                      Testear RM
                    </span>
                  ) : null}
                  {currentPlanByStudent[student.id] ? (() => {
                    const a = currentPlanByStudent[student.id]
                    const eff = effectivePaymentStatus(a)
                    if (IS_V2) return <PlanPillV2 name={a.plan_name_snapshot} status={eff} />
                    const cls =
                      eff === 'paid' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25' :
                      eff === 'overdue' ? 'bg-red-500/15 text-red-600 dark:text-red-300 ring-red-500/25' :
                      eff === 'cancelled' ? 'bg-ink-muted/15 text-ink-secondary ring-ink-muted/25' :
                      'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/25'
                    return (
                      <span
                        title={`${a.plan_name_snapshot} · ${PAYMENT_STATUS_LABELS[eff]}`}
                        className={cn('inline-flex max-w-[140px] items-center gap-1 truncate rounded-full px-2 py-0.5 text-3xs font-semibold ring-1', cls)}
                      >
                        <span className="truncate">{a.plan_name_snapshot}</span>
                      </span>
                    )
                  })() : null}
                  <StudentTagChips student={student} maxVisible={2} onTagClick={onFilterTag} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Desktop table (≥ sm) ─────────────────────────────────── */}
      {/* v2: sin scroll interno; la lista entera baja con la página. */}
      <div className={IS_V2 ? 'hidden sm:block' : 'hidden sm:block max-h-[min(68vh,36rem)] overflow-auto'}>
        <table className="w-full border-collapse text-body-sm leading-snug hh-table">
          <thead className="sticky top-0 z-[1] border-b border-surface-border/70 bg-surface-card/92 backdrop-blur-md">
            <tr className="text-left">
              <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-3xs font-semibold text-ink-muted sm:px-5">{entityLabelColumn}</th>
              {IS_V2 ? null : <th scope="col" className="hidden whitespace-nowrap px-4 py-2.5 text-3xs font-semibold text-ink-muted sm:table-cell sm:px-5">Nivel</th>}
              <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-3xs font-semibold text-ink-muted sm:px-5">Estado</th>
              <th scope="col" className="w-[12rem] whitespace-nowrap px-4 py-2.5 text-3xs font-semibold text-ink-muted sm:px-5">{IS_V2 ? 'Rutina' : 'Semana'}</th>
              {IS_V2 ? <th scope="col" className="hidden whitespace-nowrap px-4 py-2.5 text-3xs font-semibold text-ink-muted md:table-cell sm:px-5">Plan y pago</th> : null}
              {IS_V2 ? null : <th scope="col" className="hidden whitespace-nowrap px-4 py-2.5 text-3xs font-semibold text-ink-muted lg:table-cell lg:px-5">Email</th>}
              <th scope="col" className={IS_V2 ? 'w-12' : 'w-[7rem]'} aria-hidden />
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border/70 bg-surface-card">
            {students.map((student, rowIndex) => {
              const isSelected = selectedStudentId === student.id
              const hasRoutine = activeRoutineStudentIds.has(student.id)
              const hasPlan = hasMealPlanStudentIds.has(student.id)
              const age = calcAge(student.birth_date ?? null)
              return (
                <tr
                  key={student.id}
                  onClick={() => onRowClick(student.id)}
                  style={tableRowEnterStyle(rowIndex)}
                  className={cn(
                    'group cursor-pointer align-middle transition-colors outline-none',
                    'hover:bg-surface-elevated/50 focus-within:bg-surface-elevated/50',
                    isSelected && 'bg-brand-primary/[0.05]',
                  )}
                >
                  <td
                    className={cn(
                      'hh-row-drop-in px-4 sm:px-5',
                      IS_V2 ? 'py-3' : 'py-2.5',
                      isSelected ? 'border-l-[3px] border-l-brand-primary pl-[calc(1rem-3px)]' : 'border-l-[3px] border-l-transparent pl-[calc(1rem-3px)]',
                    )}
                  >
                    <div className={cn('flex items-center', IS_V2 ? 'gap-3' : 'gap-2')}>
                      <StudentAvatar
                        studentId={student.id}
                        fullName={student.full_name}
                        avatarPath={student.avatar_path ?? null}
                        size={IS_V2 ? 'sm' : 'xs'}
                        stopRowNavigation
                        onPathChange={() => onAvatarUpdated()}
                      />
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <Link
                            to={`/students/${student.id}`}
                            onClick={rowLinkClick}
                            className={cn('min-w-0 flex-1 truncate rounded-sm text-body-sm font-semibold leading-snug text-ink-primary', appFocusRingClassName)}
                          >
                            {student.full_name}
                          </Link>
                          {age !== null && !IS_V2 && <span className="shrink-0 text-2xs text-ink-muted tabular-nums">{`${age}a`}</span>}
                          <div className="flex shrink-0 items-center gap-1">
                            {IS_V2 ? null : (
                              <Tooltip content={hasRoutine ? 'Con rutina' : 'Sin rutina'}>
                                <span className={indicatorClass(hasRoutine, 'routine')}>
                                  <Dumbbell className="h-3 w-3" />
                                </span>
                              </Tooltip>
                            )}
                            {IS_V2 && !hasPlan ? null : (
                              <Tooltip content={hasPlan ? (IS_V2 ? 'Tiene plan de alimentación' : 'Con plan') : 'Sin plan'}>
                                <span className={indicatorClass(hasPlan, 'plan')}>
                                  <Utensils className="h-3 w-3" />
                                </span>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                        {student.email && !IS_V2 ? <span className="truncate text-2xs text-ink-muted lg:hidden">{student.email}</span> : null}
                        <div className={cn('flex flex-wrap items-center empty:hidden', IS_V2 ? 'gap-x-2 gap-y-1' : 'gap-1')}>
                          {IS_V2 ? (
                            <span className="text-2xs text-ink-muted tabular-nums">
                              {[age !== null ? `${age} años` : null, LEVEL_LABELS[student.level] ?? student.level].filter(Boolean).join(' · ')}
                            </span>
                          ) : null}
                          {currentPlanByStudent[student.id] ? (() => {
                            const a = currentPlanByStudent[student.id]
                            const eff = effectivePaymentStatus(a)
                            // v2: el plan tiene su columna; en pantallas angostas (sin esa columna) queda acá.
                            if (IS_V2) return <span className="md:hidden"><PlanPillV2 name={a.plan_name_snapshot} status={eff} /></span>
                            const cls =
                              eff === 'paid' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25' :
                              eff === 'overdue' ? 'bg-red-500/15 text-red-600 dark:text-red-300 ring-red-500/25' :
                              eff === 'cancelled' ? 'bg-ink-muted/15 text-ink-secondary ring-ink-muted/25' :
                              'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/25'
                            return (
                              <span
                                title={`${a.plan_name_snapshot} · ${PAYMENT_STATUS_LABELS[eff]}`}
                                className={cn('inline-flex max-w-[14rem] items-center gap-1 truncate rounded-full px-2 py-0.5 text-3xs font-semibold ring-1', cls)}
                              >
                                <span className="truncate">{a.plan_name_snapshot}</span>
                              </span>
                            )
                          })() : null}
                          <StudentTagChips student={student} maxVisible={2} onTagClick={onFilterTag} />
                        </div>
                      </div>
                    </div>
                  </td>
                  {IS_V2 ? null : (
                  <td className="hh-row-drop-in hidden text-ink-secondary sm:table-cell sm:px-5 sm:py-2.5">
                    <span className="text-xs">{LEVEL_LABELS[student.level] ?? student.level}</span>
                  </td>
                  )}
                  <td className="hh-row-drop-in px-4 py-2.5 sm:px-5">
                    <StatusToggle student={student} onChanged={onStatusChanged} hidePlanDays={hasRoutine} />
                  </td>
                  <td className="hh-row-drop-in px-4 py-2.5 sm:px-5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col items-start gap-1 whitespace-nowrap">
                      {hasRoutine && IS_V2 ? (
                        <WeekProgressV2
                          totalWeeks={weeksByStudent.get(student.id) ?? 0}
                          currentWeek={weekStatusOrEmpty(weekByStudent, student.id).weekNumber}
                          finished={weekStatusOrEmpty(weekByStudent, student.id).finished}
                          lastWeek={weekStatusOrEmpty(weekByStudent, student.id).lastWeek}
                        />
                      ) : hasRoutine ? (
                        <RoutineWeekSquares
                          totalWeeks={weeksByStudent.get(student.id) ?? 0}
                          currentWeek={weekStatusOrEmpty(weekByStudent, student.id).weekNumber}
                          finished={weekStatusOrEmpty(weekByStudent, student.id).finished}
                          lastWeek={weekStatusOrEmpty(weekByStudent, student.id).lastWeek}
                        />
                      ) : (
                        <span className={IS_V2 ? 'text-xs text-ink-muted' : 'text-2xs text-ink-muted/50'}>{IS_V2 ? 'Sin rutina' : '—'}</span>
                      )}
                      {rmTestDueIds.has(student.id) ? (
                        <span
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-3xs font-semibold bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-300"
                          title="12 semanas de rutina desde el último test de RM"
                        >
                          Testear RM
                        </span>
                      ) : null}

                    </div>
                  </td>
                  {IS_V2 ? (
                    <td className="hidden px-4 py-2.5 md:table-cell sm:px-5">
                      {currentPlanByStudent[student.id] ? (
                        <PlanCellV2 name={currentPlanByStudent[student.id].plan_name_snapshot} status={effectivePaymentStatus(currentPlanByStudent[student.id])} />
                      ) : (
                        <span className="text-xs text-ink-muted">Sin plan</span>
                      )}
                    </td>
                  ) : null}
                  {IS_V2 ? null : (
                    <td className="hh-row-drop-in hidden max-w-[12rem] truncate text-ink-muted lg:table-cell lg:max-w-none lg:px-5 lg:py-2.5">
                      <span className="text-xs">{student.email ?? '—'}</span>
                    </td>
                  )}
                  {IS_V2 ? (
                    <td className="px-2 sm:px-3" onClick={(e) => e.stopPropagation()}>
                      <RowMenuV2
                        name={student.full_name}
                        onOpen={() => onRowClick(student.id)}
                        onEdit={() => onEdit(student.id)}
                        onDelete={() => onDelete(student)}
                      />
                    </td>
                  ) : (
                  <td className="hh-row-drop-in px-2 sm:px-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onRowClick(student.id) }}
                        className="inline-flex items-center gap-1 rounded-lg border border-surface-border bg-surface-card px-2 py-1 text-2xs font-medium text-ink-secondary opacity-0 shadow-xs transition-all group-hover:opacity-100 group-focus-within:opacity-100 hover:border-brand-primary/40 hover:text-brand-primary"
                        title="Abrir ficha"
                      >
                        Abrir <ChevronRight className="h-3 w-3" />
                      </button>
                      <Button variant="ghost" size="iconSm" type="button" onClick={(e) => { e.stopPropagation(); onEdit(student.id) }}
                        className="min-h-9 min-w-9 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-ink-muted"
                        title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="iconSm" type="button" onClick={(e) => { e.stopPropagation(); onDelete(student) }}
                        className="min-h-9 min-w-9 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-ink-muted hover:bg-status-expired/10 hover:text-status-expired"
                        title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** v2 · acciones de la fila en un menú «…» siempre a la vista (antes aparecían solo al pasar el mouse). */
function RowMenuV2({ name, onOpen, onEdit, onDelete }: { name: string; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const run = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }
  const item = 'w-full justify-start gap-2 px-2.5 text-xs'
  return (
    <div className="relative flex justify-end">
      <Popover
        open={open}
        onOpenChange={setOpen}
        className="w-40 p-1.5"
        trigger={({ ref, onClick, ...a11y }) => (
          <Button
            ref={ref}
            type="button"
            variant="ghost"
            size="iconSm"
            onClick={onClick}
            title="Acciones"
            aria-label={`Acciones de ${name}`}
            className="h-8 w-8 text-ink-muted"
            {...a11y}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        )}
      >
        <Button type="button" variant="ghost" size="sm" className={item} onClick={run(onOpen)}>
          <ChevronRight className="h-3.5 w-3.5" /> Abrir ficha
        </Button>
        <Button type="button" variant="ghost" size="sm" className={item} onClick={run(onEdit)}>
          <Pencil className="h-3.5 w-3.5" /> Editar
        </Button>
        <Button type="button" variant="ghost" size="sm" className={cn(item, 'text-status-expired hover:bg-status-expired/10 hover:text-status-expired')} onClick={run(onDelete)}>
          <Trash2 className="h-3.5 w-3.5" /> Eliminar
        </Button>
      </Popover>
    </div>
  )
}

/** v2 · columna «Rutina»: barra de avance y en qué semana va, en palabras. */
function WeekProgressV2({
  totalWeeks,
  currentWeek,
  finished,
  lastWeek,
}: {
  totalWeeks: number
  currentWeek: number | null | undefined
  finished: boolean
  lastWeek?: boolean
}) {
  if (totalWeeks <= 0) return <span className="text-xs text-ink-secondary">Con rutina</span>
  const week = finished ? totalWeeks : currentWeek ?? (lastWeek ? totalWeeks : 0)
  const label = finished ? 'Mes cerrado' : lastWeek ? 'Última semana' : week ? `Semana ${week} de ${totalWeeks}` : `${totalWeeks} semanas · sin feedback`
  return (
    <div className="flex w-36 flex-col gap-1" title={label}>
      <span className={cn('text-xs tabular-nums', lastWeek && !finished ? 'font-medium text-status-expired' : week ? 'text-ink-primary' : 'text-ink-muted')}>{label}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-surface-elevated" aria-hidden>
        <span
          className={cn('block h-full rounded-full', lastWeek && !finished ? 'bg-status-expired' : finished ? 'bg-status-ok' : 'bg-brand-primary')}
          style={{ width: `${Math.min(100, (week / totalWeeks) * 100)}%` }}
        />
      </span>
    </div>
  )
}

/** v2 · columna «Plan y pago»: nombre del plan y, debajo, cómo viene el pago. */
function PlanCellV2({ name, status }: { name: string; status: PlanAssignmentPaymentStatus }) {
  const pay =
    status === 'overdue'
      ? { text: 'Pago vencido', cls: 'font-medium text-status-expired' }
      : status === 'pending'
        ? { text: 'Pago pendiente', cls: 'font-medium text-status-pending' }
        : status === 'cancelled'
          ? { text: 'Cancelado', cls: 'text-ink-muted' }
          : { text: 'Al día', cls: 'text-ink-muted' }
  return (
    <div className="flex max-w-[13rem] flex-col gap-0.5">
      <span className="truncate text-xs text-ink-primary" title={name}>{name}</span>
      <span className={cn('text-2xs', pay.cls)}>{pay.text}</span>
    </div>
  )
}

/**
 * v2: el nombre del plan va en gris; el color sólo aparece como estado escrito cuando hay que hacer
 * algo (vencido, pendiente). Pagado no lleva nada: es lo normal.
 */
function PlanPillV2({ name, status }: { name: string; status: PlanAssignmentPaymentStatus }) {
  const flag =
    status === 'overdue'
      ? { text: 'Vencido', cls: 'text-status-expired' }
      : status === 'pending'
        ? { text: 'Pendiente', cls: 'text-status-pending' }
        : status === 'cancelled'
          ? { text: 'Cancelado', cls: 'text-ink-muted' }
          : null
  return (
    <span className="inline-flex min-w-0 max-w-[14rem] items-center gap-1.5" title={`${name} · ${PAYMENT_STATUS_LABELS[status]}`}>
      <span className="truncate rounded-full bg-surface-elevated px-2 py-0.5 text-3xs font-medium text-ink-secondary ring-1 ring-inset ring-surface-border">
        {name}
      </span>
      {flag ? <span className={cn('shrink-0 text-3xs font-semibold', flag.cls)}>{flag.text}</span> : null}
    </span>
  )
}
