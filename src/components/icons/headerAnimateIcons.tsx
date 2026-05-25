/**
 * Iconos del header (Animate UI): animación al hover, mismo patrón que el sidebar.
 */
import { useState, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { Bell } from '@/components/animate-ui/icons/bell'
import { Moon } from '@/components/animate-ui/icons/moon'
import { Search } from '@/components/animate-ui/icons/search'
import { Sun } from '@/components/animate-ui/icons/sun'
import { appFocusRingClassName } from '@/lib/appFocusRingClasses'
import { cn } from '@/lib/utils'

const HEADER_ICON_SIZE = 18

const headerIconClass = 'shrink-0'

export function HeaderSearchIcon({
  animate = false,
  className,
}: {
  animate?: boolean
  className?: string
}) {
  return (
    <Search
      size={HEADER_ICON_SIZE}
      strokeWidth={1.75}
      animate={animate}
      className={cn(headerIconClass, className)}
      aria-hidden
    />
  )
}

export function HeaderBellIcon({
  animate = false,
  className,
}: {
  animate?: boolean
  className?: string
}) {
  return (
    <Bell
      size={HEADER_ICON_SIZE}
      strokeWidth={1.75}
      animate={animate}
      className={cn(headerIconClass, className)}
      aria-hidden
    />
  )
}

export function HeaderSunIcon({
  animate = false,
  className,
}: {
  animate?: boolean
  className?: string
}) {
  return (
    <Sun
      size={HEADER_ICON_SIZE}
      strokeWidth={1.75}
      animate={animate}
      className={cn(headerIconClass, className)}
      aria-hidden
    />
  )
}

export function HeaderMoonIcon({
  animate = false,
  className,
}: {
  animate?: boolean
  className?: string
}) {
  return (
    <Moon
      size={HEADER_ICON_SIZE}
      strokeWidth={1.75}
      animate={animate}
      className={cn(headerIconClass, className)}
      aria-hidden
    />
  )
}

const headerActionBtnClass =
  'inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-surface-border bg-surface-elevated text-ink-secondary hover:text-ink-primary hover:bg-surface-border/50 transition-colors'

/** Botón de acción del header; `renderIcon` recibe hover para animar en todo el botón. */
export function HeaderActionButton({
  renderIcon,
  badge,
  className,
  ...props
}: {
  renderIcon: (hovered: boolean) => ReactNode
  badge?: ReactNode
} & ComponentPropsWithoutRef<'button'>) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(headerActionBtnClass, appFocusRingClassName, className)}
      {...props}
    >
      {renderIcon(hovered)}
      {badge}
    </button>
  )
}
