/**
 * Iconos del sidebar (Animate UI): animación al hover en el rail.
 * @see https://animate-ui.com/docs/icons/get-started
 */
import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Activity } from '@/components/animate-ui/icons/activity'
import { ChartBarIncreasing } from '@/components/animate-ui/icons/chart-bar-increasing'
import { ChartLine } from '@/components/animate-ui/icons/chart-line'
import { ClipboardCheck } from '@/components/animate-ui/icons/clipboard-check'
import { ClipboardList } from '@/components/animate-ui/icons/clipboard-list'
import { Clock } from '@/components/animate-ui/icons/clock'
import { LayoutDashboard } from '@/components/animate-ui/icons/layout-dashboard'
import { List } from '@/components/animate-ui/icons/list'
import { LogOut } from '@/components/animate-ui/icons/log-out'
import { MessageSquare } from '@/components/animate-ui/icons/message-square'
import { SendHorizontal } from '@/components/animate-ui/icons/send-horizontal'
import { Settings } from '@/components/animate-ui/icons/settings'
import { Users } from '@/components/animate-ui/icons/users'
import { cn } from '@/lib/utils'

/**
 * Solo tipamos las props que realmente pasamos al rail. Cada icono de Animate UI
 * declara su `animate` con una unión de claves específica (p. ej. `'default'`),
 * así que `IconProps<string>` no es asignable (varianza de props). Con un `animate`
 * booleano todos los iconos encajan sin `any`.
 */
type SidebarAnimatedIcon = ComponentType<{
  size?: number
  strokeWidth?: number
  animate?: boolean
  className?: string
}>

/**
 * Ruta → Animate UI. Sin entrada aquí → icono Lucide de `navigation.ts` (sin animación pero
 * con formas más específicas como Dumbbell, FileText, Salad o Apple).
 *
 * Para mantener semántica clara, dejamos sin override las rutas cuyo Lucide expresa mejor
 * el concepto que cualquier icono Animate UI disponible (rutinas → Dumbbell, listado de
 * planes → FileText, pacientes nutrición → Users/Salad por rol).
 */
export const SIDEBAR_ANIMATED_ICON_BY_HREF: Record<string, SidebarAnimatedIcon> = {
  '/dashboard': LayoutDashboard,
  '/appointments': Clock,
  '/students': Users,
  '/appointments': Clock,
  '/feedback': MessageSquare,
  '/resources': SendHorizontal,
  '/check-ins': ClipboardCheck,
  '/exercises': List,
  '/finances': ChartBarIncreasing,
  '/my/meal-plans': ClipboardList,
  '/nutrition': Users,
  '/nutrition/anthropometry': Activity,
  '/nutrition/plans': ClipboardList,
  '/nutrition/foods': List,
  '/nutrition/evolution': ChartLine,
  '/nutrition-pdfs': Activity,
  '/nutrition/planning': ClipboardList,
  '/settings': Settings,
}

const SIDEBAR_ICON_SIZE = 16

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
      className={cn('size-4 shrink-0', className)}
      strokeWidth={isActive ? 2 : 1.65}
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
