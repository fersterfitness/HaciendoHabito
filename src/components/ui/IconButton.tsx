import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const SIZE = {
  /** Acción de fila: 28 px (40 px de toque en pantallas táctiles con `hh-hit`). */
  sm: 'iconSm',
  /** Barra de herramientas: 36 px. */
  md: 'icon',
} as const

/**
 * Botón de solo ícono. Exige `label`: es el nombre para lectores de pantalla y el texto al pasar el
 * mouse, así no quedan botones mudos. `tone="danger"` para borrar.
 */
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
    label: string
    icon: ReactNode
    size?: keyof typeof SIZE
    variant?: 'ghost' | 'outline' | 'soft'
    tone?: 'default' | 'danger' | 'brand'
  }
>(function IconButton({ label, icon, size = 'sm', variant = 'ghost', tone = 'default', className, type = 'button', ...props }, ref) {
  return (
    <Button
      ref={ref}
      type={type}
      variant={variant}
      size={SIZE[size]}
      aria-label={label}
      title={props.title ?? label}
      className={cn(
        'hh-hit',
        variant === 'ghost' && 'text-ink-muted',
        className,
        // El tono va al final para que gane sobre un `hover:` que traiga la clase.
        tone === 'danger' && 'hover:bg-status-expired/10 hover:text-status-expired',
        tone === 'brand' && 'hover:text-brand-primary',
      )}
      {...props}
    >
      {icon}
    </Button>
  )
})
