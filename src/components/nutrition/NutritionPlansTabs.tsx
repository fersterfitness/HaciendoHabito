import { ClipboardList, FileText } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { useAuthStore } from '@/stores/authStore'
import { canSeeNutrition } from '@/config/navigation'
import { Tabs, type TabItem } from '@/components/ui/Tabs'

const PLANS_PATH = '/nutrition/plans'
const PLANNING_PATH = '/nutrition/planning'

/**
 * Pestañas de navegación de Planes del nutricionista. Unifica en un solo acceso
 * de menú la biblioteca de plantillas (`/nutrition/plans`) y el constructor
 * «Armar plan» (`/nutrition/planning`), que siguen viviendo en rutas separadas.
 */
export function NutritionPlansTabs({ className }: { className?: string }) {
  const navigate = useAppNavigate()
  const { pathname } = useLocation()
  const role = useAuthStore((s) => s.profile?.role)
  const active = pathname.startsWith(PLANNING_PATH) ? PLANNING_PATH : PLANS_PATH

  // La biblioteca de plantillas requiere rol de nutrición; los entrenadores solo
  // usan el constructor. Sin la pestaña evitamos un redirect a /dashboard.
  const tabs: TabItem[] = [
    ...(canSeeNutrition(role)
      ? [{ id: PLANS_PATH, label: 'Planes', icon: <FileText /> } satisfies TabItem]
      : []),
    { id: PLANNING_PATH, label: 'Armar plan', icon: <ClipboardList /> },
  ]

  // Una sola pestaña no aporta navegación: no mostramos el strip.
  if (tabs.length < 2) return null

  return (
    <Tabs
      tabs={tabs}
      active={active}
      onChange={(id) => {
        if (id !== active) navigate(id)
      }}
      ariaLabel="Planes"
      className={className}
    />
  )
}
