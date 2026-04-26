import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Dumbbell, Search } from 'lucide-react'
import { useRoutines } from '@/hooks/useRoutines'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate, daysUntil } from '@/lib/utils'
import type { Routine } from '@/types/database'

type RoutineWithStudent = Routine & { student?: { full_name: string } }

export function RoutinesPage() {
  const navigate = useNavigate()
  const { routines, loading, fetchRoutines } = useRoutines()
  const [search, setSearch] = useState('')

  useEffect(() => { fetchRoutines() }, [fetchRoutines])

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

      <div className="px-4 lg:px-6 py-6 space-y-6 max-w-5xl">
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
                  {activas.map((r) => <RoutineCard key={r.id} routine={r} onClick={() => navigate(`/routines/${r.id}`)} />)}
                </div>
              </section>
            )}
            {inactivas.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">
                  Historial ({inactivas.length})
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {inactivas.map((r) => <RoutineCard key={r.id} routine={r} onClick={() => navigate(`/routines/${r.id}`)} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function RoutineCard({ routine, onClick }: { routine: RoutineWithStudent; onClick: () => void }) {
  const days = daysUntil(routine.end_date)
  return (
    <Card hover onClick={onClick} className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-ink-muted truncate">{routine.name}</p>
          <p className="text-base font-bold text-ink-primary truncate">
            {(routine as RoutineWithStudent).student?.full_name ?? '—'}
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
    </Card>
  )
}
