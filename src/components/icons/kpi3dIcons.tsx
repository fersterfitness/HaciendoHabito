/**
 * Iconos 3D de https://3dicons.co (CC0), variante `color` del CDN público.
 * @see app/public/icons/3dicons/ATTRIBUTION.txt
 */
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

const KPI_3D_SRC: Record<Kpi3dIconId, string> = {
  patients: '/icons/3dicons/kpi/patients.png',
  calendar: '/icons/3dicons/kpi/calendar.png',
  overdue: '/icons/3dicons/kpi/overdue.png',
  attended: '/icons/3dicons/kpi/attended.png',
  routines: '/icons/3dicons/kpi/routines.png',
  'meal-plans': '/icons/3dicons/kpi/meal-plans.png',
  'nutrition-plans': '/icons/3dicons/kpi/nutrition-plans.png',
  'anthropometry-pdf': '/icons/3dicons/kpi/anthropometry-pdf.png',
  income: '/icons/3dicons/kpi/income.png',
}

export function getKpi3dIconSrc(id: Kpi3dIconId): string {
  return KPI_3D_SRC[id]
}

export function Kpi3dIcon({
  id,
  className,
  size = 44,
}: {
  id: Kpi3dIconId
  className?: string
  size?: number
}) {
  return (
    <img
      src={getKpi3dIconSrc(id)}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={cn(
        'object-contain select-none pointer-events-none',
        'drop-shadow-[0_4px_10px_rgba(0,0,0,0.18)] dark:drop-shadow-[0_5px_12px_rgba(0,0,0,0.35)]',
        className,
      )}
      style={{ width: size, height: size }}
    />
  )
}
