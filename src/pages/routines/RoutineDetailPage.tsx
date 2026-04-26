import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2, Dumbbell, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRoutines } from '@/hooks/useRoutines'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { Select } from '@/components/ui/Input'
import { formatDate, daysUntil } from '@/lib/utils'
import type { Routine } from '@/types/database'
import { ROUTINE_STATUSES } from '@/lib/constants'
import toast from 'react-hot-toast'

type RoutineFull = Routine & { student?: { full_name: string; level: string } }

export function RoutineDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { deleteRoutine, updateRoutine } = useRoutines()
  const [routine, setRoutine] = useState<RoutineFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase
      .from('routines')
      .select('*, student:students(full_name, level)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setRoutine(data as unknown as RoutineFull)
        setLoading(false)
      })
  }, [id])

  async function handleDelete() {
    if (!id) return
    setDeleting(true)
    const ok = await deleteRoutine(id)
    setDeleting(false)
    if (ok) navigate('/routines')
  }

  async function handleStatusChange(newStatus: string) {
    if (!id) return
    const result = await updateRoutine(id, {
      status: newStatus as Routine['status'],
      last_status_change: new Date().toISOString(),
    })
    if (result) setRoutine((prev) => prev ? { ...prev, status: newStatus as Routine['status'] } : prev)
  }

  if (loading) return <div><Header title="Rutina" showBack /><div className="flex justify-center py-16"><Spinner size="lg" /></div></div>
  if (!routine) return <div><Header title="Rutina" showBack /><p className="p-6 text-ink-muted">Rutina no encontrada.</p></div>

  const days = daysUntil(routine.end_date)

  return (
    <div>
      <Header
        title={routine.student?.full_name ?? 'Rutina'}
        showBack
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => navigate(`/routines/${id}/edit`)}>
              Editar
            </Button>
            <Button variant="danger" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setShowDelete(true)} />
          </div>
        }
      />

      <div className="px-4 lg:px-6 py-6 space-y-5 max-w-2xl">
        {/* Cabecera */}
        <Card>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">{routine.name}</p>
              <h2 className="text-xl font-bold text-ink-primary">
                {routine.student?.full_name ?? '—'}
              </h2>
            </div>
            <Badge status={routine.status} size="md" />
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <MetricBox label="Inicio" value={formatDate(routine.start_date)} />
            <MetricBox label="Vencimiento" value={formatDate(routine.end_date)} />
            <MetricBox
              label="Días restantes"
              value={days <= 0 ? 'Vencida' : `${days}`}
              highlight={days <= 10 && days > 0}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <MetricBox label="Duración" value={`${routine.duration_days} días`} />
            <MetricBox label="Nivel" value={routine.level.charAt(0).toUpperCase() + routine.level.slice(1)} />
          </div>

          {/* Cambiar estado */}
          <Select
            label="Estado de la rutina"
            options={ROUTINE_STATUSES}
            value={routine.status}
            onChange={(e) => handleStatusChange(e.target.value)}
          />
        </Card>

        {/* Objetivo */}
        <Card>
          <CardTitle className="text-sm mb-2">Objetivo del Coach</CardTitle>
          <p className="text-sm text-ink-secondary whitespace-pre-wrap">{routine.objective}</p>
          {routine.notes && (
            <>
              <CardTitle className="text-sm mb-2 mt-4">Aclaraciones importantes</CardTitle>
              <p className="text-sm text-ink-secondary whitespace-pre-wrap">{routine.notes}</p>
            </>
          )}
        </Card>

        {/* Acciones */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            icon={<Dumbbell className="h-4 w-4" />}
            onClick={() => navigate(`/routines/${id}/editor`)}
            className="w-full"
          >
            Armar rutina
          </Button>
          <Button
            variant="secondary"
            icon={<FileText className="h-4 w-4" />}
            onClick={() => navigate('/routine-pdfs')}
            className="w-full"
          >
            Ver PDF
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="¿Eliminar rutina?"
        description="Se eliminarán todos los bloques, días y ejercicios asociados. Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        loading={deleting}
      />
    </div>
  )
}

function MetricBox({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-surface-elevated rounded-xl p-3 text-center">
      <p className="text-xs text-ink-muted mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-status-expiring' : 'text-ink-primary'}`}>{value}</p>
    </div>
  )
}
