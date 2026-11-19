import { readIntakeAccessSession } from '@/lib/intake/webIntakeAccess'

/**
 * Feedback nov19 (tanda 6): la página vieja de inscripción (`/form`, «Elegí tu plan») ya no va; la web es
 * «Armá tu equipo» (`/profesionales`). Solo sigue abriendo para quien ya pidió acceso en este navegador
 * (para que termine su inscripción) o con `?continuar` (el que lo pidió desde otro dispositivo).
 */
export function keepsLegacyIntake(search: string): boolean {
  if (new URLSearchParams(search).has('continuar')) return true
  return readIntakeAccessSession() !== null
}
