import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Contenedor estándar para listas (alumnos / pacientes): ancho máximo y espaciado por densidad. */
export function DirectoryPageShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mx-auto max-w-[1600px] space-y-4 page-shell-x page-shell-y', className)}>
      {children}
    </div>
  )
}
