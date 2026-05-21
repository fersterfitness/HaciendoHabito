/**
 * Iconos del sidebar (Animate UI): animación al hover en el rail.
 * @see https://animate-ui.com/docs/icons/get-started
 */
import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Activity } from '@/components/animate-ui/icons/activity'
import { ChartBarIncreasing } from '@/components/animate-ui/icons/chart-bar-increasing'
import { ChartLine } from '@/components/animate-ui/icons/chart-line'
import { Clipboard } from '@/components/animate-ui/icons/clipboard'
import { ClipboardCheck } from '@/components/animate-ui/icons/clipboard-check'
import { ClipboardList } from '@/components/animate-ui/icons/clipboard-list'
import { Clock } from '@/components/animate-ui/icons/clock'
import type { IconProps } from '@/components/animate-ui/icons/icon'
import { LayoutDashboard } from '@/components/animate-ui/icons/layout-dashboard'
import { List } from '@/components/animate-ui/icons/list'
import { LogOut } from '@/components/animate-ui/icons/log-out'
import { MessageSquare } from '@/components/animate-ui/icons/message-square'
import { SendHorizontal } from '@/components/animate-ui/icons/send-horizontal'
import { Settings } from '@/components/animate-ui/icons/settings'
import { Sparkles } from '@/components/animate-ui/icons/sparkles'
import { Users } from '@/components/animate-ui/icons/users'
import { cn } from '@/lib/utils'

type SidebarAnimatedIcon = ComponentType<IconProps<string>>

/** Ruta → componente Animate UI (coincidencia exacta de `href`). */
export const SIDEBAR_ANIMATED_ICON_BY_HREF: Record<string, SidebarAnimatedIcon> = {
  '/dashboard': LayoutDashboard,
  '/appointments': Clock,
  '/students': Users,
  '/routines': Activity,
  '/feedback': MessageSquare,
  '/resources': SendHorizontal,
  '/check-ins': ClipboardCheck,
  '/exercises': List,
  '/finances': ChartBarIncreasing,
  '/meal-plans': ClipboardList,
  '/my/meal-plans': ClipboardList,
  '/nutrition': Sparkles,
  '/nutrition/evolution': ChartLine,
  '/nutrition-pdfs': Activity,
  '/nutrition/menus': Sparkles,
  '/nutrition/plans': Clipboard,
  '/nutrition/planning': ClipboardList,
  '/nutrition/foods': List,
  '/settings': Settings,
}

const SIDEBAR_ICON_SIZE = 17

export function SidebarAnimateIcon({
  href,
  fallback: Fallback,
  className,
  isActive = false,
  /** Cuando el padre (NavLink) está en hover, dispara la animación en todo el botón. */
  parentHovered = false,
}: {
  href: string
  fallback: LucideIcon
  className?: string
  isActive?: boolean
  parentHovered?: boolean
}) {
  const Animated = SIDEBAR_ANIMATED_ICON_BY_HREF[href]
  if (Animated) {
    return (
      <Animated
        size={SIDEBAR_ICON_SIZE}
        strokeWidth={isActive ? 2 : 1.75}
        animate={parentHovered}
        className={cn('shrink-0', className)}
      />
    )
  }
  const Lucide = Fallback
  return (
    <Lucide
      className={cn('size-[17px] shrink-0', className)}
      strokeWidth={isActive ? 2 : 1.75}
      aria-hidden
    />
  )
}

export function SidebarLogOutIcon({
  parentHovered = false,
  className,
}: {
  parentHovered?: boolean
  className?: string
}) {
  return (
    <LogOut
      size={SIDEBAR_ICON_SIZE}
      strokeWidth={1.75}
      animate={parentHovered}
      className={cn('shrink-0', className)}
      aria-hidden
    />
  )
}
