import { type ReactNode, useEffect, useId, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from './Button'
import { appFocusRingClassName } from '@/lib/appFocusRingClasses'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  loading?: boolean
  icon?: ReactNode
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-sm animate-fade-in rounded-2xl border border-surface-border bg-surface-card p-6 shadow-lg outline-none"
      >
        <button
          onClick={onClose}
          type="button"
          className={cn(
            'absolute right-4 top-4 rounded-lg p-1 text-ink-muted transition-colors hover:text-ink-primary',
            appFocusRingClassName,
          )}
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              variant === 'danger'
                ? 'bg-status-expired/10 text-status-expired'
                : 'bg-status-expiring/10 text-status-expiring'
            }`}
          >
            <AlertTriangle className="h-6 w-6" />
          </div>

          <div>
            <h3 id={titleId} className="text-base font-semibold text-ink-primary">
              {title}
            </h3>
            {description && (
              <p className="text-sm text-ink-secondary mt-1">{description}</p>
            )}
          </div>

          <div className="flex gap-3 w-full">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              {cancelLabel}
            </Button>
            <Button
              variant={variant === 'danger' ? 'danger' : 'gradientSecondary'}
              className="flex-1"
              onClick={onConfirm}
              loading={loading}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
