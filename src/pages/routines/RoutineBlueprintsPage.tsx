import { Navigate } from 'react-router-dom'

/** Redirige al listado unificado de rutinas (pestaña Plantillas). */
export function RoutineBlueprintsPage() {
  return <Navigate to="/routines?tab=plantillas" replace />
}
