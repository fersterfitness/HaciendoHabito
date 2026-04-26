import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card } from './Card'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  iconColor?: string
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
  trend,
  onClick,
  className,
}: StatCardProps) {
  return (
    <Card
      hover={!!onClick}
      onClick={onClick}
      className={cn('flex flex-col gap-3', className)}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold text-ink-primary tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-ink-secondary">{subtitle}</p>}
        </div>
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center bg-surface-elevated',
            iconColor
          )}
        >
          {icon}
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'text-xs font-medium',
              trend.value >= 0 ? 'text-status-generated' : 'text-status-expired'
            )}
          >
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>
          <span className="text-xs text-ink-muted">{trend.label}</span>
        </div>
      )}
    </Card>
  )
}
