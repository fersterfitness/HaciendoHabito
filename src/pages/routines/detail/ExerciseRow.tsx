import { useEffect, useState } from 'react'
import { Trash2, GripVertical, Link2, Unlink, ArrowUp, ArrowDown, ExternalLink, RefreshCw } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import { type ExerciseMeta, type SeriesPlanEntry, parseExerciseMeta, buildExerciseTechnicalNotes } from '@/lib/routine/exerciseMeta'
import { isMultiarticularExercise } from '@/lib/routine/copyDayPrescriptions'
import { TrainingMethodPicker } from '@/components/routines/TrainingMethodPicker'
import type { RoutineExercise, TrainingMethod } from '@/types/database'
import { type ExWithExercise, parseRestToSeconds, parseRpeToNumber } from './routineDetailShared'

export function ExerciseRow({ exercise, onUpdate, onApplyMethodWeekPlan, onApplyMethodWeekPlanAllDays, onDelete, onMoveUp, onMoveDown, onReplace, rmKg, canCombine, onCombineWithNext, isSeparable, onSeparate }: {
  exercise: ExWithExercise
  onUpdate: (patch: Partial<RoutineExercise>) => void
  /** Aplica el plan por semana del método al mismo ejercicio en todas las semanas. */
  onApplyMethodWeekPlan?: (method: TrainingMethod) => void
  /** Aplica el plan por semana a todas las semanas y todos los días. */
  onApplyMethodWeekPlanAllDays?: (method: TrainingMethod) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  /** Sustituye solo el movimiento del catálogo; mantiene series, reps, etc. */
  onReplace?: () => void
  rmKg?: number
  canCombine?: boolean
  onCombineWithNext?: () => void
  isSeparable?: boolean
  onSeparate?: () => void
}) {
  // Local state — updates UI instantly
  const [sets, setSets]           = useState<number | null>(exercise.sets ?? null)
  const [reps, setReps]           = useState(exercise.reps_scheme ?? '')
  const initialMeta = parseExerciseMeta(exercise.technical_notes)
  const [restText, setRestText]   = useState(initialMeta.meta.restText ?? (exercise.rest_seconds !== null ? String(exercise.rest_seconds) : ''))
  const [weight, setWeight]       = useState<number | null>(exercise.weight_kg ?? null)
  const [rpeText, setRpeText]     = useState(initialMeta.meta.rpeText ?? (exercise.rpe !== null ? String(exercise.rpe) : ''))
  const [percent1rm, setPercent1rm] = useState(initialMeta.meta.percent1rm ?? '')
  const [seriesPlan, setSeriesPlan] = useState<SeriesPlanEntry[]>(initialMeta.meta.seriesPlan ?? [])
  const [notes, setNotes]         = useState(initialMeta.userNotes)
  const [videoUrl, setVideoUrl]   = useState(() => (exercise.video_url ?? '').trim())

  useEffect(() => {
    setVideoUrl((exercise.video_url ?? '').trim())
  }, [exercise.id, exercise.exercise_id, exercise.video_url])

  const libraryVideo = (exercise.exercise?.video_url ?? '').trim()
  const effectiveVideo = videoUrl || libraryVideo

  // Debounced save — fires 600ms after last keystroke
  const save = useDebounce(onUpdate, 600)
  const hasPercent = percent1rm.trim().length > 0
  const pctNum = hasPercent ? Number(percent1rm) : NaN
  const suggestedWeight =
    rmKg && hasPercent && !Number.isNaN(pctNum)
      ? Math.round(rmKg * (pctNum / 100) * 10) / 10
      : null
  const isMultiarticular = isMultiarticularExercise(exercise.exercise)

  /** Meta persistida en `technical_notes` (incl. circuitNote del circuito); no usar solo `initialMeta` del primer render. */
  function saveMeta(nextMeta: ExerciseMeta, overrides?: Partial<RoutineExercise>) {
    const base = parseExerciseMeta(exercise.technical_notes).meta
    const merged = { ...base, ...nextMeta }
    const technicalNotes = buildExerciseTechnicalNotes(notes, merged)
    save({ technical_notes: technicalNotes || null, ...overrides })
  }

  /** Multiarticulares: edita una serie del plan (%, reps o RPE/RIR); el kg sale del 1RM del alumno. */
  function patchSeriesPlan(idx: number, field: 'pct' | 'reps' | 'rpeRir', value: string) {
    const count = Math.min(Math.max(sets ?? 0, 0), 8)
    const next: SeriesPlanEntry[] = Array.from({ length: count }, (_, i) => ({ ...(seriesPlan[i] ?? {}) }))
    if (!next[idx]) return
    next[idx] = { ...next[idx], [field]: value }
    for (const s of next) {
      const p = Number((s.pct ?? '').replace(',', '.'))
      s.kg =
        rmKg && s.pct?.trim() && Number.isFinite(p) && p > 0
          ? String(Math.round(rmKg * (p / 100) * 10) / 10)
          : undefined
    }
    setSeriesPlan(next)
    // Sincroniza «Reps por serie» para guía/registro cuando todas las series tienen reps.
    const patch: Partial<RoutineExercise> = {}
    if (next.length > 0 && next.every((s) => s.reps?.trim())) {
      const joined = next.map((s) => s.reps!.trim()).join(',')
      patch.reps_scheme = joined
      setReps(joined)
    }
    saveMeta(
      { restText: restText || undefined, rpeText: rpeText || undefined, seriesPlan: next },
      patch,
    )
  }

  return (
    <div className="bg-surface-card rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <GripVertical className="h-3.5 w-3.5 text-ink-muted shrink-0" />
        <span className="flex-1 text-xs font-semibold text-ink-primary truncate">
          {exercise.exercise?.name ?? 'Ejercicio'}
        </span>
        {exercise.exercise?.muscle_group && (
          <span className="text-3xs text-ink-muted shrink-0">
            {(exercise.exercise.muscle_group as unknown as { name: string }).name}
          </span>
        )}
        {isSeparable && (
          <button
            onClick={onSeparate}
            title="Separar del circuito"
            className="text-status-expiring/60 hover:text-status-expiring transition-colors"
          >
            <Unlink className="h-3 w-3" />
          </button>
        )}
        {canCombine && (
          <button
            onClick={onCombineWithNext}
            title="Combinar con siguiente"
            className="text-ink-muted hover:text-brand-primary transition-colors"
          >
            <Link2 className="h-3 w-3" />
          </button>
        )}
        {onReplace && (
          <button
            type="button"
            onClick={onReplace}
            title="Cambiar ejercicio (se mantienen series, reps y prescripción)"
            className="text-ink-muted hover:text-brand-primary transition-colors shrink-0"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
        <button onClick={onMoveUp} title="Subir" className="text-ink-muted hover:text-ink-primary transition-colors">
          <ArrowUp className="h-3 w-3" />
        </button>
        <button onClick={onMoveDown} title="Bajar" className="text-ink-muted hover:text-ink-primary transition-colors">
          <ArrowDown className="h-3 w-3" />
        </button>
        <button onClick={onDelete} className="text-ink-muted hover:text-status-expired transition-colors">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className="block text-3xs text-ink-muted mb-0.5">Series</label>
          <input
            type="number" min={0}
            className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none text-center"
            value={sets ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value)
              setSets(v); save({ sets: v })
            }}
          />
        </div>
        <div>
          <label className="block text-3xs text-ink-muted mb-0.5">Reps por serie</label>
          <input
            type="text"
            placeholder="ej: 8 / 6 / 5"
            className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none placeholder:text-ink-muted"
            value={reps}
            onChange={(e) => { setReps(e.target.value); save({ reps_scheme: e.target.value || null }) }}
          />
        </div>
      </div>

      <TrainingMethodPicker
        exercise={exercise}
        onApply={(patch) => {
          if (patch.reps_scheme != null) setReps(patch.reps_scheme)
          if (patch.sets != null) setSets(patch.sets)
          save(patch)
        }}
        onApplyWeekPlan={onApplyMethodWeekPlan}
        onApplyWeekPlanAllDays={onApplyMethodWeekPlanAllDays}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <div>
          <label className="block text-3xs text-ink-muted mb-0.5">Descanso</label>
          <input
            type="text"
            placeholder="20'' / 2'"
            className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none text-center"
            value={restText}
            onChange={(e) => {
              const v = e.target.value
              setRestText(v)
              const parsed = parseRestToSeconds(v)
              saveMeta({ restText: v || undefined, rpeText: rpeText || undefined, percent1rm: percent1rm || undefined }, { rest_seconds: parsed })
            }}
          />
        </div>
        <div>
          <label className="block text-3xs text-ink-muted mb-0.5">Peso kg</label>
          <input
            type="number" min={0}
            className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none text-center"
            value={weight ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value)
              setWeight(v); save({ weight_kg: v })
            }}
          />
        </div>
        <div>
          <label className="block text-3xs text-ink-muted mb-0.5">1 RM (100%)</label>
          <div
            className={cn(
              'w-full rounded-lg px-2 py-1.5 border text-xs text-center font-semibold tabular-nums',
              rmKg != null
                ? 'border-brand-primary/35 bg-brand-primary/10 text-brand-primary'
                : 'border-surface-border bg-surface-elevated/50 text-ink-muted',
            )}
            title={
              rmKg != null
                ? '1RM del alumno (ficha → Fuerza / calculadora)'
                : 'Registrá el 1RM en la ficha del alumno (test o Epley)'
            }
          >
            {rmKg != null ? `${rmKg} kg` : '—'}
          </div>
        </div>
        <div>
          <label className="block text-3xs text-ink-muted mb-0.5">RPE / RIR</label>
          <input
            type="text"
            placeholder="RIR 8/9"
            className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none text-center"
            value={rpeText}
            onChange={(e) => {
              const v = e.target.value
              setRpeText(v)
              const parsed = parseRpeToNumber(v)
              saveMeta({ restText: restText || undefined, rpeText: v || undefined, percent1rm: percent1rm || undefined }, { rpe: parsed })
            }}
          />
        </div>
      </div>

      {/* Multiarticulares: plan serie por serie (%RM → kg desde 1RM, reps, RPE/RIR) */}
      {isMultiarticular && (sets ?? 0) > 0 ? (
        <div className="rounded-xl border border-brand-primary/25 bg-brand-primary/5 p-2">
          <p className="mb-1.5 text-3xs font-semibold uppercase tracking-wide text-brand-primary">
            Series por porcentaje {rmKg != null ? `· 1RM ${rmKg} kg` : '· sin 1RM en ficha (no calcula kg)'}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-center text-xs">
              <thead>
                <tr>
                  <th className="w-16 px-1 py-0.5 text-left text-3xs font-semibold uppercase text-ink-muted">Serie</th>
                  {Array.from({ length: Math.min(sets ?? 0, 8) }, (_, i) => (
                    <th key={i} className="px-1 py-0.5 text-3xs font-bold text-ink-secondary">{i + 1}°</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-1 py-0.5 text-left text-3xs font-semibold uppercase text-ink-muted">% RM</td>
                  {Array.from({ length: Math.min(sets ?? 0, 8) }, (_, i) => (
                    <td key={i} className="px-0.5 py-0.5">
                      <input
                        inputMode="decimal"
                        placeholder="%"
                        className="w-full rounded-md border border-surface-border bg-surface-elevated px-1 py-1 text-center text-xs text-ink-primary outline-none focus:border-brand-primary"
                        value={seriesPlan[i]?.pct ?? ''}
                        onChange={(e) => patchSeriesPlan(i, 'pct', e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-1 py-0.5 text-left text-3xs font-semibold uppercase text-ink-muted">Kg</td>
                  {Array.from({ length: Math.min(sets ?? 0, 8) }, (_, i) => (
                    <td key={i} className="px-0.5 py-0.5">
                      <div className="rounded-md border border-brand-primary/25 bg-brand-primary/10 px-1 py-1 text-xs font-semibold tabular-nums text-brand-primary">
                        {seriesPlan[i]?.kg ?? '—'}
                      </div>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-1 py-0.5 text-left text-3xs font-semibold uppercase text-ink-muted">Reps</td>
                  {Array.from({ length: Math.min(sets ?? 0, 8) }, (_, i) => (
                    <td key={i} className="px-0.5 py-0.5">
                      <input
                        inputMode="decimal"
                        className="w-full rounded-md border border-surface-border bg-surface-elevated px-1 py-1 text-center text-xs text-ink-primary outline-none focus:border-brand-primary"
                        value={seriesPlan[i]?.reps ?? ''}
                        onChange={(e) => patchSeriesPlan(i, 'reps', e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-1 py-0.5 text-left text-3xs font-semibold uppercase text-ink-muted">RPE/RIR</td>
                  {Array.from({ length: Math.min(sets ?? 0, 8) }, (_, i) => (
                    <td key={i} className="px-0.5 py-0.5">
                      <input
                        placeholder="6o7"
                        className="w-full rounded-md border border-surface-border bg-surface-elevated px-1 py-1 text-center text-xs text-ink-primary outline-none focus:border-brand-primary"
                        value={seriesPlan[i]?.rpeRir ?? ''}
                        onChange={(e) => patchSeriesPlan(i, 'rpeRir', e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-3xs text-ink-muted">
            Si no cargás nada acá, el ejercicio usa los campos comunes (peso / % único).
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
        <div>
          <label className="block text-3xs text-ink-muted mb-0.5">% del 1RM</label>
          <input
            type="number"
            min={1}
            max={100}
            placeholder="80"
            className="w-full bg-surface-elevated text-ink-primary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none text-center"
            value={percent1rm}
            onChange={(e) => {
              const v = e.target.value
              setPercent1rm(v)
              const n = Number(v)
              const suggested =
                rmKg && v.trim().length > 0 && !Number.isNaN(n)
                  ? Math.round(rmKg * (n / 100) * 10) / 10
                  : null
              if (isMultiarticular && suggested !== null) {
                setWeight(suggested)
                saveMeta(
                  {
                    restText: restText || undefined,
                    rpeText: rpeText || undefined,
                    percent1rm: v || undefined,
                  },
                  { weight_kg: suggested },
                )
              } else {
                saveMeta({
                  restText: restText || undefined,
                  rpeText: rpeText || undefined,
                  percent1rm: v || undefined,
                })
              }
            }}
          />
        </div>
        {!isMultiarticular ? (
          <button
            type="button"
            disabled={!suggestedWeight}
            onClick={() => {
              if (!suggestedWeight) return
              setWeight(suggestedWeight)
              save({ weight_kg: suggestedWeight })
            }}
            className="h-8 px-2.5 rounded-lg border border-surface-border text-2xs text-ink-secondary hover:text-ink-primary disabled:opacity-40"
          >
            {suggestedWeight ? `Aplicar ${suggestedWeight}kg` : rmKg ? 'Ingresá %' : 'Sin 1RM en ficha'}
          </button>
        ) : (
          <p className="h-8 flex items-center text-3xs text-ink-muted px-1">
            {suggestedWeight != null ? `${suggestedWeight} kg` : rmKg ? 'Ingresá %' : '—'}
          </p>
        )}
      </div>
      {rmKg != null && hasPercent && suggestedWeight != null ? (
        <p className="text-3xs text-ink-muted -mt-1">
          {isMultiarticular
            ? `${percent1rm}% de ${rmKg} kg → ${suggestedWeight} kg (carga automática)`
            : `${percent1rm}% de ${rmKg} kg → ${suggestedWeight} kg`}
        </p>
      ) : null}

      <input
        className="w-full bg-surface-elevated text-ink-secondary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none placeholder:text-ink-muted"
        placeholder="Notas técnicas..."
        value={notes}
        onChange={(e) => {
          const v = e.target.value
          setNotes(v)
          const baseMeta = parseExerciseMeta(exercise.technical_notes).meta
          const technicalNotes = buildExerciseTechnicalNotes(v, {
            ...baseMeta,
            restText: restText || undefined,
            rpeText: rpeText || undefined,
            percent1rm: percent1rm || undefined,
          })
          save({ technical_notes: technicalNotes || null })
        }}
      />
      <div>
        <label className="block text-3xs text-ink-muted mb-0.5">Video demostración (URL)</label>
        <input
          className="w-full bg-surface-elevated text-ink-secondary text-xs rounded-lg px-2 py-1.5 border border-surface-border focus:border-brand-primary outline-none placeholder:text-ink-muted"
          placeholder={libraryVideo ? `Vacío → se usa el de la biblioteca` : 'https://youtube.com/...'}
          value={videoUrl}
          onChange={(e) => {
            const v = e.target.value
            setVideoUrl(v)
            save({ video_url: v.trim() ? v.trim() : null })
          }}
        />
        {libraryVideo ? (
          <p className="mt-1 text-3xs text-ink-muted leading-snug">
            Biblioteca:{' '}
            <a
              href={libraryVideo}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-brand-primary hover:underline"
            >
              {libraryVideo.slice(0, 48)}
              {libraryVideo.length > 48 ? '…' : ''}
              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
            </a>
          </p>
        ) : null}
        {effectiveVideo ? (
          <a
            href={effectiveVideo.startsWith('http') ? effectiveVideo : `https://${effectiveVideo}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-3xs font-medium text-brand-primary hover:underline"
          >
            Abrir video en navegador
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
    </div>
  )
}
