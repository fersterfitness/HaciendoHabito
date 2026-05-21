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
        'relative overflow-x-hidden rounded-2xl border border-brand-secondary/20',
        'bg-gradient-to-br from-surface-card via-surface-card to-brand-secondary/[0.04]',
        'p-4 shadow-[0_8px_32px_rgba(0,0,0,0.06)] backdrop-blur-sm sm:p-5 lg:p-6',
        'dark:border-brand-secondary/25 dark:from-surface-card dark:to-brand-secondary/[0.06]',
        'dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)]',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-brand-secondary/10 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-6 right-1/4 h-20 w-20 rounded-full bg-brand-tertiary/8 blur-2xl"
        aria-hidden
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  )
}
