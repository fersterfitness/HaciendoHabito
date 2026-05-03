import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Dumbbell, Search, Pencil, Trash2, Copy } from 'lucide-react'
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
import type { Routine, Student } from '@/types/database'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'

type RoutineWithStudent = Routine & { student?: { full_name: string } }

export function RoutinesPage() {
  const navigate   = useNavigate()
  const { user }   = useAuthStore()
  const { routines, loading, fetchRoutines, deleteRoutine } = useRoutines()
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<RoutineWithStudent | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Duplicate routine ──
  const [duplicateTarget, setDuplicateTarget] = useState<RoutineWithStudent | null>(null)
  const [students, setStudents]               = useState<Student[]>([])
  const [dupStudentId, setDupStudentId]       = useState('')
  const [duplicating, setDuplicating]         = useState(false)

  useEffect(() => {
    if (!duplicateTarget || !user) return
    supabase
      .from('students')
      .select('id, full_name')
      .eq('owner_id', user.id)
      .order('full_name')
      .then(({ data }) => { setStudents((data as Student[]) ?? []); setDupStudentId('') })
  }, [duplicateTarget, user])

  async function handleDuplicate() {
    if (!duplicateTarget || !dupStudentId || !user) return
    setDuplicating(true)
    try {
      // 1. Load source blocks → days → exercises
      const { data: blocks } = await supabase
        .from('routine_blocks')
        .select('*')
        .eq('routine_id', duplicateTarget.id)
        .order('sort_order')
      const blockIds = (blocks ?? []).map((b) => b.id as string)
      const [{ data: days }, { data: exercises }] = await Promise.all([
        blockIds.length
          ? supabase.from('routine_days').select('*').in('block_id', blockIds).order('sort_order')
          : Promise.resolve({ data: [] }),
        blockIds.length
          ? supabase.from('routine_exercises').select('*').in('day_id',
              ((await supabase.from('routine_days').select('id').in('block_id', blockIds)).data ?? []).map((d) => d.id as string)
            ).order('sort_order')
          : Promise.resolve({ data: [] }),
      ])

      // 2. Insert new routine
      const { data: newRoutine, error: routineErr } = await supabase
        .from('routines')
        .insert({
          owner_id:   user.id,
          student_id: dupStudentId,
          name:       `${duplicateTarget.name} (copia)`,
          objective:  duplicateTarget.objective,
          level:      duplicateTarget.level,
          start_date: duplicateTarget.start_date,
          end_date:   duplicateTarget.end_date,
          duration_days: duplicateTarget.duration_days,
          price:      duplicateTarget.price,
          status:     'activa',
          notes:      duplicateTarget.notes,
        })
        .select('id')
        .single()
      if (routineErr || !newRoutine) { toast.error(routineErr?.message ?? 'Error al duplicar'); return }

      // 3. Insert blocks + remap
      const blockIdMap = new Map<string, string>()
      for (const b of (blocks ?? [])) {
        const { data: nb } = await supabase
          .from('routine_blocks')
          .insert({ routine_id: newRoutine.id, name: b.name, sort_order: b.sort_order, notes: b.notes, start_date: b.start_date, end_date: b.end_date })
          .select('id').single()
        if (nb) blockIdMap.set(b.id as string, nb.id as string)
      }

      // 4. Insert days + remap
      const dayIdMap = new Map<string, string>()
      for (const d of (days ?? [])) {
        const newBlockId = blockIdMap.get(d.block_id as string)
        if (!newBlockId) continue
        const { data: nd } = await supabase
          .from('routine_days')
          .insert({ block_id: newBlockId, day_name: d.day_name, day_of_week: d.day_of_week, muscle_focus: d.muscle_focus, warmup_notes: d.warmup_notes, sort_order: d.sort_order })
          .select('id').single()
        if (nd) dayIdMap.set(d.id as string, nd.id as string)
      }

      // 5. Insert exercises
      const exRows = (exercises ?? [])
        .map((ex) => {
          const newDayId = dayIdMap.get(ex.day_id as string)
          if (!newDayId) return null
          const { id: _id, day_id: _day, exercise: _ex, ...rest } = ex as Record<string, unknown>
          void _id; void _day; void _ex
          return { ...rest, day_id: newDayId }
        })
        .filter(Boolean)
      if (exRows.length) await supabase.from('routine_exercises').insert(exRows)

      toast.success('Rutina duplicada')
      fetchRoutines()
      setDuplicateTarget(null)
    } finally {
      setDuplicating(false)
    }
  }

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
                      onDuplicate={() => setDuplicateTarget(r)}
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
                      onDuplicate={() => setDuplicateTarget(r)}
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

      {/* Duplicate modal */}
      {duplicateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-surface-border bg-surface-card shadow-2xl p-5 space-y-4">
            <h2 className="text-base font-bold text-ink-primary">Duplicar rutina</h2>
            <p className="text-sm text-ink-secondary">
              <span className="font-medium text-ink-primary">"{duplicateTarget.name}"</span> será copiada con todos sus ejercicios a:
            </p>
            <select
              value={dupStudentId}
              onChange={(e) => setDupStudentId(e.target.value)}
              className="w-full rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary text-sm px-3 py-2.5"
            >
              <option value="">Seleccionar alumno...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDuplicateTarget(null)}
                className="px-4 py-2 rounded-xl text-sm text-ink-secondary hover:text-ink-primary border border-surface-border"
              >
                Cancelar
              </button>
              <Button
                size="sm"
                icon={<Copy className="h-3.5 w-3.5" />}
                onClick={handleDuplicate}
                loading={duplicating}
                disabled={!dupStudentId}
              >
                Duplicar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RoutineCard({
  routine,
  onClick,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  routine: RoutineWithStudent
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
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
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate() }}
          className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-brand-primary hover:bg-brand-primary/10 transition-colors px-2 py-1.5 rounded-lg"
          title="Duplicar a otro alumno"
        >
          <Copy className="h-3.5 w-3.5" />
          Duplicar
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
