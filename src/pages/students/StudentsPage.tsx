import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
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
} from 'lucide-react'
import { useStudents } from '@/hooks/useStudents'
import { StudentTagChips } from '@/components/students/StudentTagChips'
import { studentTrainerTags } from '@/lib/students/studentTrainerPrefs'
import { Header } from '@/components/layout/Header'
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
import { NewStudentModal } from '@/components/students/NewStudentModal'
import { StudentDeletionHistoryPanel } from '@/components/students/StudentDeletionHistoryPanel'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { TableSkeleton } from '@/components/ui/Skeleton'
import toast from 'react-hot-toast'
import type { Student, StudentStatus } from '@/types/database'

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

function PlanDaysChip({ date }: { date: string }) {
  const days = daysUntil(date)
  const pill =
    'inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium border border-black/[0.06] whitespace-nowrap dark:border-white/[0.08]'

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
}: {
  student: Student
  onChanged: (id: string, status: StudentStatus) => void
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
            <Badge status={student.status} />
            <ChevronDown className="h-3 w-3 shrink-0 text-ink-muted" />
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
      {student.plan_end_date && (
        <PlanDaysChip date={student.plan_end_date} />
      )}
    </div>
  )
}

type LevelFilter  = '' | 'inicial' | 'intermedio' | 'avanzado'
type StatusFilter = '' | StudentStatus
type ExpiryFilter = '' | 'pronto' | 'vencido'

/** Opciones de orden de la tabla (botón neutro tipo Gray UI). */
type TableSort = 'recommended' | 'name_asc' | 'name_desc' | 'plan_asc' | 'plan_desc'

const TABLE_SORT_OPTS: { value: TableSort; label: string }[] = [
  { value: 'recommended', label: 'Activos primero, luego nombre (A→Z)' },
  { value: 'name_asc', label: 'Nombre · A→Z' },
  { value: 'name_desc', label: 'Nombre · Z→A' },
  { value: 'plan_asc', label: 'Vencimiento plan · más próximo' },
  { value: 'plan_desc', label: 'Vencimiento plan · más lejano' },
]

/** Texto corto bajo el título del listado. */
const SORT_SUBTITLE: Record<TableSort, string> = {
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
function sortStudentsClone(list: Student[], sort: TableSort): Student[] {
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
}) {
  const [open, setOpen] = useState(false)
  const activeCount = (filterLevel ? 1 : 0) + (filterStatus ? 1 : 0) + (filterExpiry ? 1 : 0) + (filterTag ? 1 : 0)

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
            Filtrar
            {activeCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-brand-secondary px-1.5 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
            <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
          </button>
        )}
      >
          {/* Nivel */}
          <div>
            <p className="text-[10px] text-ink-muted uppercase tracking-wide font-semibold mb-1.5">Nivel</p>
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
            <p className="text-[10px] text-ink-muted uppercase tracking-wide font-semibold mb-1.5">Estado</p>
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

          <div className={directoryPopoverDividerClassName}>
            <p className="text-[10px] text-ink-muted uppercase tracking-wide font-semibold mb-1.5">Plan</p>
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

          {allTags.length > 0 && (
            <div className={directoryPopoverDividerClassName}>
              <p className="text-[10px] text-ink-muted uppercase tracking-wide font-semibold mb-1.5">Etiqueta</p>
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
              onClick={() => { setFilterLevel(''); setFilterStatus(''); setFilterExpiry(''); setFilterTag(''); setOpen(false) }}
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
            Ordenar
            <ChevronDown className={cn('h-3 w-3 shrink-0 opacity-70 transition-transform', open && 'rotate-180')} />
          </button>
        )}
      >
          <p className="px-2 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
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
  const entityLabel = role === 'nutritionist' ? 'Pacientes' : 'Alumnos'
  const entityLabelSingular = role === 'nutritionist' ? 'paciente' : 'alumno'
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

  const { students, loading, fetchStudents, deleteStudent } = useStudents()
  const [localStudents, setLocalStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [filterLevel,  setFilterLevel]  = useState<LevelFilter>('')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('')
  const [filterExpiry, setFilterExpiry] = useState<ExpiryFilter>('')
  const [filterTag,    setFilterTag]    = useState('')
  const [tableSort, setTableSort] = useState<TableSort>('recommended')
  const TABLE_PAGE_SIZE = 50
  const [tableVisibleCount, setTableVisibleCount] = useState(TABLE_PAGE_SIZE)
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [activeRoutineStudentIds, setActiveRoutineStudentIds] = useState<Set<string>>(new Set())
  const [routineExpiryMap, setRoutineExpiryMap] = useState<Map<string, string>>(new Map())
  const [hasMealPlanStudentIds, setHasMealPlanStudentIds] = useState<Set<string>>(new Set())
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const studentPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchStudents()
    if (!user) return
    supabase
      .from('routines')
      .select('student_id, end_date, status')
      .eq('owner_id', user.id)
      .in('status', ['activa', 'por_vencer'])
      .then(({ data }) => {
        const ids  = new Set<string>()
        const expMap = new Map<string, string>()
        for (const r of (data ?? [])) {
          const sid = r.student_id as string
          ids.add(sid)
          const d = daysUntil(r.end_date as string)
          if (d >= 0 && d <= 7) expMap.set(sid, r.end_date as string)
        }
        setActiveRoutineStudentIds(ids)
        setRoutineExpiryMap(expMap)
      })
  }, [fetchStudents, user])

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
      fetchStudents(value)
    },
    [fetchStudents]
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
    return true
  }), [localStudents, filterLevel, filterStatus, filterExpiry, filterTag])

  const sortedForTable = useMemo(
    () => sortStudentsClone(filtered, tableSort),
    [filtered, tableSort],
  )

  const visibleForTable = useMemo(
    () => sortedForTable.slice(0, tableVisibleCount),
    [sortedForTable, tableVisibleCount],
  )

  useEffect(() => {
    setTableVisibleCount(TABLE_PAGE_SIZE)
  }, [search, filterLevel, filterStatus, filterExpiry, filterTag, tableSort])

  return (
    <div>
      <Header title={entityLabel} />

      <DirectoryPageShell>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
          <div className="min-w-0 flex-1 max-w-xl">
            <Input
              ref={searchRef}
              type="search"
              placeholder={`Buscar ${entityLabelSingular} por nombre, email… ( / para enfocar )`}
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
              className={directoryToolbarBtnClassName}
            >
              <Download className="h-4 w-4 opacity-70" aria-hidden />
              Exportar
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
                <button type="button" className="text-ink-muted hover:text-ink-primary" onClick={() => setFilterLevel('')} aria-label="Quitar filtro nivel">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            {filterStatus && (
              <span className={directoryFilterChipClassName}>
                {STATUS_OPTIONS.find((o) => o.value === filterStatus)?.label}
                <button type="button" className="text-ink-muted hover:text-ink-primary" onClick={() => setFilterStatus('')} aria-label="Quitar filtro estado">
                  <X className="h-3.5 w-3.5" />
                </button>
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
                <button type="button" className="text-ink-muted hover:text-ink-primary" onClick={() => setFilterTag('')} aria-label="Quitar etiqueta">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}

            <Button
              type="button"
              variant="gradientSecondary"
              onClick={openNewStudentModal}
              title={role === 'nutritionist' ? 'Nuevo paciente' : 'Nuevo alumno'}
              icon={<Plus className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />}
            >
              {role === 'nutritionist' ? 'Nuevo paciente' : 'Nuevo alumno'}
            </Button>
          </div>
        </div>

        <StudentDeletionHistoryPanel
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
            <StudentDirectoryTable
              entityLabel={entityLabel}
              entityLabelColumn={role === 'nutritionist' ? 'Paciente' : 'Alumno'}
              sortSubtitle={SORT_SUBTITLE[tableSort]}
              students={visibleForTable}
              selectedStudentId={selectedStudentId}
              onAvatarUpdated={() => { void fetchStudents(search) }}
              activeRoutineStudentIds={activeRoutineStudentIds}
              routineExpiryMap={routineExpiryMap}
              hasMealPlanStudentIds={hasMealPlanStudentIds}
              onRowClick={(studentId) => setSelectedStudentId(studentId)}
              onEdit={(id) => navigate(`/students/${id}/edit`)}
              onDelete={(s) => setDeleteTarget(s)}
              onStatusChanged={handleStatusChanged}
              onFilterTag={setFilterTag}
            />
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
              /* Móvil: panel centrado · sm+: entra deslizando de derecha → izquierda */
              'rounded-2xl motion-reduce:animate-none motion-safe:max-sm:animate-panel-soft motion-safe:sm:animate-panel-slide-in',
              /* Móvil: tarjeta con margen en los cuatro lados (estilo modal Gray) */
              'inset-3 sm:inset-auto',
              'sm:left-auto sm:right-5 sm:top-5 sm:bottom-5 sm:h-[calc(100dvh-2.5rem)] sm:w-full sm:max-w-3xl lg:right-6 lg:top-6 lg:bottom-6 lg:max-w-4xl',
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
        title={`¿Eliminar a ${deleteTarget?.full_name}?`}
        description={`Esta acción no se puede deshacer. Se eliminarán todos los datos asociados al ${entityLabelSingular}.`}
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
  routineExpiryMap: _routineExpiryMap,
  hasMealPlanStudentIds,
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
  routineExpiryMap: Map<string, string>
  hasMealPlanStudentIds: Set<string>
}) {
  const iconWrapBase =
    'relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border bg-surface-elevated/25'
  const iconStrike =
    "after:content-[''] after:absolute after:left-1/2 after:top-1/2 after:h-[2px] after:w-[140%] after:-translate-x-1/2 after:-translate-y-1/2 after:rotate-[-35deg] after:bg-current after:opacity-55"

  const tableHeader = (
    <div className="flex flex-col gap-2 border-b border-surface-border/70 bg-surface-elevated/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight text-ink-primary">{entityLabel}</h2>
        <p className="truncate text-[11px] text-ink-muted">{sortSubtitle}</p>
      </div>
      <span className="inline-flex items-center rounded-full border border-surface-border/70 bg-surface-card px-2.5 py-1 text-[11px] font-semibold tabular-nums text-ink-secondary">
        {students.length === 1 ? '1 registro' : `${students.length} registros`}
      </span>
    </div>
  )

  return (
    <section className="overflow-hidden rounded-2xl border border-surface-border/80 bg-surface-card shadow-card">
      {tableHeader}

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
                'hh-row-drop-in flex items-center gap-2 px-4 py-2.5 cursor-pointer transition-colors',
                'outline-none focus-within:bg-surface-elevated/35',
                isSelected ? 'bg-surface-elevated/50 border-l-[3px] border-l-brand-primary' : 'hover:bg-surface-elevated/30 border-l-[3px] border-l-transparent',
              )}
            >
              <StudentAvatar
                studentId={student.id}
                fullName={student.full_name}
                avatarPath={student.avatar_path ?? null}
                size="xs"
                stopRowNavigation
                onPathChange={() => onAvatarUpdated()}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-[13px] leading-snug text-ink-primary">{student.full_name}</span>
                  {age !== null && (
                    <span className="shrink-0 text-[11px] text-ink-muted">{age}a</span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <StatusToggle student={student} onChanged={onStatusChanged} />
                  {student.plan_end_date && <PlanDaysChip date={student.plan_end_date} />}
                </div>
                <StudentTagChips
                  student={student}
                  maxVisible={2}
                  onTagClick={onFilterTag}
                  className="mt-1"
                />
                <div className="mt-1 flex items-center gap-1.5">
                  <Tooltip content={hasRoutine ? 'Con rutina' : 'Sin rutina'}>
                    <span className={cn(iconWrapBase, hasRoutine ? 'border-surface-border/75 text-brand-secondary' : 'border-dashed border-surface-border/80 text-ink-muted', !hasRoutine && iconStrike)}>
                      <Dumbbell className="h-3 w-3" />
                    </span>
                  </Tooltip>
                  <Tooltip content={hasPlan ? 'Con plan' : 'Sin plan'}>
                    <span className={cn(iconWrapBase, hasPlan ? 'border-surface-border/75 text-brand-tertiary' : 'border-dashed border-surface-border/80 text-ink-muted', !hasPlan && iconStrike)}>
                      <Utensils className="h-3 w-3" />
                    </span>
                  </Tooltip>
                  <span className="text-[11px] text-ink-muted">{LEVEL_LABELS[student.level] ?? student.level}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRowClick(student.id) }}
                  className="inline-flex items-center gap-1 rounded-lg border border-surface-border bg-surface-elevated/40 px-2 py-1 text-[11px] font-medium text-ink-secondary hover:border-brand-secondary/40 hover:text-brand-secondary transition-colors"
                >
                  Abrir <ChevronRight className="h-3 w-3" />
                </button>
                <div className="flex gap-0.5">
                  <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(student.id) }} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg p-1 text-ink-muted hover:text-ink-primary transition-colors" title="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(student) }} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg p-1 text-ink-muted hover:text-status-expired transition-colors" title="Eliminar">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Desktop table (≥ sm) ─────────────────────────────────── */}
      <div className="hidden sm:block max-h-[min(68vh,36rem)] overflow-auto">
        <table className="w-full border-collapse text-[13px] leading-snug">
          <thead className="sticky top-0 z-[1] border-b border-surface-border/70 bg-surface-card/92 backdrop-blur-md">
            <tr className="text-left">
              <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-5">{entityLabelColumn}</th>
              <th scope="col" className="hidden whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:table-cell sm:px-5">Nivel</th>
              <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-5">Estado</th>
              <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:px-5">Vence</th>
              <th scope="col" className="hidden whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted lg:table-cell lg:px-5">Email</th>
              <th scope="col" className="w-[7rem]" aria-hidden />
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
                    'group cursor-pointer transition-colors outline-none',
                    'hover:bg-surface-elevated/35 focus-within:bg-surface-elevated/35',
                    isSelected && 'bg-surface-elevated/45',
                  )}
                >
                  <td
                    className={cn(
                      'hh-row-drop-in px-4 py-2.5 sm:px-5',
                      isSelected ? 'border-l-[3px] border-l-zinc-400 pl-[calc(1rem-3px)]' : 'border-l-[3px] border-l-transparent pl-[calc(1rem-3px)]',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <StudentAvatar
                        studentId={student.id}
                        fullName={student.full_name}
                        avatarPath={student.avatar_path ?? null}
                        size="xs"
                        stopRowNavigation
                        onPathChange={() => onAvatarUpdated()}
                      />
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-snug text-ink-primary">
                            {student.full_name}
                          </span>
                          {age !== null && <span className="shrink-0 text-[11px] text-ink-muted tabular-nums">{age}a</span>}
                          <div className="flex shrink-0 items-center gap-1">
                            <Tooltip content={hasRoutine ? 'Con rutina' : 'Sin rutina'}>
                              <span className={cn(iconWrapBase, hasRoutine ? 'border-surface-border/75 text-brand-secondary' : 'border-dashed border-surface-border/80 text-ink-muted', !hasRoutine && iconStrike)}>
                                <Dumbbell className="h-3 w-3" />
                              </span>
                            </Tooltip>
                            <Tooltip content={hasPlan ? 'Con plan' : 'Sin plan'}>
                              <span className={cn(iconWrapBase, hasPlan ? 'border-surface-border/75 text-brand-tertiary' : 'border-dashed border-surface-border/80 text-ink-muted', !hasPlan && iconStrike)}>
                                <Utensils className="h-3 w-3" />
                              </span>
                            </Tooltip>
                          </div>
                        </div>
                        {student.email ? <span className="truncate text-[11px] text-ink-muted lg:hidden">{student.email}</span> : null}
                        <StudentTagChips
                          student={student}
                          maxVisible={2}
                          onTagClick={onFilterTag}
                          className="mt-0.5"
                        />
                      </div>
                    </div>
                  </td>
                  <td className="hh-row-drop-in hidden text-ink-secondary sm:table-cell sm:px-5 sm:py-2.5">
                    <span className="text-[12px]">{LEVEL_LABELS[student.level] ?? student.level}</span>
                  </td>
                  <td className="hh-row-drop-in px-4 py-2.5 sm:px-5">
                    <StatusToggle student={student} onChanged={onStatusChanged} />
                  </td>
                  <td className="hh-row-drop-in px-4 py-2.5 sm:px-5">
                    {student.plan_end_date ? (
                      <PlanDaysChip date={student.plan_end_date} />
                    ) : (
                      <span className="text-[11px] text-ink-muted/50">—</span>
                    )}
                  </td>
                  <td className="hh-row-drop-in hidden max-w-[12rem] truncate text-ink-muted lg:table-cell lg:max-w-none lg:px-5 lg:py-2.5">
                    <span className="text-[12px]">{student.email ?? '—'}</span>
                  </td>
                  <td className="hh-row-drop-in px-2 sm:px-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onRowClick(student.id) }}
                        className="inline-flex items-center gap-1 rounded-lg border border-surface-border bg-surface-elevated/40 px-2 py-1 text-[11px] font-medium text-ink-secondary opacity-0 transition-all group-hover:opacity-100 group-focus-within:opacity-100 hover:border-brand-secondary/40 hover:text-brand-secondary"
                        title="Abrir ficha"
                      >
                        Abrir <ChevronRight className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(student.id) }}
                        className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-elevated hover:text-ink-primary opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                        title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(student) }}
                        className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md p-1.5 text-ink-muted transition-colors hover:bg-status-expired/12 hover:text-status-expired opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                        title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
