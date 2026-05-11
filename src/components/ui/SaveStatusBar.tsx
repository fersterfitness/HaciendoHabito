import { cn } from '@/lib/utils'

/** Estado de guardado compacto para formularios (accesible, sin toasts). */
export function SaveStatusBar({
  isSubmitting,
  isDirty,
  className,
}: {
  isSubmitting: boolean
  isDirty: boolean
  className?: string
}) {
  if (!isSubmitting && !isDirty) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'rounded-lg border border-surface-border/80 bg-surface-elevated/40 px-3 py-2 text-xs text-ink-secondary',
        className,
      )}
    >
      {isSubmitting ? (
        <span className="font-medium text-ink-primary">Guardando…</span>
      ) : (
        <span className="font-medium text-status-expiring">Cambios sin guardar</span>
      )}
    </div>
  )
}
