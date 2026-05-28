import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type IntakeFormShellProps = {
  children: ReactNode
  className?: string
}

export function IntakeFormShell({ children, className }: IntakeFormShellProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-surface-border/80 bg-surface-card',
        'p-4 sm:p-5 lg:p-6',
        className,
      )}
    >
      {children}
    </div>
  )
}
