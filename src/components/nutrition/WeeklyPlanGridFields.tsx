import { useState } from 'react'
import { Clock, Columns2, Plus, Trash2 } from 'lucide-react'
import type { MealMacros, WeeklyPlanGridJson } from '@/lib/nutrition/weeklyPlanGrid'
import {
  addMealRow,
  cleanMacros,
  columnFullLabels,
  columnCount,
  createEmptyWeeklyGrid,
  dayAccent,
  filledMealCountForDay,
  normalizeWeeklyGrid,
  removeMealRowAt,
} from '@/lib/nutrition/weeklyPlanGrid'
import { cn } from '@/lib/utils'
import { IS_V2 } from '@/lib/uiVersion'

const planFocusClassName =
  'focus:border-brand-secondary/50 focus:ring-1 focus:ring-brand-secondary/20 outline-none'

const MACRO_FIELDS: { key: keyof MealMacros; label: string; title: string }[] = [
  { key: 'kcal', label: 'kcal', title: 'Calorías' },
  { key: 'p', label: 'P', title: 'Proteínas (g)' },
  { key: 'c', label: 'C', title: 'Carbohidratos (g)' },
  { key: 'g', label: 'G', title: 'Grasas (g)' },
]

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

  function updateMacro(mealIdx: number, dayIdx: number, key: keyof MealMacros, text: string) {
    const meals = [...normalized.mealRows]
    const row = meals[mealIdx]
    if (!row) return
    const list = Array.from({ length: cols }, (_, i) => row.macros?.[i] ?? null)
    const prev = list[dayIdx] ?? { kcal: null, p: null, c: null, g: null }
    list[dayIdx] = cleanMacros({ ...prev, [key]: text.trim() === '' ? null : text })
    const { macros: _old, ...rest } = row
    void _old
    meals[mealIdx] = list.some(Boolean) ? { ...rest, macros: list } : rest
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
            className="flex items-center gap-1.5 rounded-full border border-surface-border bg-surface-card px-2.5 py-1"
          >
            <input
              value={meal.label}
              onChange={(e) => updateMealField(mi, 'label', e.target.value)}
              className={cn(
                'w-28 bg-transparent px-1 py-0.5 text-xs font-semibold text-ink-primary',
                planFocusClassName,
              )}
              aria-label="Nombre de la comida"
            />
            <span className="text-ink-muted/70">·</span>
            <Clock className="h-3 w-3 text-ink-muted" aria-hidden />
            <input
              value={meal.approxTime}
              onChange={(e) => updateMealField(mi, 'approxTime', e.target.value)}
              placeholder="hora"
              className={cn('w-24 min-w-0 bg-transparent py-0.5 text-2xs text-ink-secondary', planFocusClassName)}
              aria-label="Horario aproximado"
            />
            <button
              type="button"
              onClick={() => {
                const next = removeMealRowAt(normalized, mi)
                onGridChange(next.mealRows.length ? next : createEmptyWeeklyGrid(mergeWeekends))
              }}
              className="rounded-full p-0.5 text-ink-muted hover:bg-status-expired/10 hover:text-status-expired"
              aria-label={`Quitar ${meal.label}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onGridChange(addMealRow(normalized, mergeWeekends))}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-surface-border px-2.5 py-1 text-xs font-medium text-brand-secondary hover:bg-brand-secondary/8"
        >
          <Plus className="h-3.5 w-3.5" />
          Comida
        </button>
      </div>

      <div className="overflow-x-auto -mx-1 rounded-2xl border border-surface-border/60 bg-surface-base px-2 py-3">
        <div
          className="grid min-w-[54rem] items-stretch gap-x-2.5 gap-y-2.5"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(8.75rem, 1fr))` }}
        >
          {days.map((day, di) => {
            const accent = dayAccent(di, mergeWeekends)
            const count = filledMealCountForDay(normalized, di)
            return (
              <header key={`h-${day}`} className="flex items-center justify-between gap-2 px-0.5">
                <h3 className="text-xs font-semibold tracking-tight text-ink-primary">{day}</h3>
                <span
                  className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-3xs font-semibold tabular-nums"
                  style={{ backgroundColor: `${accent.color}22`, color: accent.color }}
                >
                  {count}
                </span>
              </header>
            )
          })}

          {normalized.mealRows.map((meal, mi) =>
            days.map((day, di) => {
              const accent = dayAccent(di, mergeWeekends)
              const filled = (meal.columns[di] ?? '').trim().length > 0
              return (
                <div
                  key={`${meal.id}-${di}`}
                  className="flex h-full min-h-[8.5rem] flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-card"
                >
                  <div className="h-[3px] w-full shrink-0" style={{ backgroundColor: accent.color }} />
                  <div className="flex flex-1 flex-col px-2.5 pb-2 pt-2">
                    <p className="text-xs font-semibold leading-tight text-ink-primary">{meal.label}</p>
                    {meal.approxTime.trim() ? (
                      <p className="mt-0.5 text-3xs font-medium text-ink-muted">
                        {meal.approxTime}
                      </p>
                    ) : null}
                    <textarea
                      value={meal.columns[di] ?? ''}
                      onChange={(e) => updateCell(mi, di, e.target.value)}
                      placeholder="Escribí el menú…"
                      rows={4}
                      className={cn(
                        'mt-1.5 min-h-[4.75rem] w-full flex-1 resize-none rounded-md border-0 bg-transparent px-0 py-1 text-xs leading-relaxed text-ink-primary',
                        'placeholder:text-ink-muted/55',
                        filled ? '' : 'opacity-90',
                        planFocusClassName,
                      )}
                    />
                    {IS_V2 ? (
                      <div className="mt-1.5 grid grid-cols-4 gap-1 border-t border-surface-border/70 pt-1.5">
                        {MACRO_FIELDS.map((f) => (
                          <label key={f.key} className="min-w-0" title={f.title}>
                            <span className="block text-center text-[10px] font-medium leading-none text-ink-muted">{f.label}</span>
                            <MacroInput
                              value={meal.macros?.[di]?.[f.key] ?? null}
                              onCommit={(text) => updateMacro(mi, di, f.key, text)}
                              ariaLabel={`${f.title} · ${meal.label} · ${day}`}
                            />
                          </label>
                        ))}
                      </div>
                    ) : null}
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

/** Guarda al tener un número completo o al salir del campo, así se puede escribir «12,5». */
function MacroInput({ value, onCommit, ariaLabel }: { value: number | null; onCommit: (text: string) => void; ariaLabel: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (value == null ? '' : String(value).replace('.', ','))
  return (
    <input
      inputMode="decimal"
      value={shown}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,]/g, '')
        setDraft(t)
        if (/^(\d+([.,]\d+)?)?$/.test(t)) onCommit(t)
      }}
      onBlur={() => {
        if (draft != null) onCommit(draft)
        setDraft(null)
      }}
      placeholder="—"
      aria-label={ariaLabel}
      className={cn(
        'mt-0.5 w-full min-w-0 rounded-md bg-surface-elevated/60 px-1 py-0.5 text-center text-2xs tabular-nums text-ink-primary placeholder:text-ink-muted/50',
        planFocusClassName,
      )}
    />
  )
}
