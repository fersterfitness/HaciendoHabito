import { parseInlineMarkdown } from '@/lib/nutrition/inlineMarkdown'
import type { WeeklyPlanGridJson } from '@/lib/nutrition/weeklyPlanGrid'
import {
  columnFullLabels,
  dayAccent,
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
      <div className="min-w-[52rem] space-y-4">
        <div className="flex items-end gap-2.5">
          {days.map((day, di) => {
            const accent = dayAccent(di, mergeWeekends)
            return (
              <h3
                key={day}
                className="min-w-0 flex-1 text-center text-xs font-bold tracking-tight text-ink-primary"
                style={{ color: accent.color }}
              >
                {day}
              </h3>
            )
          })}
        </div>
        {normalized.mealRows.map((meal) => {
          const time = meal.approxTime.trim()
          return (
            <section key={meal.id} className="space-y-2">
              <div className="flex items-baseline gap-2 border-b border-surface-border pb-1">
                <h4 className="text-body-sm font-bold leading-tight text-ink-primary">{meal.label}</h4>
                {time ? (
                  <p className="text-2xs font-semibold text-ink-muted">{time}</p>
                ) : null}
              </div>
              <div className="flex items-stretch gap-2.5">
              {days.map((day, di) => {
                const accent = dayAccent(di, mergeWeekends)
                const raw = meal.columns[di] ?? ''
                const empty = !raw.trim() || isNoMealMarker(raw)
                const lines = empty ? [] : mealContentLines(raw)
                return (
                  <article
                    key={`${meal.id}-${day}`}
                    className="flex min-h-[7.5rem] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-card"
                  >
                    <div className="h-1 w-full shrink-0" style={{ backgroundColor: accent.color }} />
                    <div className="flex flex-1 flex-col justify-center px-2.5 py-2">
                      {empty ? (
                        <p className="text-center text-xs text-ink-muted">Sin registro</p>
                      ) : (
                        <div className="space-y-1.5 text-center text-body-sm leading-relaxed text-ink-secondary">
                          {lines.map((line, li) => (
                            <p key={li} className="min-w-0 break-words">
                              <MarkdownLine text={line} />
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
