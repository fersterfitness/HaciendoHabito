import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type IntakeFormShellProps = {
  children: ReactNode
  className?: string
}

export function IntakeFormShell({ children, className }: IntakeFormShellProps) {
  return (
    <div
      // La tarjeta la pone la página de /form: acá no va un segundo recuadro.
      className={cn('hh-intake-shell', className)}
    >
      {children}
    </div>
  )
}
