import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Users } from 'lucide-react'
import { useStudents } from '@/hooks/useStudents'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { Card } from '@/components/ui/Card'
import { getInitials, formatDate } from '@/lib/utils'
import type { Student } from '@/types/database'

const LEVEL_LABELS: Record<string, string> = {
  inicial: 'Inicial',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

export function StudentsPage() {
  const navigate = useNavigate()
  const { students, loading, fetchStudents } = useStudents()
  const [search, setSearch] = useState('')

  useEffect(() => { fetchStudents() }, [fetchStudents])

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value)
      fetchStudents(value)
    },
    [fetchStudents]
  )

  const grouped = {
    activo: students.filter((s) => s.status === 'activo'),
    inactivo: students.filter((s) => s.status !== 'activo'),
  }

  return (
    <div>
      <Header
        title="Alumnos"
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

      <div className="px-4 lg:px-6 py-6 space-y-6 max-w-5xl">
        {/* Search */}
        <Input
          placeholder="Buscar alumno..."
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
            title="No hay alumnos todavía"
            description="Creá tu primer alumno para comenzar a gestionar rutinas y planes."
            action={{
              label: 'Nuevo alumno',
              onClick: () => navigate('/students/new'),
              icon: <Plus className="h-4 w-4" />,
            }}
          />
        ) : (
          <>
            {grouped.activo.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">
                  Activos ({grouped.activo.length})
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {grouped.activo.map((s) => (
                    <StudentCard key={s.id} student={s} onClick={() => navigate(`/students/${s.id}`)} />
                  ))}
                </div>
              </section>
            )}

            {grouped.inactivo.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">
                  Inactivos / Baja ({grouped.inactivo.length})
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {grouped.inactivo.map((s) => (
                    <StudentCard key={s.id} student={s} onClick={() => navigate(`/students/${s.id}`)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function StudentCard({ student, onClick }: { student: Student; onClick: () => void }) {
  return (
    <Card hover onClick={onClick} className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center shrink-0">
        <span className="text-brand-primary font-bold text-sm">
          {getInitials(student.full_name)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-ink-primary truncate">{student.full_name}</p>
          <Badge status={student.status} />
        </div>
        <p className="text-xs text-ink-muted mt-0.5">{LEVEL_LABELS[student.level]}</p>
        {student.email && (
          <p className="text-xs text-ink-secondary mt-1 truncate">{student.email}</p>
        )}
      </div>
    </Card>
  )
}
