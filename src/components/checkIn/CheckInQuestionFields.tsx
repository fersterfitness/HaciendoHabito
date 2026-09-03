import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CheckInAnswerDraft, CheckInQuestion } from '@/lib/checkIn/questions'
import { CHECK_IN_NOTE_MAX, CHECK_IN_TEXT_MAX } from '@/lib/checkIn/questions'

const SCALE_VALUES = [1, 2, 3, 4, 5] as const
const WEEK_CHIPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

const fieldClass = cn(
  'w-full rounded-2xl border border-surface-border/80 bg-surface-input/70',
  'px-3.5 py-3 text-sm text-ink-primary placeholder:text-ink-muted',
  'transition-colors focus:outline-none focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/15',
)

export function CheckInQuestionFields({
  question,
  index,
  draft,
  onChange,
}: {
  question: CheckInQuestion
  index: number
  draft: CheckInAnswerDraft
  onChange: (next: CheckInAnswerDraft) => void
}) {
  const selected = question.options?.find((o) => o.id === draft.optionId)
  return (
    <section className="rounded-3xl border border-surface-border/70 bg-surface-card/80 p-4 shadow-card sm:p-5">
      <p className="text-[15px] font-semibold leading-snug text-ink-primary">
        <span className="mr-2 inline-flex h-6 w-6 translate-y-[-1px] items-center justify-center rounded-full bg-brand-primary/12 text-[11px] font-bold tabular-nums text-brand-primary">
          {index + 1}
        </span>
        {question.label}
      </p>
      {question.helperText ? (
        <p className="mt-2 rounded-xl border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-[12px] leading-snug text-violet-800 dark:text-violet-200">
          {question.helperText}
        </p>
      ) : null}

      {question.type === 'scale' ? (
        <div className="mt-4 flex gap-2" role="group" aria-label={question.label}>
          {SCALE_VALUES.map((num) => {
            const isOn = draft.text === String(num)
            return (
              <button
                key={num}
                type="button"
                onClick={() => onChange({ ...draft, text: String(num) })}
                aria-pressed={isOn}
                className={cn(
                  'h-12 flex-1 rounded-2xl text-base font-bold transition-all duration-150 sm:h-14',
                  'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40',
                  isOn
                    ? 'border-brand-primary bg-brand-primary text-white shadow-[0_10px_22px_-8px_rgba(255,72,0,0.55)] scale-[1.03]'
                    : 'border-surface-border bg-surface-elevated/60 text-ink-secondary hover:-translate-y-0.5 hover:border-brand-primary/40 hover:text-ink-primary',
                )}
              >
                {num}
              </button>
            )
          })}
        </div>
      ) : null}

      {question.type === 'choice' ? (
        <div className="mt-4 space-y-2" role="radiogroup" aria-label={question.label}>
          {(question.options ?? []).map((opt) => {
            const isOn = draft.optionId === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={isOn}
                onClick={() => onChange({ ...draft, optionId: opt.id, extra: isOn ? draft.extra : '' })}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3.5 text-left text-sm transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30',
                  opt.id === 'last_date' && !isOn
                    ? 'border-violet-500/35 bg-violet-500/8 text-ink-primary'
                    : '',
                  isOn
                    ? 'text-ink-primary shadow-sm'
                    : opt.id === 'last_date'
                      ? 'hover:border-violet-500/50 hover:bg-violet-500/12'
                      : 'border-surface-border/80 bg-surface-elevated/40 text-ink-secondary hover:border-brand-primary/30 hover:bg-surface-elevated/70 hover:text-ink-primary',
                )}
                style={
                  isOn
                    ? { backgroundColor: `${opt.color}1f`, boxShadow: `inset 0 0 0 1.5px ${opt.color}` }
                    : undefined
                }
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
                  style={{
                    borderColor: opt.color,
                    backgroundColor: isOn ? opt.color : 'transparent',
                  }}
                >
                  {isOn ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
                </span>
                <span className="flex-1 leading-snug font-medium">{opt.label}</span>
              </button>
            )
          })}
          {selected?.extra === 'number' ? (
            <div className="pt-2">
              <p className="mb-2 text-[11px] font-medium text-ink-muted">Número de semana</p>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {WEEK_CHIPS.map((n) => {
                  const on = draft.extra === String(n)
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onChange({ ...draft, extra: String(n) })}
                      className={cn(
                        'h-10 rounded-xl border text-sm font-semibold tabular-nums transition-all',
                        on
                          ? 'border-brand-primary bg-brand-primary text-white shadow-sm'
                          : 'border-surface-border/80 bg-surface-elevated/50 text-ink-secondary hover:border-brand-primary/40 hover:text-ink-primary',
                      )}
                    >
                      {n}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
          {selected?.extra === 'date' ? (
            <label className="block space-y-1.5 rounded-2xl border border-violet-500/30 bg-violet-500/8 p-3 pt-2">
              <span className="text-[11px] font-medium text-violet-800 dark:text-violet-200">
                Fecha de tu última menstruación — registrala en cada ciclo
              </span>
              <input
                type="date"
                value={draft.extra}
                onChange={(e) => onChange({ ...draft, extra: e.target.value })}
                className={fieldClass}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {question.type === 'text' ? (
        <textarea
          id={`q-${question.id}`}
          rows={3}
          maxLength={CHECK_IN_TEXT_MAX}
          value={draft.text}
          onChange={(e) => onChange({ ...draft, text: e.target.value })}
          placeholder="Escribí tu respuesta…"
          className={cn(fieldClass, 'mt-4 resize-y')}
        />
      ) : null}

      {question.allowNote && draft.optionId ? (
        <label className="mt-3 block space-y-1.5">
          <span className="text-[11px] text-ink-muted">¿Querés aclarar algo? (opcional)</span>
          <textarea
            rows={2}
            maxLength={CHECK_IN_NOTE_MAX}
            value={draft.note}
            onChange={(e) => onChange({ ...draft, note: e.target.value })}
            placeholder="Contame un poco más si querés…"
            className={cn(
              fieldClass,
              'resize-y border-dashed bg-surface-elevated/30',
            )}
          />
        </label>
      ) : null}
    </section>
  )
}
