import { IS_V2 } from '@/lib/uiVersion'
import { Apple, Salad } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { canSeeNutrition } from '@/config/navigation'
import { SegmentedControl, type SegmentedItem } from '@/components/ui/SegmentedControl'

/** Pestañas de la Biblioteca: alimentos y menús estacionales (rutas separadas). */
export function NutritionLibraryTabs({ className }: { className?: string }) {
  const role = useAuthStore((s) => s.profile?.role)
  // v2 · nutricionista: «Menús» y «Alimentos» son dos entradas del menú lateral; acá no hacen falta pestañas.
  if (IS_V2 && role === 'nutritionist') return null
  // Los menús estacionales requieren rol de nutrición; entrenadores solo ven alimentos.
  const items: SegmentedItem[] = [
    { id: 'foods', to: '/nutrition/foods', label: 'Alimentos', icon: Apple },
    ...(canSeeNutrition(role)
      ? [{ id: 'menus', to: '/nutrition/menus', label: 'Menús estacionales', icon: Salad } satisfies SegmentedItem]
      : []),
  ]
  if (items.length < 2) return null
  return <SegmentedControl ariaLabel="Biblioteca" items={items} className={className} />
}
