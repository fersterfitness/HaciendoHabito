import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { trainerCtaAccentTextClassName } from '@/lib/primaryGradientCtaClasses'
import { appFocusRingClassName } from '@/lib/appFocusRingClasses'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            {label}
            {props.required && (
              <span className={cn('ml-1', trainerCtaAccentTextClassName)}>*</span>
            )}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-xl bg-surface-input border border-surface-inputBorder/85',
              'text-ink-primary placeholder:text-ink-muted text-sm',
              'px-3 py-2.5 h-10',
              'transition-colors duration-150',
              appFocusRingClassName,
              'focus-visible:border-brand-secondary',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error &&
                'border-status-expired focus-visible:border-status-expired focus-visible:ring-status-expired/25',
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted">
              {rightIcon}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-status-expired">{error}</p>}
        {hint && !error && <p className="text-xs text-ink-muted">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            {label}
            {props.required && (
              <span className={cn('ml-1', trainerCtaAccentTextClassName)}>*</span>
            )}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-xl bg-surface-input border border-surface-inputBorder/85',
            'text-ink-primary placeholder:text-ink-muted text-sm',
            'px-3 py-2.5 min-h-[80px] resize-y',
            'transition-colors duration-150',
            appFocusRingClassName,
            'focus-visible:border-brand-secondary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error &&
              'border-status-expired focus-visible:border-status-expired focus-visible:ring-status-expired/25',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-status-expired">{error}</p>}
        {hint && !error && <p className="text-xs text-ink-muted">{hint}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  /** Acepta `as const` y listas solo lectura desde constantes compartidas. */
  options: ReadonlyArray<{ readonly value: string; readonly label: string }>
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            {label}
            {props.required && (
              <span className={cn('ml-1', trainerCtaAccentTextClassName)}>*</span>
            )}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-xl bg-surface-input border border-surface-inputBorder/85',
              'text-ink-primary text-sm',
              'pl-3 pr-10 py-2.5 h-10',
              'transition-colors duration-150 appearance-none cursor-pointer',
              appFocusRingClassName,
              'focus-visible:border-brand-secondary',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error &&
                'border-status-expired focus-visible:border-status-expired focus-visible:ring-status-expired/25',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
        </div>
        {error && <p className="text-xs text-status-expired">{error}</p>}
        {hint && !error && <p className="text-xs text-ink-muted">{hint}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'
