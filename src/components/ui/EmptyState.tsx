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
  /** CTA del estado vacío: acento secondary o `outline`. */
  actionVariant?: 'gradientSecondary' | 'soft' | 'primary' | 'outline'
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  actionVariant = 'soft',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex animate-slide-up flex-col items-center justify-center px-6 py-16 text-center',
        className
      )}
    >
      {icon && (
        <div className="relative mb-5">
          <div aria-hidden className="absolute inset-0 -z-10 scale-150 rounded-full bg-brand-primary/10 blur-2xl" />
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-surface-border bg-surface-card text-brand-primary shadow-card [&_svg]:h-6 [&_svg]:w-6">
            {icon}
          </div>
        </div>
      )}
      <h3 className="mb-1 text-base font-semibold tracking-tight text-ink-primary">{title}</h3>
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
