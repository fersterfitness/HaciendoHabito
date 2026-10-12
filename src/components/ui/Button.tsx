import { cloneElement, forwardRef, isValidElement, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { appFocusRingClassName } from '@/lib/appFocusRingClasses'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'primary'
    | 'secondary'
    | 'ghost'
    | 'danger'
    | 'outline'
    | 'soft'
    /** @deprecated usar `primary` (mismo degradé de marca). */
    | 'gradientPrimary'
    /** @deprecated usar `soft`. */
    | 'gradientSecondary'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
  asChild?: boolean
}

const variantStyles = {
  /** Acción principal: degradé de marca con brillo y halo (ver `.hh-cta`). */
  primary: 'hh-cta text-white font-semibold',
  secondary: cn(
    'bg-surface-card text-ink-primary font-medium border border-surface-border',
    'shadow-[var(--highlight-top),var(--shadow-xs)]',
    'hover:bg-surface-elevated hover:border-surface-inputBorder',
  ),
  ghost: 'bg-transparent text-ink-secondary font-medium hover:text-ink-primary hover:bg-surface-elevated',
  danger: cn(
    'bg-status-expired/10 text-status-expired font-semibold border border-status-expired/30',
    'hover:bg-status-expired/15 hover:border-status-expired/45',
  ),
  outline: cn(
    'bg-transparent text-ink-secondary font-medium border border-surface-border',
    'hover:bg-surface-elevated/60 hover:text-ink-primary hover:border-surface-inputBorder',
  ),
  /** Variante «suave» con tinte de marca (acciones de listado, menos peso que primary). */
  soft: cn(
    'bg-brand-primary/10 text-brand-primary font-semibold border border-brand-primary/20',
    'hover:bg-brand-primary/15 hover:border-brand-primary/35',
    'dark:text-[#ff8a4d]',
  ),
}

const sizeStyles = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-xl',
  icon: 'h-9 w-9 p-0 rounded-xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      asChild = false,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const resolved = variant === 'gradientPrimary' ? 'primary' : variant === 'gradientSecondary' ? 'soft' : variant

    const composedClassName = cn(
      'inline-flex select-none items-center justify-center whitespace-nowrap',
      'transition-[background-color,border-color,color,box-shadow,transform,filter] duration-200 ease-out-expo',
      'active:scale-[0.98] motion-reduce:active:scale-100',
      appFocusRingClassName,
      'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
      variantStyles[resolved],
      sizeStyles[size],
      className,
    )

    const inner = (
      <>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>
        )}
        {children && (
          <span className="inline-flex items-center gap-1.5 [&_svg]:shrink-0">{children}</span>
        )}
        {!loading && icon && iconPosition === 'right' && (
          <span className="shrink-0">{icon}</span>
        )}
      </>
    )

    if (asChild && isValidElement(children)) {
      const child = children
      const childProps = child.props as { className?: string; children?: ReactNode }
      return cloneElement(child, {
        ...props,
        ref,
        className: cn(composedClassName, childProps.className),
        'aria-disabled': disabled || loading ? true : undefined,
        children: (
          <>
            {!loading && icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
            {childProps.children}
            {!loading && icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
          </>
        ),
      } as Record<string, unknown>)
    }

    return (
      <button ref={ref} disabled={disabled || loading} className={composedClassName} {...props}>
        {inner}
      </button>
    )
  }
)

Button.displayName = 'Button'
