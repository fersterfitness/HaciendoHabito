import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    icon?: ReactNode
  }
  /** CTA del estado vacío: degradé naranja o `outline`. */
  actionVariant?: 'gradientPrimary' | 'outline'
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  actionVariant = 'gradientPrimary',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className
      )}
    >
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-surface-elevated flex items-center justify-center text-ink-muted mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-ink-primary mb-1">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm leading-relaxed text-ink-secondary">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          <Button
            variant={actionVariant}
            onClick={action.onClick}
            icon={action.icon}
          >
            {action.label}
          </Button>
        </div>
      )}
    </div>
  )
}
