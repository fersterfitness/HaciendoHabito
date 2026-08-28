import { Clock, Columns2, Plus, Trash2 } from 'lucide-react'
import type { WeeklyPlanGridJson } from '@/lib/nutrition/weeklyPlanGrid'
import {
  addMealRow,
  columnFullLabels,
  columnCount,
  createEmptyWeeklyGrid,
  dayAccent,
  filledMealCountForDay,
  normalizeWeeklyGrid,
  removeMealRowAt,
} from '@/lib/nutrition/weeklyPlanGrid'
import { cn } from '@/lib/utils'

const planFocusClassName =
  'focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary/25 outline-none'

interface Props {
  mergeWeekends: boolean
  onMergeWeekendsChange: (next: boolean) => void
  grid: WeeklyPlanGridJson
  onGridChange: (next: WeeklyPlanGridJson) => void
}

export function WeeklyPlanGridFields({ mergeWeekends, onMergeWeekendsChange, grid, onGridChange }: Props) {
  const days = columnFullLabels(mergeWeekends)
  const cols = columnCount(mergeWeekends)
  const normalized = normalizeWeeklyGrid(grid, mergeWeekends)

  function updateCell(mealIdx: number, dayIdx: number, text: string) {
    const meals = [...normalized.mealRows]
    if (!meals[mealIdx]) return
    const nextCols = [...meals[mealIdx].columns]
    nextCols[dayIdx] = text
    meals[mealIdx] = { ...meals[mealIdx], columns: nextCols }
    onGridChange({ mealRows: meals })
  }

  function updateMealField(mealIdx: number, key: 'label' | 'approxTime', text: string) {
    const meals = [...normalized.mealRows]
    if (!meals[mealIdx]) return
    meals[mealIdx] = { ...meals[mealIdx], [key]: text }
    onGridChange({ mealRows: meals })
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-ink-secondary">
        <input
          type="checkbox"
          className="rounded border-surface-inputBorder accent-brand-secondary"
          checked={mergeWeekends}
          onChange={(e) => onMergeWeekendsChange(e.target.checked)}
        />
        <Columns2 className="w-4 h-4 shrink-0" />
        Unificar sábado y domingo
      </label>

      <div className="flex flex-wrap items-center gap-2">
        {normalized.mealRows.map((meal, mi) => (
          <div
            key={meal.id}
            className="flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-2 py-1 shadow-sm"
          >
            <input
              value={meal.label}
              onChange={(e) => updateMealField(mi, 'label', e.target.value)}
              className={cn(
                'w-28 bg-transparent px-1 py-0.5 text-[12px] font-semibold text-ink-primary',
                planFocusClassName,
              )}
              aria-label="Nombre de la comida"
            />
            <span className="text-ink-muted">·</span>
            <Clock className="h-3 w-3 text-ink-muted" aria-hidden />
            <input
              value={meal.approxTime}
              onChange={(e) => updateMealField(mi, 'approxTime', e.target.value)}
              placeholder="hora"
              className={cn('w-14 bg-transparent py-0.5 text-[11px] text-ink-muted', planFocusClassName)}
              aria-label="Horario aproximado"
            />
            <button
              type="button"
              onClick={() => {
                const next = removeMealRowAt(normalized, mi)
                onGridChange(next.mealRows.length ? next : createEmptyWeeklyGrid(mergeWeekends))
              }}
              className="rounded-full p-0.5 text-ink-muted hover:bg-rose-50 hover:text-rose-500"
              aria-label={`Quitar ${meal.label}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onGridChange(addMealRow(normalized, mergeWeekends))}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-surface-border px-2.5 py-1 text-[12px] font-medium text-brand-secondary hover:bg-brand-secondary/5"
        >
          <Plus className="h-3.5 w-3.5" />
          Comida
        </button>
      </div>

      <div className="overflow-x-auto -mx-1 rounded-2xl bg-slate-50/80 px-2 py-3 dark:bg-zinc-950/40">
        <div
          className="grid min-w-[54rem] items-stretch gap-x-2.5 gap-y-2.5"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(8.75rem, 1fr))` }}
        >
          {days.map((day, di) => {
            const accent = dayAccent(di, mergeWeekends)
            const count = filledMealCountForDay(normalized, di)
            return (
              <header key={`h-${day}`} className="flex items-center justify-between gap-2 px-0.5">
                <h3 className="text-[12px] font-bold tracking-tight text-ink-primary">{day}</h3>
                <span
                  className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums"
                  style={{ backgroundColor: accent.wash, color: accent.color }}
                >
                  {count}
                </span>
              </header>
            )
          })}

          {normalized.mealRows.map((meal, mi) =>
            days.map((day, di) => {
              const accent = dayAccent(di, mergeWeekends)
              return (
                <div
                  key={`${meal.id}-${di}`}
                  className="flex h-full min-h-[8.5rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.06)] dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <div className="h-[5px] w-full shrink-0" style={{ backgroundColor: accent.color }} />
                  <div className="flex flex-1 flex-col p-2.5">
                    <p className="text-[12px] font-bold leading-tight text-ink-primary">{meal.label}</p>
                    {meal.approxTime.trim() ? (
                      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                        {meal.approxTime}
                      </p>
                    ) : null}
                    <textarea
                      value={meal.columns[di] ?? ''}
                      onChange={(e) => updateCell(mi, di, e.target.value)}
                      placeholder="Menú…"
                      rows={4}
                      className={cn(
                        'mt-2 min-h-[4.5rem] w-full flex-1 resize-y rounded-lg border-0 bg-slate-50/80 px-2 py-1.5 text-[12px] leading-relaxed text-ink-primary placeholder:text-ink-muted',
                        planFocusClassName,
                      )}
                    />
                  </div>
                </div>
              )
            }),
          )}
        </div>
      </div>
    </div>
  )
}
