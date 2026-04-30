import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Users, Pencil, Trash2, ChevronDown, Filter } from 'lucide-react'
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

export function StudentsPage() {
  const navigate = useNavigate()
  const role = useAuthStore((state) => state.profile?.role)
  const entityLabel = role === 'nutritionist' ? 'Pacientes' : 'Alumnos'
  const entityLabelSingular = role === 'nutritionist' ? 'paciente' : 'alumno'
  const { students, loading, fetchStudents, deleteStudent } = useStudents()
  const [localStudents, setLocalStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [filterLevel,  setFilterLevel]  = useState<LevelFilter>('')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('')
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchStudents() }, [fetchStudents])
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

  const filtered = useMemo(() => localStudents.filter((s) => {
    if (filterLevel  && s.level  !== filterLevel)  return false
    if (filterStatus && s.status !== filterStatus) return false
    return true
  }), [localStudents, filterLevel, filterStatus])

  const grouped = {
    activo:   filtered.filter((s) => s.status === 'activo'),
    inactivo: filtered.filter((s) => s.status !== 'activo'),
  }

  const hasFilters = filterLevel !== '' || filterStatus !== ''

  return (
    <div>
      <Header
        title={entityLabel}
        actions={
          <Button
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/students/new')}
          >
            Nuevo
          </Button>
        }
      />

      <div className="px-4 lg:px-6 py-6 space-y-6">
        <Input
          placeholder={`Buscar ${entityLabelSingular}...`}
          leftIcon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />

        {/* ── Filtros ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-ink-muted shrink-0" />
          {/* Nivel */}
          {(['', 'inicial', 'intermedio', 'avanzado'] as LevelFilter[]).map((v) => (
            <button
              key={v || 'all-nivel'}
              onClick={() => setFilterLevel(v)}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-medium transition-colors border',
                filterLevel === v
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'bg-surface-elevated text-ink-muted border-surface-border hover:text-ink-primary',
              )}
            >
              {v === '' ? 'Todos los niveles' : LEVEL_LABELS[v]}
            </button>
          ))}
          <span className="w-px h-4 bg-surface-border" />
          {/* Estado */}
          {([
            { value: '' as StatusFilter, label: 'Todos' },
            ...STATUS_OPTIONS,
          ]).map((opt) => (
            <button
              key={opt.value || 'all-status'}
              onClick={() => setFilterStatus(opt.value)}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-medium transition-colors border',
                filterStatus === opt.value
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'bg-surface-elevated text-ink-muted border-surface-border hover:text-ink-primary',
              )}
            >
              {opt.label}
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={() => { setFilterLevel(''); setFilterStatus('') }}
              className="ml-1 text-xs text-ink-muted hover:text-status-expired transition-colors underline underline-offset-2"
            >
              Limpiar
            </button>
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
}: {
  label: string
  entityLabelColumn: string
  students: Student[]
  onAvatarUpdated: () => void
  onRowClick: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (student: Student) => void
  onStatusChanged: (id: string, status: StudentStatus) => void
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
                    <span className="font-semibold text-ink-primary">{student.full_name}</span>
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
