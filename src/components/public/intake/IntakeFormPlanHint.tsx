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
      <p className="mb-4 rounded-xl border border-surface-border/70 bg-surface-elevated/30 px-3.5 py-2.5 text-xs leading-relaxed text-ink-secondary">
        Elegí un plan en el panel izquierdo para continuar.
      </p>
    )
  }

  return (
    <div
      className={cn(
        'mb-4 flex min-w-0 items-center justify-between gap-3 rounded-xl border border-surface-border',
        'bg-gradient-to-r from-zinc-500/[0.07] to-transparent px-3.5 py-2.5',
      )}
    >
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-secondary">Plan elegido</p>
        <p className="truncate text-sm font-semibold text-ink-primary">{selectedPlanLabel}</p>
        {selectedPlanPrice ? (
          <p className="text-xs tabular-nums text-ink-muted">{selectedPlanPrice}</p>
        ) : null}
      </div>
      {onRequestChangePlan ? (
        <button
          type="button"
          onClick={onRequestChangePlan}
          className="shrink-0 rounded-lg border border-surface-border bg-surface-elevated px-2.5 py-1.5 text-xs font-semibold text-ink-primary transition-colors hover:bg-surface-card"
        >
          Cambiar
        </button>
      ) : null}
    </div>
  )
}
