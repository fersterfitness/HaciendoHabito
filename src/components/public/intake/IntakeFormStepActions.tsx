import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { intakeFormBackButtonClass, intakeFormCtaPrimaryClass } from '@/lib/intake/intakeFormUi'

type IntakeFormStepActionsProps = {
  step: number
  stepCount: number
  onBack: () => void
  onNext: () => void
  isSubmitting?: boolean
  nextLabel?: string
  submitLabel?: string
}

export function IntakeFormStepActions({
  step,
  stepCount,
  onBack,
  onNext,
  isSubmitting = false,
  nextLabel = 'Siguiente',
  submitLabel = 'Enviar solicitud',
}: IntakeFormStepActionsProps) {
  const isLast = step >= stepCount - 1

  return (
    <div className="hh-intake-actions flex flex-col-reverse gap-2.5 border-t border-surface-border pt-5 sm:flex-row sm:items-center sm:justify-between">
      {step > 0 ? (
        <button type="button" onClick={onBack} className={intakeFormBackButtonClass}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Atrás
        </button>
      ) : (
        <span className="hidden sm:block sm:w-20" aria-hidden />
      )}
      {isLast ? (
        <button type="submit" disabled={isSubmitting} className={cn(intakeFormCtaPrimaryClass, 'w-full sm:w-auto sm:min-w-[10rem]')}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {isSubmitting ? 'Enviando…' : submitLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          className={cn(intakeFormCtaPrimaryClass, 'w-full sm:w-auto sm:min-w-[9rem]')}
        >
          {nextLabel}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  )
}
