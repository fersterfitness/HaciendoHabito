import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { appFocusRingClassName } from '@/lib/appFocusRingClasses'

export interface TabItem {
  id: string
  label: string
  icon?: ReactNode
  count?: number
}

interface TabsProps {
  tabs: TabItem[]
  active: string
  onChange: (id: string) => void
  className?: string
  ariaLabel?: string
}

export function Tabs({ tabs, active, onChange, className, ariaLabel }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex gap-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible',
        'rounded-2xl border border-surface-border/80 bg-surface-card p-1.5',
        '-mx-0.5 px-1.5',
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              'shrink-0 inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors duration-150',
              appFocusRingClassName,
              isActive
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-sm'
                : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated/60',
            )}
          >
            {tab.icon ? <span className="shrink-0 [&_svg]:h-4 [&_svg]:w-4">{tab.icon}</span> : null}
            <span className="whitespace-nowrap">{tab.label}</span>
            {typeof tab.count === 'number' && tab.count > 0 ? (
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-semibold tabular-nums',
                  isActive
                    ? 'bg-emerald-500/25 text-emerald-700 dark:text-emerald-200'
                    : 'bg-surface-elevated text-ink-muted',
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

interface TabPanelProps {
  id: string
  active: string
  children: ReactNode
  className?: string
}

export function TabPanel({ id, active, children, className }: TabPanelProps) {
  if (id !== active) return null
  return (
    <div
      role="tabpanel"
      id={`tabpanel-${id}`}
      aria-labelledby={`tab-${id}`}
      className={className}
    >
      {children}
    </div>
  )
}
