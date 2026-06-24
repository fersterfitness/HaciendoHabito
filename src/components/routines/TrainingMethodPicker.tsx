import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, BookOpen, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Textarea } from '@/components/ui/Input'
import { Popover } from '@/components/ui/Popover'
import type { RoutineExercise, TrainingMethod, TrainingMethodCategory } from '@/types/database'
import { cn } from '@/lib/utils'

type MethodRow = TrainingMethod & { category?: TrainingMethodCategory | null }

type Props = {
  exercise: Pick<
    RoutineExercise,
    'training_method_id' | 'method_coach_notes' | 'reps_scheme' | 'sets'
  >
  onApply: (patch: Partial<RoutineExercise>) => void
  /** Aplica el plan por semana del método al mismo ejercicio en todas las semanas. */
  onApplyWeekPlan?: (method: TrainingMethod) => void
  /** Aplica el plan por semana a todas las semanas y todos los días. */
  onApplyWeekPlanAllDays?: (method: TrainingMethod) => void
}

export function TrainingMethodPicker({ exercise, onApply, onApplyWeekPlan, onApplyWeekPlanAllDays }: Props) {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [methods, setMethods] = useState<MethodRow[]>([])
  const [loading, setLoading] = useState(false)
  const [coachNotes, setCoachNotes] = useState(exercise.method_coach_notes ?? '')
  const [showCoachNotes, setShowCoachNotes] = useState(false)

  const selected = useMemo(
    () => methods.find((m) => m.id === exercise.training_method_id) ?? null,
    [methods, exercise.training_method_id],
  )

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('training_methods')
      .select('*, category:training_method_categories(*)')
      .eq('owner_id', user.id)
      .order('sort_order')
    setMethods((data as unknown as MethodRow[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  useEffect(() => {
    setCoachNotes(exercise.method_coach_notes ?? '')
  }, [exercise.method_coach_notes, exercise.training_method_id])

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; items: MethodRow[] }>()
    for (const m of methods) {
      const key = m.category_id ?? '__none__'
      const label = m.category?.name ?? 'Sin categoría'
      if (!map.has(key)) map.set(key, { label, items: [] })
      map.get(key)!.items.push(m)
    }
    return Array.from(map.values())
  }, [methods])

  function applyMethod(m: MethodRow) {
    const patch: Partial<RoutineExercise> = {
      training_method_id: m.id,
      method_coach_notes: coachNotes.trim() || m.coach_guide || null,
    }
    if (m.default_reps_scheme) patch.reps_scheme = m.default_reps_scheme
    if (m.default_sets != null) patch.sets = m.default_sets
    onApply(patch)
    setOpen(false)
    setShowCoachNotes(true)
  }

  function clearMethod() {
    onApply({ training_method_id: null, method_coach_notes: null })
    setCoachNotes('')
    setShowCoachNotes(false)
  }

  function saveCoachNotesQuiet() {
    onApply({ method_coach_notes: coachNotes.trim() || null })
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Popover
          open={open}
          onOpenChange={setOpen}
          className="min-w-[14rem] max-w-[min(calc(100vw-2rem),18rem)] p-2 max-h-[min(50vh,20rem)] overflow-y-auto"
          trigger={({ ref, onClick, ...a11y }) => (
            <button
              ref={ref}
              type="button"
              onClick={onClick}
              {...a11y}
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[10px] font-semibold transition-colors',
                selected
                  ? 'border-brand-secondary/35 bg-brand-secondary/10 text-brand-secondary'
                  : 'border-surface-border bg-surface-elevated text-ink-secondary hover:border-brand-secondary/30',
              )}
            >
              <BookOpen className="h-3 w-3" aria-hidden />
              {selected ? selected.name : 'Seleccionar método'}
              <ChevronDown className="h-3 w-3 opacity-70" aria-hidden />
            </button>
          )}
        >
          {loading ? (
            <p className="px-2 py-3 text-xs text-ink-muted">Cargando…</p>
          ) : methods.length === 0 ? (
            <p className="px-2 py-3 text-xs text-ink-muted leading-relaxed">
              No hay métodos. Cargalos en Ejercicios → Métodos.
            </p>
          ) : (
            grouped.map((g) => (
              <div key={g.label} className="mb-2 last:mb-0">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                  {g.label}
                </p>
                {g.items.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => applyMethod(m)}
                    className="flex w-full flex-col items-start rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-surface-elevated"
                  >
                    <span className="font-medium text-ink-primary">{m.name}</span>
                    {m.default_reps_scheme ? (
                      <span className="text-[10px] text-ink-muted">Reps: {m.default_reps_scheme}</span>
                    ) : null}
                    {Array.isArray(m.week_plan) && m.week_plan.length > 0 ? (
                      <span className="text-[10px] font-medium text-brand-secondary">
                        Plan por semana ({m.week_plan.length})
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </Popover>
        {selected && Array.isArray(selected.week_plan) && selected.week_plan.length > 0 && onApplyWeekPlan ? (
          <button
            type="button"
            onClick={() => onApplyWeekPlan(selected)}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-brand-secondary/35 bg-brand-secondary/10 px-2 text-[10px] font-semibold text-brand-secondary hover:bg-brand-secondary/20"
            title="Copiar reps, %, RPE, RIR, descanso y aclaración de cada semana a todas las semanas (este día)"
          >
            Aplicar a las semanas ({selected.week_plan.length})
          </button>
        ) : null}
        {selected && Array.isArray(selected.week_plan) && selected.week_plan.length > 0 && onApplyWeekPlanAllDays ? (
          <button
            type="button"
            onClick={() => onApplyWeekPlanAllDays(selected)}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-brand-primary/35 bg-brand-primary/10 px-2 text-[10px] font-semibold text-brand-primary hover:bg-brand-primary/20"
            title="Aplicar el plan a todas las semanas y todos los días donde esté este ejercicio"
          >
            A todas las semanas y días
          </button>
        ) : null}
        {selected ? (
          <button
            type="button"
            onClick={clearMethod}
            className="inline-flex h-7 items-center gap-0.5 rounded-lg px-1.5 text-[10px] text-ink-muted hover:text-status-expired"
            title="Quitar método"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setShowCoachNotes((v) => !v)}
          className="text-[10px] text-ink-muted underline-offset-2 hover:text-brand-secondary hover:underline"
        >
          {showCoachNotes || coachNotes ? 'Guía (solo vos)' : null}
        </button>
      </div>
      {(showCoachNotes || selected || coachNotes) && (
        <div className="rounded-xl border border-dashed border-brand-secondary/25 bg-brand-secondary/5 px-2 py-2">
          <p className="text-[10px] font-medium text-brand-secondary mb-1">Guía privada — no aparece en el PDF</p>
          {selected?.coach_guide && !coachNotes ? (
            <p className="text-[10px] text-ink-secondary whitespace-pre-wrap mb-2">{selected.coach_guide}</p>
          ) : null}
          <Textarea
            rows={4}
            placeholder="Notas sobre cómo aplicar este método en este ejercicio…"
            value={coachNotes}
            onChange={(e) => setCoachNotes(e.target.value)}
            onBlur={saveCoachNotesQuiet}
            className="min-h-[5rem] resize-y text-xs"
          />
        </div>
      )}
    </div>
  )
}
