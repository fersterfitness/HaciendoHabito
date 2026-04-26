import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

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
          <label htmlFor={inputId} className="text-sm font-medium text-ink-secondary">
            {label}
            {props.required && <span className="text-brand-primary ml-1">*</span>}
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
              'w-full rounded-xl bg-surface-input border border-surface-inputBorder',
              'text-ink-primary placeholder:text-ink-muted text-sm',
              'px-3 py-2.5 h-10',
              'transition-colors duration-150',
              'focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error && 'border-status-expired focus:border-status-expired focus:ring-status-expired/20',
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
          <label htmlFor={inputId} className="text-sm font-medium text-ink-secondary">
            {label}
            {props.required && <span className="text-brand-primary ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-xl bg-surface-input border border-surface-inputBorder',
            'text-ink-primary placeholder:text-ink-muted text-sm',
            'px-3 py-2.5 min-h-[80px] resize-y',
            'transition-colors duration-150',
            'focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-status-expired focus:border-status-expired focus:ring-status-expired/20',
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
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink-secondary">
            {label}
            {props.required && <span className="text-brand-primary ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-xl bg-surface-input border border-surface-inputBorder',
            'text-ink-primary text-sm',
            'px-3 py-2.5 h-10',
            'transition-colors duration-150 appearance-none cursor-pointer',
            'focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-status-expired',
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
        {error && <p className="text-xs text-status-expired">{error}</p>}
        {hint && !error && <p className="text-xs text-ink-muted">{hint}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'
