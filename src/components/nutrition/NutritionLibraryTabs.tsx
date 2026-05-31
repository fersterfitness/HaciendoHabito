import { Apple, Salad } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { useAuthStore } from '@/stores/authStore'
import { canSeeNutrition } from '@/config/navigation'
import { NutritionAreaTabsStrip } from '@/components/nutrition/NutritionAreaTabsStrip'
import { Tabs, type TabItem } from '@/components/ui/Tabs'

const FOODS_PATH = '/nutrition/foods'
const MENUS_PATH = '/nutrition/menus'

/**
 * Pestañas de navegación de la Biblioteca del nutricionista. Unifica en un solo
 * acceso de menú las dos vistas (alimentos y menús estacionales), que siguen
 * viviendo en rutas separadas para no romper enlaces existentes.
 */
export function NutritionLibraryTabs({ className }: { className?: string }) {
  const navigate = useAppNavigate()
  const { pathname } = useLocation()
  const role = useAuthStore((s) => s.profile?.role)
  const active = pathname.startsWith(MENUS_PATH) ? MENUS_PATH : FOODS_PATH

  // Los menús estacionales requieren rol de nutrición; entrenadores solo ven
  // la guía de alimentos. Sin la pestaña, evitamos un redirect a /dashboard.
  const tabs: TabItem[] = [
    { id: FOODS_PATH, label: 'Alimentos', icon: <Apple /> },
    ...(canSeeNutrition(role)
      ? [{ id: MENUS_PATH, label: 'Menús estacionales', icon: <Salad /> } satisfies TabItem]
      : []),
  ]

  // Una sola pestaña no aporta navegación: no mostramos el strip.
  if (tabs.length < 2) return null

  return (
    <NutritionAreaTabsStrip className={className}>
      <Tabs
        tabs={tabs}
        active={active}
        onChange={(id) => {
          if (id !== active) navigate(id)
        }}
        ariaLabel="Biblioteca"
      />
    </NutritionAreaTabsStrip>
  )
}
