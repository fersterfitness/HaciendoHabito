import { Clock, Columns2, Plus, Trash2 } from 'lucide-react'
import type { WeeklyPlanGridJson } from '@/lib/nutrition/weeklyPlanGrid'
import {
  addMealRow,
  columnLabels,
  columnCount,
  createEmptyWeeklyGrid,
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
  const days = columnLabels(mergeWeekends)
  const cols = columnCount(mergeWeekends)

  function updateCell(mealIdx: number, dayIdx: number, text: string) {
    const normalized = normalizeWeeklyGrid(grid, mergeWeekends)
    const meals = [...normalized.mealRows]
    if (!meals[mealIdx]) return
    const nextCols = [...meals[mealIdx].columns]
    nextCols[dayIdx] = text
    meals[mealIdx] = { ...meals[mealIdx], columns: nextCols }
    onGridChange({ mealRows: meals })
  }

  function updateMealField(mealIdx: number, key: 'label' | 'approxTime', text: string) {
    const normalized = normalizeWeeklyGrid(grid, mergeWeekends)
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

      <div className="overflow-x-auto -mx-1 px-1 pb-2">
        <div className="min-w-[720px] space-y-4">
          {normalizeWeeklyGrid(grid, mergeWeekends).mealRows.map((meal, mi) => (
            <div
              key={meal.id}
              className="rounded-2xl border border-surface-border overflow-hidden bg-surface-elevated/50 shadow-sm"
            >
              <div
                className="grid divide-x divide-surface-border"
                style={{
                  gridTemplateColumns: `minmax(120px, 150px) repeat(${cols}, minmax(110px, 1fr))`,
                }}
              >
                <div className="p-3 bg-brand-secondary/[0.06]">
                  <label className="flex items-center gap-1 text-[10px] uppercase text-ink-muted mb-1">
                    <Clock className="w-3 h-3" />
                    Comida
                  </label>
                  <input
                    value={meal.label}
                    onChange={(e) => updateMealField(mi, 'label', e.target.value)}
                    className={cn('w-full bg-surface-input border border-surface-inputBorder rounded-lg px-2 py-1.5 text-sm font-medium mb-2', planFocusClassName)}
                  />
                  <input
                    value={meal.approxTime}
                    onChange={(e) => updateMealField(mi, 'approxTime', e.target.value)}
                    placeholder="~10:00"
                    className={cn('w-full bg-surface-input border border-surface-inputBorder rounded-lg px-2 py-1 text-xs text-ink-muted mb-2', planFocusClassName)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = removeMealRowAt(normalizeWeeklyGrid(grid, mergeWeekends), mi)
                      onGridChange(next.mealRows.length ? next : createEmptyWeeklyGrid(mergeWeekends))
                    }}
                    className="text-[11px] text-status-expired inline-flex items-center gap-1 hover:underline"
                  >
                    <Trash2 className="w-3 h-3" />
                    Quitar comida
                  </button>
                </div>

                {meal.columns.map((cell, ci) => (
                  <div key={ci} className="flex flex-col min-h-[8rem] bg-surface-input/40">
                    <div className="text-[9px] font-semibold uppercase tracking-wide text-center py-1.5 bg-brand-secondary/10 text-brand-secondary border-b border-surface-border/80">
                      {days[ci]}
                    </div>
                    <textarea
                      value={cell}
                      onChange={(e) => updateCell(mi, ci, e.target.value)}
                      placeholder="Menú y orientaciones…"
                      rows={5}
                      className={cn(
                        'min-h-[6rem] w-full flex-1 resize-y whitespace-pre-wrap break-words px-2 py-2 text-xs leading-snug text-ink-primary',
                        'bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-brand-secondary/30',
                        planFocusClassName,
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onGridChange(addMealRow(normalizeWeeklyGrid(grid, mergeWeekends), mergeWeekends))}
        className="inline-flex items-center gap-2 text-sm font-medium text-brand-secondary hover:underline"
      >
        <Plus className="w-4 h-4" />
        Agregar momento / comida
      </button>
    </div>
  )
}
