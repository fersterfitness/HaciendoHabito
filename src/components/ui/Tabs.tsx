import { type ReactNode, useId } from 'react'
import { motion, useReducedMotion } from 'motion/react'
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

/** Pestañas con subrayado que se desliza a la pestaña activa. */
export function Tabs({ tabs, active, onChange, className, ariaLabel }: TabsProps) {
  const indicatorId = useId()
  const reduceMotion = useReducedMotion()
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
              'relative -mb-px inline-flex shrink-0 items-center gap-2 rounded-t-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 sm:px-3.5',
              appFocusRingClassName,
              isActive ? 'text-ink-primary' : 'text-ink-muted hover:text-ink-secondary',
            )}
          >
            {isActive ? (
              <motion.span
                layoutId={indicatorId}
                aria-hidden
                className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-brand-gradient"
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
              />
            ) : null}
            {tab.icon ? (
              <span
                className={cn(
                  'shrink-0 [&_svg]:h-4 [&_svg]:w-4',
                  isActive ? 'text-brand-primary' : 'text-ink-muted',
                )}
              >
                {tab.icon}
              </span>
            ) : null}
            <span className="whitespace-nowrap">{tab.label}</span>
            {typeof tab.count === 'number' && tab.count > 0 ? (
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-md text-3xs font-semibold tabular-nums',
                  isActive
                    ? 'bg-brand-primary/12 text-brand-primary'
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
