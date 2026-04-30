import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Users, Pencil, Trash2 } from 'lucide-react'
import { useStudents } from '@/hooks/useStudents'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'
import { StudentAvatar } from '@/components/students/StudentAvatar'
import { useAuthStore } from '@/stores/authStore'
import type { Student } from '@/types/database'

const LEVEL_LABELS: Record<string, string> = {
  inicial: 'Inicial',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

export function StudentsPage() {
  const navigate = useNavigate()
  const role = useAuthStore((state) => state.profile?.role)
  const entityLabel = role === 'nutritionist' ? 'Pacientes' : 'Alumnos'
  const entityLabelSingular = role === 'nutritionist' ? 'paciente' : 'alumno'
  const { students, loading, fetchStudents, deleteStudent } = useStudents()
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchStudents() }, [fetchStudents])

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

  const grouped = {
    activo: students.filter((s) => s.status === 'activo'),
    inactivo: students.filter((s) => s.status !== 'activo'),
  }

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

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : students.length === 0 ? (
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
}: {
  label: string
  entityLabelColumn: string
  students: Student[]
  onAvatarUpdated: () => void
  onRowClick: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (student: Student) => void
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
              <th className="text-left px-5 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-widest w-[15%]">
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
                  <Badge status={student.status} />
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
