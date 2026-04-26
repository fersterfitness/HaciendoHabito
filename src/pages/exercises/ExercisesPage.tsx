import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Dumbbell } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import type { Exercise, MuscleGroup } from '@/types/database'
import toast from 'react-hot-toast'

type ExerciseWithGroup = Exercise & { muscle_group?: MuscleGroup }

export function ExercisesPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [exercises, setExercises] = useState<ExerciseWithGroup[]>([])
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState<string>('')
  const [filterDifficulty, setFilterDifficulty] = useState<string>('')

  const fetchExercises = useCallback(async () => {
    const { data, error } = await supabase
      .from('exercise_library')
      .select('*, muscle_group:muscle_groups(*)')
      .order('name')
    if (error) toast.error(error.message)
    else setExercises((data as unknown as ExerciseWithGroup[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchExercises()
    supabase.from('muscle_groups').select('*').order('sort_order').then(({ data }) => setMuscleGroups(data ?? []))
  }, [fetchExercises])

  const filtered = exercises.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.muscle_group?.name.toLowerCase().includes(search.toLowerCase())
    const matchGroup = filterGroup === '' || e.muscle_group_id === filterGroup
    const matchDiff = filterDifficulty === '' || e.difficulty === filterDifficulty
    return matchSearch && matchGroup && matchDiff
  })

  const systemExercises = filtered.filter((e) => e.is_system)
  const customExercises = filtered.filter((e) => !e.is_system)

  return (
    <div>
      <Header
        title="Ejercicios"
        actions={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/exercises/new')}>
            Nuevo
          </Button>
        }
      />

      <div className="px-4 lg:px-6 py-6 max-w-4xl space-y-5">
        <div className="space-y-3">
          <Input
            placeholder="Buscar ejercicio o músculo..."
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-2 flex-wrap">
            <select
              className="bg-surface-card border border-surface-border text-ink-secondary text-xs rounded-xl px-3 py-1.5 focus:border-brand-primary outline-none"
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
            >
              <option value="">Todos los músculos</option>
              {muscleGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select
              className="bg-surface-card border border-surface-border text-ink-secondary text-xs rounded-xl px-3 py-1.5 focus:border-brand-primary outline-none"
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
            >
              <option value="">Todos los niveles</option>
              <option value="basico">Básico</option>
              <option value="intermedio">Intermedio</option>
              <option value="avanzado">Avanzado</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Dumbbell className="h-8 w-8" />}
            title="Sin ejercicios"
            description="Ajustá los filtros o creá un ejercicio personalizado."
            action={{ label: 'Nuevo ejercicio', onClick: () => navigate('/exercises/new'), icon: <Plus className="h-4 w-4" /> }}
          />
        ) : (
          <>
            {customExercises.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">
                  Mis ejercicios ({customExercises.length})
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {customExercises.map((ex) => (
                    <ExerciseCard key={ex.id} exercise={ex} onClick={() => navigate(`/exercises/${ex.id}/edit`)} canEdit />
                  ))}
                </div>
              </section>
            )}
            <section>
              <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">
                Biblioteca ({systemExercises.length})
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {systemExercises.map((ex) => (
                  <ExerciseCard key={ex.id} exercise={ex} onClick={() => {}} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function ExerciseCard({ exercise, onClick, canEdit = false }: {
  exercise: ExerciseWithGroup
  onClick: () => void
  canEdit?: boolean
}) {
  return (
    <Card hover={canEdit} onClick={canEdit ? onClick : undefined} className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink-primary leading-tight">{exercise.name}</p>
        <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
          exercise.difficulty === 'basico' ? 'bg-status-generated/10 text-status-generated' :
          exercise.difficulty === 'intermedio' ? 'bg-status-expiring/10 text-status-expiring' :
          'bg-status-expired/10 text-status-expired'
        }`}>
          {exercise.difficulty}
        </span>
      </div>
      {exercise.muscle_group && (
        <p className="text-xs text-ink-muted">{exercise.muscle_group.name}</p>
      )}
      {exercise.equipment && exercise.equipment.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {exercise.equipment.slice(0, 3).map((eq) => (
            <span key={eq} className="text-[10px] bg-surface-elevated text-ink-muted px-1.5 py-0.5 rounded-md">{eq}</span>
          ))}
        </div>
      )}
      {!exercise.is_active && (
        <Badge status="inactivo" size="sm" />
      )}
    </Card>
  )
}
