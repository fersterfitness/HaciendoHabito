import { cn } from '@/lib/utils'

type IntakeFormStepNavProps = {
  step: number
  stepTitles: string[]
  stepNavHint?: string | null
  onGoToStep?: (index: number) => void
}

export function IntakeFormStepNav({ step, stepTitles, stepNavHint, onGoToStep }: IntakeFormStepNavProps) {
  const total = stepTitles.length
  const current = stepTitles[step] ?? ''
  const progress = Math.round(((step + 1) / total) * 100)

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-start gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            'border border-brand-secondary/30 bg-brand-secondary/12',
            'text-sm font-bold tabular-nums text-brand-secondary',
          )}
          aria-hidden
        >
          {step + 1}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            Paso {step + 1} de {total}
          </p>
          <p className="mt-0.5 text-lg font-semibold leading-tight tracking-tight text-ink-primary sm:text-xl">
            {current}
          </p>
        </div>
      </div>

      <div
        className="h-1.5 overflow-hidden rounded-full bg-surface-border/70 dark:bg-zinc-800/80"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progreso del formulario"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-secondary/80 to-brand-secondary transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {onGoToStep && total <= 6 ? (
        <div className="-mx-0.5 mt-3.5 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5 scrollbar-hide">
          {stepTitles.map((title, i) => (
            <button
              key={title}
              type="button"
              onClick={() => onGoToStep(i)}
              disabled={i > step}
              className={cn(
                'shrink-0 rounded-lg px-3 py-2 text-[11px] font-semibold transition-all',
                i === step
                  ? 'bg-brand-secondary/15 text-brand-secondary ring-1 ring-brand-secondary/30'
                  : i < step
                    ? 'bg-surface-elevated text-ink-secondary hover:text-brand-secondary'
                    : 'cursor-not-allowed border border-dashed border-surface-border/60 text-ink-muted/60',
              )}
            >
              {title}
            </button>
          ))}
        </div>
      ) : null}

      {stepNavHint ? (
        <p
          className="mt-3 rounded-lg border border-brand-secondary/15 bg-brand-secondary/6 px-3 py-2 text-center text-[11px] leading-snug text-ink-secondary"
          role="status"
          aria-live="polite"
        >
          {stepNavHint}
        </p>
      ) : null}
    </div>
  )
}
