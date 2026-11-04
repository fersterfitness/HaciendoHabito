import { Dumbbell, Users } from 'lucide-react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useAuthStore } from '@/stores/authStore'
import { canSeeTraining } from '@/config/navigation'
import { IS_V2 } from '@/lib/uiVersion'

export function AdvisoriesSectionNav() {
  const role = useAuthStore((s) => s.profile?.role)
  // En la v2 Alumnos y Rutinas ya están en el menú: las pestañas sobran.
  if (IS_V2 || !canSeeTraining(role)) return null

  return (
    <SegmentedControl
      ariaLabel="Asesorías"
      fullWidth
      className="mb-4 max-w-md"
      items={[
        { id: 'students', to: '/students', label: 'Alumnos', icon: Users },
        { id: 'routines', to: '/routines', label: 'Rutinas', icon: Dumbbell },
      ]}
    />
  )
}
