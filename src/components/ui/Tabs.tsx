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

/** Pestañas minimalistas: subrayado integrado, sin pastilla superpuesta. */
export function Tabs({ tabs, active, onChange, className, ariaLabel }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex gap-1 overflow-x-auto scrollbar-hide border-b border-surface-border/70',
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
              'relative shrink-0 inline-flex items-center gap-2 px-3 sm:px-3.5 py-2.5 text-sm font-medium transition-colors duration-150',
              'border-b-2 -mb-px',
              appFocusRingClassName,
              isActive
                ? 'border-brand-secondary text-brand-secondary'
                : 'border-transparent text-ink-muted hover:text-ink-secondary',
            )}
          >
            {tab.icon ? (
              <span
                className={cn(
                  'shrink-0 [&_svg]:h-4 [&_svg]:w-4',
                  isActive ? 'text-brand-secondary' : 'text-ink-muted',
                )}
              >
                {tab.icon}
              </span>
            ) : null}
            <span className="whitespace-nowrap">{tab.label}</span>
            {typeof tab.count === 'number' && tab.count > 0 ? (
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-md text-[10px] font-semibold tabular-nums',
                  isActive
                    ? 'bg-surface-elevated text-ink-secondary'
                    : 'bg-surface-elevated/80 text-ink-muted',
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
