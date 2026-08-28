import { Navigate } from 'react-router-dom'

/** Las plantillas viven en Base de datos → Rutinas preestablecidas. */
export function RoutineBlueprintsPage() {
  return <Navigate to="/exercises/blueprints" replace />
}
