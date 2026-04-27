import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Dumbbell, Search, Pencil, Trash2 } from 'lucide-react'
import { useRoutines } from '@/hooks/useRoutines'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatDate, daysUntil } from '@/lib/utils'
import type { Routine } from '@/types/database'

type RoutineWithStudent = Routine & { student?: { full_name: string } }

export function RoutinesPage() {
  const navigate = useNavigate()
  const { routines, loading, fetchRoutines, deleteRoutine } = useRoutines()
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<RoutineWithStudent | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchRoutines() }, [fetchRoutines])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const ok = await deleteRoutine(deleteTarget.id)
    setDeleting(false)
    if (ok) { setDeleteTarget(null); fetchRoutines() }
  }

  const filtered = (routines as RoutineWithStudent[]).filter((r) =>
    r.student?.full_name.toLowerCase().includes(search.toLowerCase()) ||
    r.name.toLowerCase().includes(search.toLowerCase())
  )

  const activas = filtered.filter((r) => r.status === 'activa' || r.status === 'por_vencer')
  const inactivas = filtered.filter((r) => r.status !== 'activa' && r.status !== 'por_vencer')

  return (
    <div>
      <Header
        title="Rutinas"
        actions={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/routines/new')}>
            Nueva
          </Button>
        }
      />

      <div className="px-4 lg:px-6 py-6 space-y-6">
        <Input
          placeholder="Buscar por alumno o rutina..."
          leftIcon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Dumbbell className="h-8 w-8" />}
            title="No hay rutinas todavía"
            description="Creá la primera rutina para un alumno."
            action={{ label: 'Nueva rutina', onClick: () => navigate('/routines/new'), icon: <Plus className="h-4 w-4" /> }}
          />
        ) : (
          <>
            {activas.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">
                  Activas ({activas.length})
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activas.map((r) => (
                    <RoutineCard
                      key={r.id}
                      routine={r}
                      onClick={() => navigate(`/routines/${r.id}`)}
                      onEdit={() => navigate(`/routines/${r.id}/edit`)}
                      onDelete={() => setDeleteTarget(r)}
                    />
                  ))}
                </div>
              </section>
            )}
            {inactivas.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">
                  Historial ({inactivas.length})
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {inactivas.map((r) => (
                    <RoutineCard
                      key={r.id}
                      routine={r}
                      onClick={() => navigate(`/routines/${r.id}`)}
                      onEdit={() => navigate(`/routines/${r.id}/edit`)}
                      onDelete={() => setDeleteTarget(r)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="¿Eliminar rutina?"
        description={`Se eliminarán todos los bloques, días y ejercicios de "${deleteTarget?.name}". Esta acción no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        loading={deleting}
      />
    </div>
  )
}

function RoutineCard({
  routine,
  onClick,
  onEdit,
  onDelete,
}: {
  routine: RoutineWithStudent
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const days = daysUntil(routine.end_date)
  return (
    <Card className="flex flex-col gap-2 group">
      {/* Área clickable para ver detalle */}
      <button onClick={onClick} className="flex flex-col gap-2 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-ink-muted truncate">{routine.name}</p>
            <p className="text-base font-bold text-ink-primary truncate">
              {routine.student?.full_name ?? '—'}
            </p>
          </div>
          <Badge status={routine.status} />
        </div>
        <div className="text-xs text-ink-secondary">
          {formatDate(routine.start_date)} → {formatDate(routine.end_date)}
        </div>
        <div className="flex items-center justify-between">
          <Badge status={routine.level} />
          {(routine.status === 'activa' || routine.status === 'por_vencer') && days >= 0 && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${
              days <= 3 ? 'bg-status-expired/10 text-status-expired' :
              days <= 7 ? 'bg-status-expiring/10 text-status-expiring' :
              'bg-surface-elevated text-ink-muted'
            }`}>
              {days === 0 ? 'Vence hoy' : `${days} días`}
            </span>
          )}
        </div>
      </button>

      {/* Acciones */}
      <div className="flex items-center gap-1 pt-3 mt-1 border-t border-surface-border">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink-primary hover:bg-surface-elevated transition-colors px-2 py-1.5 rounded-lg"
        >
          <Pencil className="h-3.5 w-3.5" />
          Datos
        </button>
        <div className="flex-1" />
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-status-expired hover:bg-status-expired/10 transition-colors px-2 py-1.5 rounded-lg"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar
        </button>
      </div>
    </Card>
  )
}
