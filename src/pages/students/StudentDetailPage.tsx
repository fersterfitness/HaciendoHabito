import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2, Dumbbell, FileText, Plus, Mail, Phone, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStudents } from '@/hooks/useStudents'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { getInitials, formatDate, daysUntil } from '@/lib/utils'
import type { Student, Routine } from '@/types/database'

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { deleteStudent } = useStudents()
  const [student, setStudent] = useState<Student | null>(null)
  const [routines, setRoutines] = useState<Routine[]>([])
  const [loading, setLoading] = useState(true)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('students').select('*').eq('id', id).single(),
      supabase.from('routines').select('*').eq('student_id', id).order('created_at', { ascending: false }),
    ]).then(([{ data: s }, { data: r }]) => {
      setStudent(s)
      setRoutines(r ?? [])
    }).finally(() => setLoading(false))
  }, [id])

  async function handleDelete() {
    if (!id) return
    setDeleting(true)
    const ok = await deleteStudent(id)
    setDeleting(false)
    if (ok) navigate('/students')
  }

  if (loading) return <div><Header title="Alumno" showBack /><div className="flex justify-center py-16"><Spinner size="lg" /></div></div>
  if (!student) return <div><Header title="Alumno" showBack /><p className="p-6 text-ink-muted">Alumno no encontrado.</p></div>

  const activeRoutine = routines.find((r) => r.status === 'activa' || r.status === 'por_vencer')

  return (
    <div>
      <Header title={student.full_name} showBack />

      <div className="px-4 lg:px-6 py-6 space-y-6">
        {/* Perfil */}
        <Card>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center shrink-0">
              <span className="text-brand-primary font-bold text-xl">
                {getInitials(student.full_name)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-ink-primary">{student.full_name}</h2>
                <Badge status={student.status} size="md" />
                <Badge status={student.level} size="md" />
              </div>
              <div className="flex flex-wrap gap-4 mt-2">
                {student.email && (
                  <a href={`mailto:${student.email}`} className="flex items-center gap-1.5 text-xs text-ink-secondary hover:text-brand-primary transition-colors">
                    <Mail className="h-3 w-3" />
                    {student.email}
                  </a>
                )}
                {student.phone && (
                  <a href={`tel:${student.phone}`} className="flex items-center gap-1.5 text-xs text-ink-secondary hover:text-brand-primary transition-colors">
                    <Phone className="h-3 w-3" />
                    {student.phone}
                  </a>
                )}
                {student.birth_date && (
                  <span className="flex items-center gap-1.5 text-xs text-ink-secondary">
                    <Calendar className="h-3 w-3" />
                    {formatDate(student.birth_date)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Acciones del perfil */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-surface-border">
            <Button
              variant="secondary"
              size="sm"
              icon={<Pencil className="h-3.5 w-3.5" />}
              onClick={() => navigate(`/students/${id}/edit`)}
            >
              Editar perfil
            </Button>
            <div className="flex-1" />
            <button
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-status-expired transition-colors px-2 py-1.5 rounded-lg hover:bg-status-expired/8"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar alumno
            </button>
          </div>
        </Card>

        {student.notes && (
          <Card>
            <CardTitle className="text-sm mb-2">Observaciones</CardTitle>
            <p className="text-sm text-ink-secondary whitespace-pre-wrap">{student.notes}</p>
          </Card>
        )}

        {/* Rutina activa */}
        {activeRoutine && (
          <Card className="border-brand-primary/20">
            <CardHeader>
              <div>
                <p className="text-xs text-brand-primary font-medium uppercase tracking-wider mb-0.5">Rutina activa</p>
                <CardTitle>{activeRoutine.name}</CardTitle>
              </div>
              <Badge status={activeRoutine.status} size="md" />
            </CardHeader>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-surface-elevated rounded-xl p-3">
                <p className="text-xs text-ink-muted">Inicio</p>
                <p className="text-sm font-semibold text-ink-primary">{formatDate(activeRoutine.start_date)}</p>
              </div>
              <div className="bg-surface-elevated rounded-xl p-3">
                <p className="text-xs text-ink-muted">Vencimiento</p>
                <p className="text-sm font-semibold text-ink-primary">{formatDate(activeRoutine.end_date)}</p>
              </div>
              <div className="bg-surface-elevated rounded-xl p-3">
                <p className="text-xs text-ink-muted">Días restantes</p>
                <p className={`text-sm font-semibold ${daysUntil(activeRoutine.end_date) <= 7 ? 'text-status-expiring' : 'text-ink-primary'}`}>
                  {Math.max(0, daysUntil(activeRoutine.end_date))}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                variant="secondary"
                size="sm"
                icon={<Dumbbell className="h-3.5 w-3.5" />}
                onClick={() => navigate(`/routines/${activeRoutine.id}/editor`)}
                className="flex-1"
              >
                Editor de rutina
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<FileText className="h-3.5 w-3.5" />}
                onClick={() => navigate(`/routine-pdfs`)}
                className="flex-1"
              >
                Ver PDF
              </Button>
            </div>
          </Card>
        )}

        {/* Historial de rutinas */}
        <Card>
          <CardHeader>
            <CardTitle>Historial de rutinas</CardTitle>
            <Button
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => navigate(`/routines/new?student=${id}`)}
            >
              Nueva
            </Button>
          </CardHeader>

          {routines.length === 0 ? (
            <EmptyState
              icon={<Dumbbell className="h-6 w-6" />}
              title="Sin rutinas"
              description="Este alumno todavía no tiene rutinas registradas."
            />
          ) : (
            <div className="space-y-2">
              {routines.map((r) => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/routines/${r.id}`)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-elevated hover:bg-surface-border/50 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-primary truncate">{r.name}</p>
                    <p className="text-xs text-ink-muted">
                      {formatDate(r.start_date)} → {formatDate(r.end_date)}
                    </p>
                  </div>
                  <Badge status={r.status} />
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="¿Eliminar alumno?"
        description="Esta acción no se puede deshacer. Se eliminarán todos los datos asociados al alumno."
        confirmLabel="Sí, eliminar"
        loading={deleting}
      />
    </div>
  )
}
