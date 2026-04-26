import { type ReactNode } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from './Button'

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
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card border border-surface-border rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-ink-muted hover:text-ink-primary transition-colors"
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
            <h3 className="text-base font-semibold text-ink-primary">{title}</h3>
            {description && (
              <p className="text-sm text-ink-secondary mt-1">{description}</p>
            )}
          </div>

          <div className="flex gap-3 w-full">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              {cancelLabel}
            </Button>
            <Button
              variant={variant === 'danger' ? 'danger' : 'primary'}
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
