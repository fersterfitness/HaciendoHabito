import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
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
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center rounded-xl transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-brand-secondary/45 focus:ring-offset-2 focus:ring-offset-[rgb(var(--surface-base))]',
          'disabled:opacity-50 disabled:pointer-events-none',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>
        )}
        {children && <span>{children}</span>}
        {!loading && icon && iconPosition === 'right' && (
          <span className="shrink-0">{icon}</span>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
