import { type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'
import { Modal } from './Modal'
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
  icon,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} size="sm" hideClose>
      <div className="flex flex-col items-center gap-4 pt-6 text-center">
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-inset',
            variant === 'danger'
              ? 'bg-status-expired/10 text-status-expired ring-status-expired/20'
              : 'bg-status-expiring/10 text-status-expiring ring-status-expiring/20',
          )}
        >
          {icon ?? <AlertTriangle className="h-5 w-5" />}
        </div>

        <div>
          <h3 className="text-base font-semibold tracking-tight text-ink-primary">{title}</h3>
          {description && <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">{description}</p>}
        </div>

        <div className="flex w-full gap-2.5 pt-1">
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
    </Modal>
  )
}
