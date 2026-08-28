import { parseInlineMarkdown } from '@/lib/nutrition/inlineMarkdown'
import type { WeeklyPlanGridJson } from '@/lib/nutrition/weeklyPlanGrid'
import {
  columnFullLabels,
  compactMealLabel,
  dayAccent,
  filledMealCountForDay,
  isNoMealMarker,
  mealContentLines,
  normalizeWeeklyGrid,
} from '@/lib/nutrition/weeklyPlanGrid'
import { cn } from '@/lib/utils'

function MarkdownLine({ text }: { text: string }) {
  return (
    <>
      {parseInlineMarkdown(text).map((seg, i) => (
        <span key={i} className={cn(seg.bold && 'font-semibold text-ink-primary', seg.italic && 'italic')}>
          {seg.text}
        </span>
      ))}
    </>
  )
}

export function WeeklyMealPlanBoard({
  grid,
  mergeWeekends,
  className,
}: {
  grid: WeeklyPlanGridJson
  mergeWeekends: boolean
  className?: string
}) {
  const days = columnFullLabels(mergeWeekends)
  const normalized = normalizeWeeklyGrid(grid, mergeWeekends)

  return (
    <div className={cn('overflow-x-auto -mx-1 px-1 pb-1', className)}>
      <div
        className="grid min-w-[54rem] items-stretch gap-x-3 gap-y-3"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(8.75rem, 1fr))` }}
      >
        {days.map((day, di) => {
          const accent = dayAccent(di, mergeWeekends)
          const count = filledMealCountForDay(normalized, di)
          return (
            <header
              key={`h-${day}`}
              className="sticky top-0 z-[1] flex items-center justify-between gap-2 rounded-lg bg-slate-50/95 px-1 py-1 backdrop-blur-sm dark:bg-zinc-950/90"
            >
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

        {normalized.mealRows.map((meal) =>
          days.map((day, di) => {
            const accent = dayAccent(di, mergeWeekends)
            const raw = meal.columns[di] ?? ''
            const empty = !raw.trim()
            const none = isNoMealMarker(raw)
            const lines = empty || none ? [] : mealContentLines(raw)
            const time = meal.approxTime.trim()
            return (
              <article
                key={`${meal.id}-${di}`}
                className="flex h-full min-h-[8rem] flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-700 dark:bg-zinc-950"
              >
                <div className="h-1 w-full shrink-0" style={{ backgroundColor: accent.color }} />
                <div className="flex flex-1 flex-col px-3 pb-2.5 pt-2.5">
                  <p className="truncate text-[13px] font-bold leading-tight text-ink-primary">
                    {compactMealLabel(meal.label)}
                  </p>
                  {time ? (
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      {time}
                    </p>
                  ) : null}
                  {empty || none ? (
                    <p className="mt-2 text-[12px] text-ink-muted">Sin registro</p>
                  ) : (
                    <ul className="mt-2 flex-1 space-y-1.5">
                      {lines.map((line, li) => (
                        <li key={li} className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-secondary">
                          <span
                            className="mt-[3px] h-3 w-3 shrink-0 rounded-[3px] border-[1.5px] bg-white"
                            style={{ borderColor: accent.color }}
                            aria-hidden
                          />
                          <span className="min-w-0 break-words">
                            <MarkdownLine text={line} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            )
          }),
        )}
      </div>
    </div>
  )
}
