import { TopBarV2 } from '@/components/v2/TopBarV2'
import { PageV2 } from '@/components/v2/ui'
import { TrainingMonitorCardV2 } from '@/components/dashboard/TrainingMonitorCardV2'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { useAuthStore } from '@/stores/authStore'

/**
 * v2 · Monitor de entrenamiento: pantalla propia (antes vivía en el Inicio y lo llenaba). Métricas del
 * día, gráficos de la semana y del ritmo de hoy, quién está entrenando en vivo y el detalle por alumno.
 */
export function TrainingMonitorPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useAppNavigate()
  return (
    <>
      <TopBarV2 title="Monitor de entrenamiento" />
      <PageV2>{user ? <TrainingMonitorCardV2 ownerId={user.id} onOpenRoutine={(rid) => navigate(`/routines/${rid}`)} /> : null}</PageV2>
    </>
  )
}
