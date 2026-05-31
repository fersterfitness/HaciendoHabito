import type { ReactNode } from 'react'
import { nutritionTabsStripClass } from '@/lib/nutrition/nutritionAreaUi'
import { cn } from '@/lib/utils'

/** Envuelve Tabs de Planes o Biblioteca con el mismo marco visual en las 3 áreas. */
export function NutritionAreaTabsStrip({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn(nutritionTabsStripClass, 'px-1 py-1', className)}>{children}</div>
}
