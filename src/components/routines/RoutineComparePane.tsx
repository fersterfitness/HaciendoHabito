import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { IconButton } from '@/components/ui/IconButton'
import { Spinner } from '@/components/ui/Spinner'
import { SegmentedV2 } from '@/components/v2/ui'
import { ROUTINE_STATUSES } from '@/lib/constants'
import { cn, formatDate } from '@/lib/utils'
import { exerciseDetails, groupExercises, setsRepsText, type SharedRoutineExercise } from '@/lib/routine/sharedRoutine'
import { fetchRoutineExerciseLogs, type ExerciseLogsByExercise, type ExerciseSetLog } from '@/lib/routine/exerciseLogs'
import { fetchRoutineTrainingExtras, type ExerciseFeedback, type TrainingExtras } from '@/lib/routine/studentTrainingLog'
import { FACTORY_PROFILE, loadVolumeData, type VolumeData } from '@/lib/volume/volumeData'
import { computeWeekVolume, VOLUME_STATUS_COLOR, type VolumeExerciseInput } from '@/lib/volume/trainingVolume'
import { compareWeekVolume } from '@/lib/volume/compareVolume'

/** Semana con lo que necesita el cálculo de volumen. */
export type VolumeWeekInput = {
  sort_order: number
  name: string | null
  days: { id: string; day_name: string; sort_order: number; exercises: VolumeExerciseInput[] }[]
}

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
  currentBlocks,
  onClose,
  className,
}: {
  studentId: string
  currentRoutineId: string
  currentStartDate: string | null
  /** Semanas de la rutina que se está armando, para comparar el volumen. */
  currentBlocks?: VolumeWeekInput[]
  onClose: () => void
  className?: string
}) {
  // Feedback nov3: además de la rutina (y lo que completó el alumno), comparar el volumen.
  const [view, setView] = useState<'rutina' | 'volumen'>('rutina')
  const [options, setOptions] = useState<RoutineOption[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [blocks, setBlocks] = useState<CompareBlock[] | null>(null)
  const [week, setWeek] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Lo que el alumno anotó en esa rutina (kilos y repeticiones por serie), para ver de dónde viene.
  const [logs, setLogs] = useState<ExerciseLogsByExercise>(new Map())
  const [extras, setExtras] = useState<TrainingExtras | null>(null)

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
    setLogs(new Map())
    void fetchRoutineExerciseLogs(selected).then((m) => {
      if (alive) setLogs(m)
    })
    setExtras(null)
    void fetchRoutineTrainingExtras(selected).then((m) => {
      if (alive) setExtras(m)
    })
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

      {currentBlocks && options && options.length > 0 ? (
        <div className="border-b border-surface-border px-4 py-2.5">
          <SegmentedV2
            size="sm"
            value={view}
            options={[
              { value: 'rutina', label: 'Rutina y lo que hizo' },
              { value: 'volumen', label: 'Volumen' },
            ]}
            onChange={(v) => setView(v)}
          />
        </div>
      ) : null}

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
        ) : view === 'volumen' && currentBlocks && selected ? (
          <CompareVolume studentId={studentId} routineId={selected} weekIndex={week} weekLabel={block.name || `Semana ${week + 1}`} currentBlocks={currentBlocks} />
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
                  {extras?.days[day.id]?.status === 'done' ? (
                    <span className="ml-auto shrink-0 rounded-full bg-status-ok/15 px-2 py-0.5 text-3xs font-medium text-status-ok-ink">
                      Terminado{extras.days[day.id]!.effort != null ? ` · ${extras.days[day.id]!.effort}/10` : ''}
                    </span>
                  ) : extras?.days[day.id]?.status === 'missed' ? (
                    <span className="ml-auto shrink-0 rounded-full bg-status-expired/15 px-2 py-0.5 text-3xs font-medium text-status-expired" title={extras.days[day.id]!.missed_reason || undefined}>
                      No entrenó
                    </span>
                  ) : null}
                </header>
                {day.exercises.length === 0 ? (
                  <p className="px-3 py-2 text-2xs text-ink-muted">Sin ejercicios.</p>
                ) : (
                  <ol className="divide-y divide-surface-border">
                    {groupExercises(day.exercises).map((g, gi) => (
                      <li key={gi} className={cn(g.circuit && 'border-l-2 border-ink-muted/40')}>
                        {g.circuit ? <p className="px-3 pt-2 text-3xs font-medium text-ink-muted">Circuito</p> : null}
                        {g.items.map((ex) => (
                          <CompareExercise key={ex.id} ex={ex} logs={logs.get(ex.id) ?? []} feedback={extras?.exercises[ex.id] ?? null} />
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

const fmtKg = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',')

/** «80 kg × 10 · 90 kg × 10», o cuántas series marcó si no anotó kilos ni repeticiones. */
function studentLogText(logs: ExerciseSetLog[]): string | null {
  const perSet = logs
    .filter((l) => l.weight_kg != null || l.reps != null)
    .map((l) => [l.weight_kg != null ? `${fmtKg(l.weight_kg)} kg${l.weight_mode === 'lado' ? ' por lado' : ''}` : '', l.reps != null ? `× ${l.reps}` : ''].filter(Boolean).join(' '))
  if (perSet.length) return perSet.join(' · ')
  const done = logs.filter((l) => l.completed).length
  return done ? `${done} ${done === 1 ? 'serie hecha' : 'series hechas'}, sin kilos anotados` : null
}

function CompareExercise({ ex, logs, feedback }: { ex: SharedRoutineExercise; logs: ExerciseSetLog[]; feedback: ExerciseFeedback | null }) {
  const main = setsRepsText(ex)
  const { chips, seriesPlan, notes } = exerciseDetails(ex)
  const logged = studentLogText(logs)
  return (
    <div className="px-3 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-body-sm font-medium text-ink-primary">{ex.name ?? 'Ejercicio'}</p>
        {main ? <span className="shrink-0 text-body-sm tabular-nums text-ink-secondary">{main}</span> : null}
      </div>
      {chips.length > 0 ? <p className="mt-0.5 text-2xs text-ink-muted">{chips.join(' · ')}</p> : null}
      {seriesPlan ? <p className="mt-0.5 text-2xs text-ink-muted">{seriesPlan}</p> : null}
      {notes ? <p className="mt-0.5 line-clamp-2 text-2xs text-ink-muted">{notes}</p> : null}
      {logged ? (
        <p className="mt-1.5 rounded-lg bg-status-ok/10 px-2 py-1 text-2xs text-ink-secondary">
          <span className="font-semibold text-status-ok-ink">Anotó el alumno</span> <span className="tabular-nums text-ink-primary">{logged}</span>
        </p>
      ) : null}
      {feedback && (feedback.note || feedback.effort != null) ? (
        <p className="hh-pastel mt-1 rounded-lg bg-pastel-butter px-2 py-1 text-2xs text-pastel-butter-ink">
          <span className="font-semibold">Dijo el alumno</span>
          {feedback.effort != null ? ` · esfuerzo ${feedback.effort}/10` : ''}
          {feedback.note ? ` · «${feedback.note}»` : ''}
        </p>
      ) : null}
    </div>
  )
}

const bySortOrder = <T extends { sort_order: number }>(list: T[]) => [...list].sort((a, b) => a.sort_order - b.sort_order)
const fmtSets = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',')

/** Series efectivas por músculo: la semana elegida de la otra rutina contra una semana de la que se arma. */
function CompareVolume({
  studentId,
  routineId,
  weekIndex,
  weekLabel,
  currentBlocks,
}: {
  studentId: string
  routineId: string
  weekIndex: number
  weekLabel: string
  currentBlocks: VolumeWeekInput[]
}) {
  const [weeks, setWeeks] = useState<VolumeWeekInput[] | null>(null)
  const [data, setData] = useState<VolumeData | null>(null)
  const [failed, setFailed] = useState(false)
  const [mine, setMine] = useState(0)
  const ordered = useMemo(() => bySortOrder(currentBlocks), [currentBlocks])

  useEffect(() => {
    let alive = true
    setWeeks(null)
    setFailed(false)
    Promise.all([
      supabase
        .from('routine_blocks')
        .select('*, days:routine_days(*, exercises:routine_exercises(*, exercise:exercise_library(name, muscle_group:muscle_groups(slug))))')
        .eq('routine_id', routineId)
        .order('sort_order'),
      loadVolumeData(studentId),
    ])
      .then(([res, vol]) => {
        if (!alive) return
        if (res.error) throw new Error(res.error.message)
        setWeeks((res.data ?? []) as VolumeWeekInput[])
        setData(vol)
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [routineId, studentId])

  const view = useMemo(() => {
    const other = weeks?.[weekIndex]
    const own = ordered[Math.min(mine, ordered.length - 1)]
    if (!other || !own || !data) return null
    const settings = (data.profiles.find((p) => p.is_default) ?? data.profiles[0] ?? FACTORY_PROFILE).settings
    const ctx = { settings, factorOverrides: data.factorOverrides, methodNames: data.methodNames }
    const before = computeWeekVolume(bySortOrder(other.days ?? []), ctx)
    const now = computeWeekVolume(bySortOrder(own.days ?? []), ctx)
    return { rows: compareWeekVolume(before, now, settings), totalBefore: before.totalSets, totalNow: now.totalSets }
  }, [weeks, weekIndex, ordered, mine, data])

  if (failed) return <p className="py-6 text-center text-body-sm text-ink-muted">No se pudo calcular el volumen.</p>
  if (!weeks || !data)
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    )
  if (ordered.length === 0) return <p className="py-6 text-center text-body-sm text-ink-muted">La rutina que estás armando todavía no tiene semanas.</p>

  return (
    <div className="space-y-3">
      {ordered.length > 1 ? (
        <div>
          <p className="mb-1.5 text-2xs text-ink-muted">Semana de esta rutina</p>
          <SegmentedV2
            size="sm"
            value={String(mine)}
            options={ordered.map((b, i) => ({ value: String(i), label: b.name?.trim() || `Semana ${i + 1}` }))}
            onChange={(v) => setMine(Number(v))}
          />
        </div>
      ) : null}
      {!view ? (
        <p className="py-6 text-center text-body-sm text-ink-muted">Sin datos para comparar.</p>
      ) : (
        <>
          <p className="text-2xs text-ink-muted">
            Series efectivas por músculo. Antes: {weekLabel} de la otra rutina ({fmtSets(view.totalBefore)} series en total). Ahora: {fmtSets(view.totalNow)} series en total.
          </p>
          {view.rows.length === 0 ? (
            <p className="py-6 text-center text-body-sm text-ink-muted">Ninguna de las dos semanas suma volumen.</p>
          ) : (
            <table className="w-full text-body-sm">
              <thead>
                <tr className="text-left text-3xs font-semibold uppercase text-ink-muted">
                  <th className="py-1.5 font-semibold">Músculo</th>
                  <th className="py-1.5 text-right font-semibold">Antes</th>
                  <th className="py-1.5 text-right font-semibold">Ahora</th>
                  <th className="py-1.5 text-right font-semibold">Dif.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {view.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1.5">
                      <span className="text-ink-primary">{r.label}</span>
                      <span className="ml-1.5 text-3xs text-ink-muted">
                        obj. {r.target.min}–{r.target.max}
                      </span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-ink-secondary">
                      <Dot color={VOLUME_STATUS_COLOR[r.statusBefore]} />
                      {fmtSets(r.before)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-semibold text-ink-primary">
                      <Dot color={VOLUME_STATUS_COLOR[r.statusNow]} />
                      {fmtSets(r.now)}
                    </td>
                    <td className={cn('py-1.5 text-right tabular-nums font-semibold', r.diff > 0 ? 'text-status-ok-ink' : r.diff < 0 ? 'text-status-expired' : 'text-ink-muted')}>
                      {r.diff > 0 ? '+' : ''}
                      {fmtSets(r.diff)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-3xs text-ink-muted">Punto: amarillo bajo el objetivo, verde en rango, rojo por encima.</p>
        </>
      )}
    </div>
  )
}

function Dot({ color }: { color: string }) {
  return <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: color }} />
}
