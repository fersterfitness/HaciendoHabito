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
    <div className="mb-5">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-sm text-ink-muted">
          Paso {step + 1} de {total}
          <span className="text-ink-muted/50"> · </span>
          <span className="font-medium text-ink-primary">{current}</span>
        </p>
        <span className="shrink-0 text-xs tabular-nums text-ink-muted">{progress}%</span>
      </div>

      <div
        className="h-1 overflow-hidden rounded-full bg-surface-border/60 dark:bg-zinc-800/80"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progreso del formulario"
      >
        <div
          className="h-full rounded-full bg-brand-primary transition-[width] duration-400 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {onGoToStep && total <= 6 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {stepTitles.map((title, i) => (
            <button
              key={title}
              type="button"
              onClick={() => onGoToStep(i)}
              disabled={i > step}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                i === step
                  ? 'bg-surface-elevated text-ink-primary'
                  : i < step
                    ? 'text-ink-secondary hover:text-ink-primary hover:underline'
                    : 'cursor-not-allowed text-ink-muted/45',
              )}
            >
              {title}
            </button>
          ))}
        </div>
      ) : null}

      {stepNavHint ? (
        <p className="mt-2.5 text-xs leading-snug text-ink-muted" role="status" aria-live="polite">
          {stepNavHint}
        </p>
      ) : null}
    </div>
  )
}
