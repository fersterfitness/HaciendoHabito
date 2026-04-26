import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  iconColor?: string
  iconBg?: string
  trend?: { value: number; label: string }
  onClick?: () => void
  className?: string
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  iconColor = 'text-brand-primary',
  iconBg = 'bg-brand-primary/10',
  trend,
  onClick,
  className,
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-surface-card rounded-2xl border border-surface-border/70 p-3.5',
        'flex flex-col gap-2.5',
        onClick &&
          'cursor-pointer hover:border-brand-primary/25 transition-colors duration-200',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-[11px] font-medium text-ink-muted uppercase tracking-wide truncate">
            {title}
          </p>
          <p className="text-[34px] font-semibold text-ink-primary tabular-nums leading-none">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-ink-secondary mt-0.5">{subtitle}</p>
          )}
        </div>
        <div
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
            iconBg,
            iconColor
          )}
        >
          {icon}
        </div>
      </div>

      {trend && (
        <div className="flex items-center gap-1.5 pt-1">
          <span
            className={cn(
              'text-[11px] font-semibold px-2 py-0.5 rounded-md',
              trend.value >= 0
                ? 'text-status-generated bg-status-generated/10'
                : 'text-status-expired bg-status-expired/10'
            )}
          >
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
          <span className="text-xs text-ink-muted">{trend.label}</span>
        </div>
      )}
    </div>
  )
}
