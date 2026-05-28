import { cn } from '@/lib/utils'

type IntakeFormReviewStripProps = {
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  planLabel?: string | null
  planPrice?: string | null
  className?: string
}

/** Resumen breve antes de fotos/pago: sin email (ya está en el paso Datos). */
export function IntakeFormReviewStrip({
  firstName,
  lastName,
  phone,
  planLabel,
  planPrice,
  className,
}: IntakeFormReviewStripProps) {
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()
  if (!fullName && !phone?.trim() && !planLabel?.trim()) return null

  return (
    <div
      className={cn(
        'mb-4 flex flex-col gap-2 border-b border-surface-border/60 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5',
        className,
      )}
    >
      {fullName ? (
        <p className="text-sm font-semibold text-ink-primary">{fullName}</p>
      ) : null}
      {phone?.trim() ? (
        <p className="text-sm text-ink-secondary tabular-nums">{phone.trim()}</p>
      ) : null}
      {planLabel?.trim() ? (
        <p className="text-sm text-ink-secondary sm:ml-auto">
          <span className="text-ink-muted">Plan · </span>
          <span className="font-medium text-ink-primary">{planLabel.trim()}</span>
          {planPrice?.trim() ? (
            <span className="ml-1.5 tabular-nums text-ink-muted">{planPrice.trim()}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}
