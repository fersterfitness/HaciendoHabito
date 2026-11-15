import { TopBarV2 } from '@/components/v2/TopBarV2'
import { PageV2 } from '@/components/v2/ui'
import { TrainingMonitorBoardV2 } from '@/components/dashboard/TrainingMonitorBoardV2'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { useAuthStore } from '@/stores/authStore'

/**
 * v2 · Monitor de entrenamiento: pantalla propia, con el tablero en vivo (consola, pistas, actividad y
 * asistencia de la semana).
 */
export function TrainingMonitorPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useAppNavigate()
  return (
    <>
      <TopBarV2 title="Monitor de entrenamiento" />
      <PageV2>{user ? <TrainingMonitorBoardV2 ownerId={user.id} onOpenRoutine={(rid) => navigate(`/routines/${rid}`)} /> : null}</PageV2>
    </>
  )
}
