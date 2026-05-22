import { cloneElement, forwardRef, isValidElement, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { appFocusRingClassName } from '@/lib/appFocusRingClasses'
import { primaryGradientCtaClassName, secondaryGradientCtaClassName } from '@/lib/primaryGradientCtaClasses'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'primary'
    | 'secondary'
    | 'ghost'
    | 'danger'
    | 'outline'
    | 'gradientPrimary'
    | 'gradientSecondary'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
}

const variantStyles = {
  primary:
    'bg-brand-primary text-white font-semibold shadow-none hover:bg-brand-hover',
  secondary:
    'bg-surface-card border border-surface-border/80 text-ink-primary shadow-none hover:bg-surface-elevated/50 hover:border-surface-border',
  ghost:
    'bg-transparent text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated/50',
  danger:
    'bg-status-expired/14 text-status-expired border border-status-expired/45 hover:bg-status-expired/20',
  outline:
    'bg-transparent border border-surface-border/80 text-ink-secondary hover:bg-surface-elevated/40 hover:text-ink-primary',
}

const sizeStyles = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-base gap-2',
  icon: 'h-9 w-9 p-0',
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
    const gradientClass =
      variant === 'gradientPrimary'
        ? primaryGradientCtaClassName
        : variant === 'gradientSecondary'
          ? secondaryGradientCtaClassName
          : null

    const composedClassName = cn(
      'inline-flex items-center justify-center',
      gradientClass
        ? cn('outline-none disabled:opacity-50 disabled:pointer-events-none', gradientClass)
        : cn(
            'rounded-xl transition-colors duration-150',
            appFocusRingClassName,
            'disabled:opacity-50 disabled:pointer-events-none',
            variantStyles[variant],
            sizeStyles[size],
          ),
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
