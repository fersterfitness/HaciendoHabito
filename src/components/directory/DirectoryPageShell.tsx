import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { IS_V2 } from '@/lib/uiVersion'

/** Contenedor estándar para listas (alumnos / pacientes): ancho máximo y espaciado por densidad. */
export function DirectoryPageShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        IS_V2 ? 'mx-auto w-full max-w-[74rem] space-y-5 px-4 pb-14 pt-6 lg:px-10 lg:pt-8' : 'max-w-[1600px] space-y-4 page-shell-x page-shell-y',
        className,
      )}
    >
      {children}
    </div>
  )
}
