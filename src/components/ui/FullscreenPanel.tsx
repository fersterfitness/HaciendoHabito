import { type ReactNode, useRef } from 'react'
import { useDialogLayer } from '@/lib/dialogLayer'
import { cn } from '@/lib/utils'

/**
 * Ventana de pantalla completa para herramientas grandes (volumen, macrociclo, guía de progresión):
 * fondo oscuro, panel con bordes redondeados casi a pantalla completa, Escape para cerrar, scroll
 * del fondo bloqueado y foco dentro del panel. El encabezado y el cuerpo los arma cada herramienta.
 */
export function FullscreenPanel({
  open = true,
  onClose,
  labelledBy,
  children,
  className,
  overlayClassName,
}: {
  open?: boolean
  onClose: () => void
  /** id del título del panel. */
  labelledBy: string
  children: ReactNode
  /** Clases del panel (ancho máximo, colores). */
  className?: string
  overlayClassName?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useDialogLayer(open, onClose, panelRef)
  if (!open) return null
  return (
    <div
      className={cn('fixed inset-0 z-50 flex flex-col bg-black/70 p-1 backdrop-blur-sm sm:p-3', overlayClassName)}
      role="dialog"
      aria-modal
      aria-labelledby={labelledBy}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'mx-auto flex h-full w-full max-w-[92rem] flex-col overflow-hidden rounded-2xl border border-surface-border bg-surface-base focus:outline-none',
          // tailwind-merge no reconoce `shadow-pop` como sombra: si viene otra, se deja solo esa.
          !className?.includes('shadow-') && 'shadow-pop',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
