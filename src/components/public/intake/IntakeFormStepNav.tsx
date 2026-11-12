import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type IntakeFormStepNavProps = {
  step: number
  stepTitles: string[]
  stepNavHint?: string | null
  onGoToStep?: (index: number) => void
}

/**
 * Secciones del formulario de datos: un tramo por sección que se va llenando y, debajo, el nombre de
 * cada una. Se puede volver a una anterior; avanzar valida lo que falta.
 */
export function IntakeFormStepNav({ step, stepTitles, stepNavHint, onGoToStep }: IntakeFormStepNavProps) {
  const total = stepTitles.length
  const current = stepTitles[step] ?? ''

  return (
    <div className="mb-6">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold tracking-tight text-ink-primary">{current}</p>
        <p className="shrink-0 text-2xs tabular-nums text-ink-muted">
          {step + 1} de {total}
        </p>
      </div>

      <div
        className="flex gap-1.5"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label="Progreso del formulario"
      >
        {stepTitles.map((title, i) => (
          <span key={title} className="relative h-1 flex-1 overflow-hidden rounded-full bg-surface-elevated">
            <motion.span
              className="absolute inset-0 origin-left rounded-full bg-ink-primary"
              initial={false}
              animate={{ scaleX: i <= step ? 1 : 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            />
          </span>
        ))}
      </div>

      {onGoToStep && total <= 6 ? (
        <div className="mt-2 hidden gap-1.5 sm:flex">
          {stepTitles.map((title, i) => (
            <button
              key={title}
              type="button"
              onClick={() => onGoToStep(i)}
              aria-current={i === step ? 'step' : undefined}
              className={cn(
                'hh-focus flex min-w-0 flex-1 items-center gap-1 rounded-md py-1 text-left text-2xs font-medium transition-colors',
                i === step ? 'text-ink-primary' : i < step ? 'text-ink-secondary hover:text-ink-primary' : 'text-ink-muted hover:text-ink-secondary',
              )}
            >
              {i < step ? <Check className="h-3 w-3 shrink-0 text-status-ok-ink" strokeWidth={3} aria-hidden /> : null}
              <span className="truncate">{title}</span>
            </button>
          ))}
        </div>
      ) : null}

      {stepNavHint ? (
        <p className="mt-2.5 rounded-lg bg-surface-elevated px-3 py-2 text-2xs leading-snug text-ink-secondary" role="status" aria-live="polite">
          {stepNavHint}
        </p>
      ) : null}
    </div>
  )
}
