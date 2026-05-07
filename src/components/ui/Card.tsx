import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

export function Card({ hover = false, padding = 'md', className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface-card rounded-2xl border border-surface-border/80',
        'shadow-card',
        hover &&
          'hover:border-surface-border hover:bg-surface-elevated/30 hover:shadow-card-md transition-colors duration-200 cursor-pointer',
        paddingStyles[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('relative flex items-center justify-between mb-3', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-sm font-semibold text-ink-primary', className)} {...props}>
      {children}
    </h3>
  )
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  )
}
