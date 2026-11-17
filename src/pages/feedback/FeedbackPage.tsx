import { Navigate, useSearchParams } from 'react-router-dom'
import { TrainerResourcesPage } from '@/pages/training/TrainerResourcesPage'
import { Header } from '@/components/layout/Header'

/**
 * Feedback nov3: «Consultas semanales» dejó de existir. Las respuestas de cada alumno están en su ficha
 * (Progreso); «Enviar» y «Formularios» se fueron porque el chequeo diario es obligatorio en el link.
 * Queda Recursos como menú propio. `/feedback` redirige para no romper links viejos.
 */
export function FeedbackPage() {
  const [params] = useSearchParams()
  return <Navigate to={params.get('tab') === 'recursos' ? '/resources' : '/students'} replace />
}

/** Recursos: plantillas de texto y recordatorios de envío por WhatsApp. */
export function ResourcesPage() {
  return (
    <div>
      <Header title="Recursos" />
      <TrainerResourcesPage embedded />
    </div>
  )
}
