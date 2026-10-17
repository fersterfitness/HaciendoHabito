import { ClipboardList, FileText } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { canSeeNutrition } from '@/config/navigation'
import { SegmentedControl, type SegmentedItem } from '@/components/ui/SegmentedControl'

/**
 * Pestañas de Planes del nutricionista: biblioteca de plantillas (`/nutrition/plans`)
 * y constructor «Armar plan» (`/nutrition/planning`), en rutas separadas.
 */
export function NutritionPlansTabs({ className }: { className?: string }) {
  const role = useAuthStore((s) => s.profile?.role)
  // La biblioteca de plantillas requiere rol de nutrición; los entrenadores solo usan el constructor.
  const items: SegmentedItem[] = [
    ...(canSeeNutrition(role)
      ? [{ id: 'plans', to: '/nutrition/plans', label: 'Planes', icon: FileText } satisfies SegmentedItem]
      : []),
    { id: 'planning', to: '/nutrition/planning', label: 'Armar plan', icon: ClipboardList },
  ]
  // Una sola pestaña no aporta navegación.
  if (items.length < 2) return null
  return <SegmentedControl ariaLabel="Planes" items={items} className={className} />
}
