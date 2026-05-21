/**
 * KPI del Inicio y listados: iconos animados de [Animate UI](https://animate-ui.com/)
 * (Lucide + Motion). Reemplazan los PNG de 3dicons.co.
 *
 * @see app/public/icons/3dicons/ATTRIBUTION.txt (PNG legacy, ya no usados en UI)
 */
import type { ComponentType } from 'react'
import { Activity } from '@/components/animate-ui/icons/activity'
import { AlarmClock } from '@/components/animate-ui/icons/alarm-clock'
import { ChartBarIncreasing } from '@/components/animate-ui/icons/chart-bar-increasing'
import { CircleCheckBig } from '@/components/animate-ui/icons/circle-check-big'
import { Clipboard } from '@/components/animate-ui/icons/clipboard'
import { ClipboardList } from '@/components/animate-ui/icons/clipboard-list'
import { Clock } from '@/components/animate-ui/icons/clock'
import { Users } from '@/components/animate-ui/icons/users'
import type { IconProps } from '@/components/animate-ui/icons/icon'
import { cn } from '@/lib/utils'

export type Kpi3dIconId =
  | 'patients'
  | 'calendar'
  | 'overdue'
  | 'attended'
  | 'routines'
  | 'meal-plans'
  | 'nutrition-plans'
  | 'anthropometry-pdf'
  | 'income'

/** Alias histórico (StatCard usa `kpiFigmaIcon`). */
export type KpiFigmaIconId = Kpi3dIconId

type KpiAnimatedIcon = ComponentType<IconProps<string>>

const KPI_ANIMATED_ICON: Record<Kpi3dIconId, KpiAnimatedIcon> = {
  patients: Users,
  calendar: Clock,
  overdue: AlarmClock,
  attended: CircleCheckBig,
  routines: Activity,
  'meal-plans': ClipboardList,
  'nutrition-plans': Clipboard,
  'anthropometry-pdf': Clipboard,
  income: ChartBarIncreasing,
}

/** @deprecated Los PNG ya no se usan; se mantiene por compatibilidad. */
export function getKpi3dIconSrc(_id: Kpi3dIconId): string {
  return ''
}

/** Tamaño y trazo por defecto en tarjetas KPI (discretos, no protagonistas). */
export const KPI_ICON_DEFAULT_SIZE = 18
export const KPI_ICON_DEFAULT_STROKE = 1.5

export function Kpi3dIcon({
  id,
  className,
  size = KPI_ICON_DEFAULT_SIZE,
  strokeWidth = KPI_ICON_DEFAULT_STROKE,
  animateOnHover = false,
  animateOnView = false,
}: {
  id: Kpi3dIconId
  className?: string
  size?: number
  strokeWidth?: number
  animateOnHover?: boolean
  animateOnView?: boolean
}) {
  const Icon = KPI_ANIMATED_ICON[id]
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      animateOnHover={animateOnHover}
      animateOnView={animateOnView}
      className={cn('kpi-animated-icon shrink-0', className)}
    />
  )
}
