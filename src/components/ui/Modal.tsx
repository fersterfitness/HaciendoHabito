import { type ReactNode, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { appFocusRingClassName } from '@/lib/appFocusRingClasses'
import { cn } from '@/lib/utils'

const SIZE = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-2xl',
} as const

/**
 * Diálogo base: fondo con desenfoque, entrada con escala, Escape para cerrar,
 * foco atrapado en el panel y scroll del body bloqueado.
 * En mobile se apoya abajo como hoja; en desktop queda centrado.
 */
export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  footer,
  size = 'md',
  className,
  hideClose = false,
  bare = false,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** Texto chico arriba del título (contexto). */
  eyebrow?: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: keyof typeof SIZE
  className?: string
  hideClose?: boolean
  /** Renderiza `children` tal cual dentro del panel (el contenido trae su propio encabezado). */
  bare?: boolean
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const prevFocus = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      prevFocus?.focus?.()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 animate-overlay-in bg-black/50 backdrop-blur-[6px] dark:bg-black/65"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col outline-none',
          bare ? 'overflow-y-auto' : 'overflow-hidden',
          'rounded-t-3xl border border-surface-border bg-surface-card pb-[env(safe-area-inset-bottom)] sm:rounded-2xl sm:pb-0',
          'shadow-[var(--highlight-top),var(--shadow-lg)] animate-scale-in',
          SIZE[size],
          className,
        )}
      >
        {bare ? children : null}
        {!bare && (title || eyebrow || !hideClose) ? (
          <div className="flex items-start gap-3 px-5 pb-3 pt-5">
            <div className="min-w-0 flex-1">
              {eyebrow ? (
                <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-muted">{eyebrow}</p>
              ) : null}
              {title ? (
                <h2 id={titleId} className="mt-0.5 text-base font-semibold tracking-tight text-ink-primary">
                  {title}
                </h2>
              ) : null}
              {description ? <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{description}</p> : null}
            </div>
            {!hideClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className={cn(
                  '-mr-1 -mt-1 rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-elevated hover:text-ink-primary',
                  appFocusRingClassName,
                )}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}
        {!bare && children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div> : null}
        {!bare && footer ? (
          <div className="flex gap-2 border-t border-surface-border bg-surface-panel/60 px-5 py-3.5">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
