import {
  CHECK_IN_SKIP_OPTION,
  formatStoredAnswer,
  isMonthlyTemplate,
  optionById,
  parseStoredChoice,
  type CheckInQuestion,
} from '@/lib/checkIn/questions'
import { cn } from '@/lib/utils'

export function CheckInAnswerList({
  questions,
  responses,
}: {
  questions: CheckInQuestion[]
  responses: Record<string, unknown>
}) {
  const known = new Set(questions.map((q) => q.id))
  const monthly = isMonthlyTemplate(questions)
  return (
    <ul className="space-y-2.5">
      {questions.map((q) => {
        const choice = parseStoredChoice(responses[q.id])
        const opt = choice ? optionById(q, choice.option) : undefined
        const skipped = choice?.option === CHECK_IN_SKIP_OPTION
        const enlargeText = monthly && q.type === 'text' && q.key !== 'full_name'
        return (
          <li key={q.id} className="rounded-2xl border border-surface-border/60 bg-surface-elevated/25 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{q.label}</p>
            {choice && !skipped && opt ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-ink-primary"
                  style={{ backgroundColor: `${opt.color}22`, boxShadow: `inset 0 0 0 1px ${opt.color}55` }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: opt.color }} />
                  {opt.label}
                </span>
                {choice.extra ? (
                  <span className="rounded-full bg-surface-card px-2 py-1 text-[11px] font-medium tabular-nums text-ink-secondary">
                    {choice.extra}
                  </span>
                ) : null}
              </div>
            ) : (
              <p
                className={cn(
                  'mt-1 whitespace-pre-wrap text-ink-primary',
                  enlargeText ? 'text-base font-medium leading-relaxed' : 'text-sm',
                )}
              >
                {formatStoredAnswer(q, responses[q.id])}
              </p>
            )}
            {choice?.note ? (
              <p className="mt-1.5 text-[12px] leading-snug text-ink-secondary">{choice.note}</p>
            ) : null}
          </li>
        )
      })}
      {Object.entries(responses)
        .filter(([k]) => !known.has(k))
        .map(([k, v]) => (
          <li key={k} className="rounded-2xl border border-surface-border/60 bg-surface-elevated/25 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{k}</p>
            <p className="mt-1 text-sm text-ink-primary">{String(v ?? '—')}</p>
          </li>
        ))}
    </ul>
  )
}
