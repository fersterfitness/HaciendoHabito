import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FormSectionProps {
  title?: string
  description?: string
  children: ReactNode
  className?: string
}

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {(title || description) && (
        <div className="border-b border-surface-border pb-3">
          {title && <h3 className="text-sm font-semibold text-ink-primary">{title}</h3>}
          {description && <p className="text-xs text-ink-secondary mt-0.5">{description}</p>}
        </div>
      )}
      <div className="grid gap-4">{children}</div>
    </div>
  )
}
