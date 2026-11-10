import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { IconButton } from '@/components/ui/IconButton'
import { Spinner } from '@/components/ui/Spinner'
import { SegmentedV2 } from '@/components/v2/ui'
import { ROUTINE_STATUSES } from '@/lib/constants'
import { cn, formatDate } from '@/lib/utils'
import { exerciseDetails, groupExercises, setsRepsText, type SharedRoutineExercise } from '@/lib/routine/sharedRoutine'

type RoutineOption = { id: string; name: string; status: string; start_date: string | null }

type CompareDay = {
  id: string
  day_name: string
  muscle_focus: string | null
  sort_order: number
  exercises: (SharedRoutineExercise & { sort_order: number })[]
}
type CompareBlock = { id: string; name: string; sort_order: number; start_date: string | null; end_date: string | null; days: CompareDay[] }

type RawExercise = Omit<SharedRoutineExercise, 'name' | 'image_url'> & { sort_order: number; exercise?: { name: string | null } | null }
type RawBlock = Omit<CompareBlock, 'days'> & { days: (Omit<CompareDay, 'exercises'> & { exercises: RawExercise[] })[] }

const STATUS_LABEL: Record<string, string> = Object.fromEntries(ROUTINE_STATUSES.map((s) => [s.value, s.label]))

/** Por defecto: la rutina más reciente que empezó antes que la que se está armando. */
function pickDefault(list: RoutineOption[], currentStart: string | null): string | null {
  if (list.length === 0) return null
  const before = currentStart ? list.find((r) => r.start_date && r.start_date <= currentStart) : undefined
  return (before ?? list[0]!).id
}

function bySort<T extends { sort_order: number }>(a: T, b: T) {
  return a.sort_order - b.sort_order
}

/**
 * v2 · Otra rutina del mismo alumno en modo lectura, al lado del editor. Sirve para armar la
 * rutina nueva mirando la anterior (ejercicios, cargas, series) sin cambiar de pantalla.
 */
export function RoutineComparePane({
  studentId,
  currentRoutineId,
  currentStartDate,
  onClose,
  className,
}: {
  studentId: string
  currentRoutineId: string
  currentStartDate: string | null
  onClose: () => void
  className?: string
}) {
  const [options, setOptions] = useState<RoutineOption[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [blocks, setBlocks] = useState<CompareBlock[] | null>(null)
  const [week, setWeek] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const { data, error: err } = await supabase
        .from('routines')
        .select('id, name, status, start_date')
        .eq('student_id', studentId)
        .neq('id', currentRoutineId)
        .order('start_date', { ascending: false })
      if (!alive) return
      if (err) {
        setError(err.message)
        setOptions([])
        return
      }
      const list = (data ?? []) as RoutineOption[]
      setOptions(list)
      setSelected(pickDefault(list, currentStartDate))
    })()
    return () => {
      alive = false
    }
  }, [studentId, currentRoutineId, currentStartDate])

  useEffect(() => {
    if (!selected) return
    let alive = true
    setBlocks(null)
    void (async () => {
      const { data, error: err } = await supabase
        .from('routine_blocks')
        .select(
          'id, name, sort_order, start_date, end_date, days:routine_days(id, day_name, muscle_focus, sort_order, exercises:routine_exercises(id, sort_order, sets, reps_min, reps_max, reps_scheme, weight_kg, rir, rpe, rest_seconds, tempo, percent_rm, technical_notes, is_superset, superset_group, video_url, exercise:exercise_library(name)))',
        )
        .eq('routine_id', selected)
        .order('sort_order')
      if (!alive) return
      if (err) {
        setError(err.message)
        setBlocks([])
        return
      }
      const list: CompareBlock[] = ((data ?? []) as unknown as RawBlock[]).map((b) => ({
        ...b,
        days: [...(b.days ?? [])].sort(bySort).map((d) => ({
          ...d,
          exercises: [...(d.exercises ?? [])].sort(bySort).map(({ exercise, ...ex }) => ({ ...ex, name: exercise?.name ?? null, image_url: null })),
        })),
      }))
      setError(null)
      setBlocks(list)
      // La última semana es donde quedó el alumno: de ahí se suele progresar.
      setWeek(Math.max(0, list.length - 1))
    })()
    return () => {
      alive = false
    }
  }, [selected])

  const block = blocks?.[week] ?? null
  const current = useMemo(() => options?.find((o) => o.id === selected) ?? null, [options, selected])

  return (
    <aside aria-label="Rutina para comparar" className={cn('flex min-h-0 flex-col bg-surface-card', className)}>
      <div className="flex items-start gap-2 border-b border-surface-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-2xs text-ink-muted">Comparar con</p>
          {options && options.length > 0 ? (
            <select
              aria-label="Rutina para comparar"
              value={selected ?? ''}
              onChange={(e) => setSelected(e.target.value)}
              className="mt-1 h-9 w-full truncate rounded-lg border border-surface-border bg-surface-elevated px-3 text-body-sm font-medium text-ink-primary outline-none focus-visible:ring-2 focus-visible:ring-ink-primary/20"
            >
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.start_date ? ` · ${formatDate(o.start_date)}` : ''}
                  {` · ${STATUS_LABEL[o.status] ?? o.status}`}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <IconButton label="Cerrar comparación" icon={<X className="h-4 w-4" />} onClick={onClose} className="-mr-1" />
      </div>

      {blocks && blocks.length > 1 ? (
        <div className="border-b border-surface-border px-4 py-2.5">
          <SegmentedV2
            size="sm"
            value={String(week)}
            options={blocks.map((b, i) => ({ value: String(i), label: b.name || `Semana ${i + 1}` }))}
            onChange={(v) => setWeek(Number(v))}
          />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {error ? (
          <p className="text-body-sm text-status-expired">{error}</p>
        ) : options === null || (selected && blocks === null) ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : options.length === 0 ? (
          <p className="py-6 text-center text-body-sm text-ink-muted">El alumno no tiene otras rutinas para comparar.</p>
        ) : !block ? (
          <p className="py-6 text-center text-body-sm text-ink-muted">Esta rutina no tiene semanas cargadas.</p>
        ) : (
          <div className="space-y-4">
            {block.start_date || current ? (
              <p className="text-2xs text-ink-muted">
                {block.start_date ? `${formatDate(block.start_date)}${block.end_date ? ` – ${formatDate(block.end_date)}` : ''}` : current?.name}
              </p>
            ) : null}
            {block.days.length === 0 ? <p className="text-body-sm text-ink-muted">Semana sin días.</p> : null}
            {block.days.map((day) => (
              <section key={day.id} className="rounded-xl border border-surface-border">
                <header className="flex items-baseline gap-2 border-b border-surface-border px-3 py-2">
                  <h3 className="text-body-sm font-semibold text-ink-primary">{day.day_name}</h3>
                  {day.muscle_focus ? <span className="truncate text-2xs text-ink-muted">{day.muscle_focus}</span> : null}
                </header>
                {day.exercises.length === 0 ? (
                  <p className="px-3 py-2 text-2xs text-ink-muted">Sin ejercicios.</p>
                ) : (
                  <ol className="divide-y divide-surface-border">
                    {groupExercises(day.exercises).map((g, gi) => (
                      <li key={gi} className={cn(g.circuit && 'border-l-2 border-ink-muted/40')}>
                        {g.circuit ? <p className="px-3 pt-2 text-3xs font-medium text-ink-muted">Circuito</p> : null}
                        {g.items.map((ex) => (
                          <CompareExercise key={ex.id} ex={ex} />
                        ))}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

function CompareExercise({ ex }: { ex: SharedRoutineExercise }) {
  const main = setsRepsText(ex)
  const { chips, seriesPlan, notes } = exerciseDetails(ex)
  return (
    <div className="px-3 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-body-sm font-medium text-ink-primary">{ex.name ?? 'Ejercicio'}</p>
        {main ? <span className="shrink-0 text-body-sm tabular-nums text-ink-secondary">{main}</span> : null}
      </div>
      {chips.length > 0 ? <p className="mt-0.5 text-2xs text-ink-muted">{chips.join(' · ')}</p> : null}
      {seriesPlan ? <p className="mt-0.5 text-2xs text-ink-muted">{seriesPlan}</p> : null}
      {notes ? <p className="mt-0.5 line-clamp-2 text-2xs text-ink-muted">{notes}</p> : null}
    </div>
  )
}
