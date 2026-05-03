import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Users, Pencil, Trash2, ChevronDown, Filter, Dumbbell, X, Download, Tag } from 'lucide-react'
import { useStudents } from '@/hooks/useStudents'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'
import { StudentAvatar } from '@/components/students/StudentAvatar'
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

  if (days < 0) {
    return (
      <span className="inline-flex items-center rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400 border border-red-500/25 whitespace-nowrap">
        Vencido
      </span>
    )
  }
  if (days === 0) {
    return (
      <span className="inline-flex items-center rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400 border border-red-500/25 whitespace-nowrap">
        Vence hoy
      </span>
    )
  }
  if (days <= 7) {
    return (
      <span className="inline-flex items-center rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/25 whitespace-nowrap">
        {days} {days === 1 ? 'día' : 'días'}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/25 whitespace-nowrap">
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
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  // Cierra al clickear afuera
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

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
    <div ref={ref} className="relative inline-flex items-center gap-2">
      <button
        ref={btnRef}
        type="button"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation()
          const rect = btnRef.current?.getBoundingClientRect()
          if (rect) setDropdownPos({ top: rect.bottom + 4, left: rect.left })
          setOpen((o) => !o)
        }}
        className="inline-flex items-center gap-1 rounded-lg hover:bg-surface-elevated px-1 py-0.5 -mx-1 transition-colors"
        title="Cambiar estado"
      >
        <Badge status={student.status} />
        <ChevronDown className="h-3 w-3 text-ink-muted shrink-0" />
      </button>

      {open && (
        <div
          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left }}
          className="z-[9999] w-36 rounded-xl border border-surface-border bg-surface-card shadow-xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => void changeStatus(opt.value)}
              className={cn(
                'w-full text-left px-3 py-2.5 text-xs font-medium transition-colors hover:bg-surface-elevated',
                opt.value === student.status
                  ? 'text-brand-primary bg-brand-primary/5'
                  : 'text-ink-secondary',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {student.plan_end_date && (
        <PlanDaysChip date={student.plan_end_date} />
      )}
    </div>
  )
}

type LevelFilter  = '' | 'inicial' | 'intermedio' | 'avanzado'
type StatusFilter = '' | StudentStatus
type ExpiryFilter = '' | 'pronto' | 'vencido'

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
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const activeCount = (filterLevel ? 1 : 0) + (filterStatus ? 1 : 0) + (filterExpiry ? 1 : 0) + (filterTag ? 1 : 0)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative inline-flex shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          const rect = btnRef.current?.getBoundingClientRect()
          if (rect) setPos({ top: rect.bottom + 4, left: rect.left })
          setOpen((o) => !o)
        }}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors',
          activeCount > 0
            ? 'bg-brand-primary/10 border-brand-primary/40 text-brand-primary'
            : 'bg-surface-elevated border-surface-border text-ink-secondary hover:text-ink-primary',
        )}
      >
        <Filter className="h-3.5 w-3.5" />
        Filtrar
        {activeCount > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-primary text-white text-[10px] font-bold">
            {activeCount}
          </span>
        )}
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="z-[9999] w-52 rounded-2xl border border-surface-border bg-surface-card shadow-xl p-3 space-y-3"
          onClick={(e) => e.stopPropagation()}
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
                  'w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors',
                  filterLevel === v
                    ? 'bg-brand-primary/10 text-brand-primary font-medium'
                    : 'text-ink-secondary hover:bg-surface-elevated',
                )}
              >
                {v === '' ? 'Todos' : LEVEL_LABELS[v]}
              </button>
            ))}
          </div>

          <div className="border-t border-surface-border pt-2">
            <p className="text-[10px] text-ink-muted uppercase tracking-wide font-semibold mb-1.5">Estado</p>
            {([{ value: '' as StatusFilter, label: 'Todos' }, ...STATUS_OPTIONS]).map((opt) => (
              <button
                key={opt.value || 'all-status'}
                type="button"
                onClick={() => setFilterStatus(opt.value)}
                className={cn(
                  'w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors',
                  filterStatus === opt.value
                    ? 'bg-brand-primary/10 text-brand-primary font-medium'
                    : 'text-ink-secondary hover:bg-surface-elevated',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="border-t border-surface-border pt-2">
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
                  'w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors',
                  filterExpiry === opt.value
                    ? 'bg-brand-primary/10 text-brand-primary font-medium'
                    : 'text-ink-secondary hover:bg-surface-elevated',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {allTags.length > 0 && (
            <div className="border-t border-surface-border pt-2">
              <p className="text-[10px] text-ink-muted uppercase tracking-wide font-semibold mb-1.5">Etiqueta</p>
              {(['', ...allTags]).map((t) => (
                <button
                  key={t || 'all-tag'}
                  type="button"
                  onClick={() => setFilterTag(t)}
                  className={cn(
                    'w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5',
                    filterTag === t
                      ? 'bg-brand-primary/10 text-brand-primary font-medium'
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
              className="w-full flex items-center justify-center gap-1 text-xs text-ink-muted hover:text-status-expired border-t border-surface-border pt-2 transition-colors"
            >
              <X className="h-3 w-3" />
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function StudentsPage() {
  const navigate = useNavigate()
  const role = useAuthStore((state) => state.profile?.role)
  const user = useAuthStore((state) => state.user)
  const entityLabel = role === 'nutritionist' ? 'Pacientes' : 'Alumnos'
  const entityLabelSingular = role === 'nutritionist' ? 'paciente' : 'alumno'
  const { students, loading, fetchStudents, deleteStudent } = useStudents()
  const [localStudents, setLocalStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [filterLevel,  setFilterLevel]  = useState<LevelFilter>('')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('')
  const [filterExpiry, setFilterExpiry] = useState<ExpiryFilter>('')
  const [filterTag,    setFilterTag]    = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [activeRoutineStudentIds, setActiveRoutineStudentIds] = useState<Set<string>>(new Set())
  const [routineExpiryMap, setRoutineExpiryMap] = useState<Map<string, string>>(new Map())
  const searchRef = useRef<HTMLInputElement>(null)

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

  // Keyboard shortcut: press '/' to focus search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
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
    const ok = await deleteStudent(deleteTarget.id)
    setDeleting(false)
    if (ok) {
      setDeleteTarget(null)
      fetchStudents(search)
    }
  }

  // Actualización optimista del estado sin refetch
  function handleStatusChanged(id: string, status: StudentStatus) {
    setLocalStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    )
  }

  // Compute all unique tags from localStorage
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const s of localStudents) {
      const raw = localStorage.getItem(`tags_${s.id}`)
      if (raw) {
        try { (JSON.parse(raw) as string[]).forEach((t) => tagSet.add(t)) } catch { /* ignore */ }
      }
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
    if (filterTag) {
      const raw = localStorage.getItem(`tags_${s.id}`)
      if (!raw) return false
      try {
        const tags = JSON.parse(raw) as string[]
        if (!tags.includes(filterTag)) return false
      } catch { return false }
    }
    return true
  }), [localStudents, filterLevel, filterStatus, filterExpiry, filterTag])

  const grouped = {
    activo:   filtered.filter((s) => s.status === 'activo'),
    inactivo: filtered.filter((s) => s.status !== 'activo'),
  }

  return (
    <div>
      <Header
        title={entityLabel}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportStudentsCSV(filtered)}
              title="Exportar CSV"
              className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink-primary hover:bg-surface-elevated px-2.5 py-1.5 rounded-lg transition-colors border border-surface-border"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/students/new')}>
              Nuevo
            </Button>
          </div>
        }
      />

      <div className="px-4 lg:px-6 py-6 space-y-6">
        <Input
          ref={searchRef}
          placeholder={`Buscar ${entityLabelSingular}... (/ para enfocar)`}
          leftIcon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />

        {/* ── Filtros ── */}
        <div className="flex items-center gap-3">
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
          {/* Chips de filtros activos */}
          {filterLevel && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
              {LEVEL_LABELS[filterLevel]}
              <button onClick={() => setFilterLevel('')}><X className="h-3 w-3" /></button>
            </span>
          )}
          {filterStatus && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
              {STATUS_OPTIONS.find((o) => o.value === filterStatus)?.label}
              <button onClick={() => setFilterStatus('')}><X className="h-3 w-3" /></button>
            </span>
          )}
          {filterExpiry && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {filterExpiry === 'pronto' ? 'Vence pronto' : 'Plan vencido'}
              <button onClick={() => setFilterExpiry('')}><X className="h-3 w-3" /></button>
            </span>
          )}
          {filterTag && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Tag className="h-3 w-3" />{filterTag}
              <button onClick={() => setFilterTag('')}><X className="h-3 w-3" /></button>
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-6">
            <div>
              <div className="h-3 w-20 rounded bg-surface-elevated mb-3 animate-pulse" />
              <TableSkeleton rows={4} cols={4} />
            </div>
          </div>
        ) : localStudents.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title={`No hay ${entityLabelSingular}s todavía`}
            description={`Creá tu primer ${entityLabelSingular} para comenzar a gestionar rutinas y planes.`}
            action={{
              label: `Nuevo ${entityLabelSingular}`,
              onClick: () => navigate('/students/new'),
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
          <div className="space-y-8">
            {grouped.activo.length > 0 && (
              <StudentTable
                label={`Activos (${grouped.activo.length})`}
                onAvatarUpdated={() => { void fetchStudents(search) }}
                entityLabelColumn={role === 'nutritionist' ? 'Paciente' : 'Alumno'}
                students={grouped.activo}
                activeRoutineStudentIds={activeRoutineStudentIds}
                routineExpiryMap={routineExpiryMap}
                onRowClick={(id) => navigate(`/students/${id}`)}
                onEdit={(id) => navigate(`/students/${id}/edit`)}
                onDelete={(s) => setDeleteTarget(s)}
                onStatusChanged={handleStatusChanged}
              />
            )}
            {grouped.inactivo.length > 0 && (
              <StudentTable
                label={`Inactivos / Baja (${grouped.inactivo.length})`}
                onAvatarUpdated={() => { void fetchStudents(search) }}
                entityLabelColumn={role === 'nutritionist' ? 'Paciente' : 'Alumno'}
                students={grouped.inactivo}
                activeRoutineStudentIds={activeRoutineStudentIds}
                routineExpiryMap={routineExpiryMap}
                onRowClick={(id) => navigate(`/students/${id}`)}
                onEdit={(id) => navigate(`/students/${id}/edit`)}
                onDelete={(s) => setDeleteTarget(s)}
                onStatusChanged={handleStatusChanged}
              />
            )}
          </div>
        )}
      </div>

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

function StudentTable({
  label,
  entityLabelColumn,
  students,
  onAvatarUpdated,
  onRowClick,
  onEdit,
  onDelete,
  onStatusChanged,
  activeRoutineStudentIds,
  routineExpiryMap,
}: {
  label: string
  entityLabelColumn: string
  students: Student[]
  onAvatarUpdated: () => void
  onRowClick: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (student: Student) => void
  onStatusChanged: (id: string, status: StudentStatus) => void
  activeRoutineStudentIds: Set<string>
  routineExpiryMap: Map<string, string>
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">
        {label}
      </h2>

      <div className="w-full overflow-x-auto rounded-2xl border border-surface-border bg-surface-card">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-surface-border">
              <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-widest w-[35%]">
                {entityLabelColumn}
              </th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-widest w-[15%] hidden sm:table-cell">
                Nivel
              </th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-widest">
                Estado
              </th>
              <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-widest hidden md:table-cell">
                Email
              </th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {students.map((student, i) => (
              <tr
                key={student.id}
                onClick={() => onRowClick(student.id)}
                className={cn(
                  'cursor-pointer group transition-colors hover:bg-surface-elevated',
                  i !== students.length - 1 && 'border-b border-surface-border'
                )}
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <StudentAvatar
                      studentId={student.id}
                      fullName={student.full_name}
                      avatarPath={student.avatar_path ?? null}
                      size="sm"
                      stopRowNavigation
                      onPathChange={() => onAvatarUpdated()}
                    />
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="font-semibold text-ink-primary truncate">{student.full_name}</span>
                      {activeRoutineStudentIds.has(student.id) ? (
                        <>
                          <span
                            title="Rutina activa"
                            className="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary/15"
                          >
                            <Dumbbell className="h-3 w-3 text-brand-primary" />
                          </span>
                          {routineExpiryMap.has(student.id) && (() => {
                            const d = daysUntil(routineExpiryMap.get(student.id)!)
                            return (
                              <span
                                title="Rutina por vencer"
                                className="shrink-0 hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/20 text-orange-400 text-[10px] font-medium"
                              >
                                {d === 0 ? 'Vence hoy' : `Rutina vence en ${d}d`}
                              </span>
                            )
                          })()}
                        </>
                      ) : student.status === 'activo' ? (
                        <span
                          title="Sin rutina activa"
                          className="shrink-0 hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/20 text-amber-400 text-[10px] font-medium"
                        >
                          Sin rutina
                        </span>
                      ) : null}
                      {(() => {
                        const raw = localStorage.getItem(`tags_${student.id}`)
                        if (!raw) return null
                        try {
                          const tags = JSON.parse(raw) as string[]
                          return tags.slice(0, 2).map((t) => (
                            <span key={t} className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-medium">
                              <Tag className="h-2.5 w-2.5" />{t}
                            </span>
                          ))
                        } catch { return null }
                      })()}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-ink-secondary hidden sm:table-cell">
                  {LEVEL_LABELS[student.level] ?? student.level}
                </td>
                <td className="px-5 py-3.5">
                  <StatusToggle student={student} onChanged={onStatusChanged} />
                </td>
                <td className="px-5 py-3.5 text-ink-muted hidden md:table-cell">
                  {student.email ?? '—'}
                </td>
                <td className="pr-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(student.id) }}
                      className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-border transition-colors opacity-0 group-hover:opacity-100"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(student) }}
                      className="p-1.5 rounded-lg text-ink-muted hover:text-status-expired hover:bg-status-expired/10 transition-colors opacity-0 group-hover:opacity-100"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
