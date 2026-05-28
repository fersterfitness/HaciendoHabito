import { cn } from '@/lib/utils'

type IntakeFormPlanHintProps = {
  compact?: boolean
  selectedPlanLabel?: string | null
  selectedPlanPrice?: string | null
  onRequestChangePlan?: () => void
}

export function IntakeFormPlanHint({
  compact,
  selectedPlanLabel,
  selectedPlanPrice,
  onRequestChangePlan,
}: IntakeFormPlanHintProps) {
  if (compact) return null

  if (!selectedPlanLabel) {
    return (
      <p className="mb-4 text-sm text-ink-muted">
        Elegí un plan en el panel izquierdo para continuar.
      </p>
    )
  }

  return (
    <div
      className={cn(
        'mb-4 rounded-xl border border-surface-border/80 bg-surface-elevated/35 px-4 py-3',
        'dark:border-white/10 dark:bg-white/[0.04]',
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Plan elegido</p>
      <div className="mt-1.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold uppercase leading-tight tracking-tight text-ink-primary">
            {selectedPlanLabel}
          </p>
          {selectedPlanPrice ? (
            <p className="mt-0.5 text-sm tabular-nums text-ink-muted">{selectedPlanPrice}</p>
          ) : null}
        </div>
        {onRequestChangePlan ? (
          <button
            type="button"
            onClick={onRequestChangePlan}
            className={cn(
              'shrink-0 rounded-lg border border-surface-border bg-surface-card px-3 py-1.5',
              'text-xs font-semibold text-ink-primary transition-colors',
              'hover:bg-surface-elevated',
              'dark:border-white/15 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]',
            )}
          >
            Cambiar
          </button>
        ) : null}
      </div>
    </div>
  )
}
