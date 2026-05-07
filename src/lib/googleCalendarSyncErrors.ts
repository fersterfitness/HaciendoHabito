/** Errores devueltos por la Edge Function `create-google-calendar-event`. */

export function isGoogleOAuthRefreshRevoked(serverMessage: string): boolean {
  const s = serverMessage.toLowerCase()
  return s.includes('invalid_grant') || s.includes('expired or revoked')
}

/** Texto corto técnico (sin el prefijo repetido del toast). */
function stripTokenRefreshNoise(serverMessage: string): string {
  return serverMessage.replace(/^Google token refresh failed:\s*/i, '').trim()
}

export type GoogleCalendarFailureKind = 'oauth_revoked' | 'other'

/**
 * Mensaje para mostrar cuando el turno ya está guardado pero falló Google Calendar.
 */
export function parseGoogleCalendarSyncFailure(serverMessage: string): {
  kind: GoogleCalendarFailureKind
  title: string
  body: string
} {
  const raw = serverMessage.trim()
  if (!raw) {
    return {
      kind: 'other',
      title: 'Sin sincronizar con Google Calendar',
      body: 'No hubo respuesta del servidor. Reintentá más tarde o revisá los logs de Supabase.',
    }
  }

  if (isGoogleOAuthRefreshRevoked(raw)) {
    return {
      kind: 'oauth_revoked',
      title: 'Turno guardado · Google Calendar desconectado',
      body:
        'Google rechazó el token de renovación (venció o se revocó el acceso en la cuenta de Google). Quien administra el proyecto debe obtener un nuevo refresh OAuth y ejecutar supabase secrets set GOOGLE_REFRESH_TOKEN=… junto con GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET si aplica. La agenda dentro de esta app sigue funcionando.',
    }
  }

  let detail = stripTokenRefreshNoise(raw)
  try {
    const parsed = JSON.parse(detail)
    if (parsed && typeof parsed === 'object' && 'error_description' in parsed && typeof (parsed as { error_description?: string }).error_description === 'string') {
      detail = (parsed as { error_description: string }).error_description
    }
  } catch {
    /* detail ya es texto */
  }
  if (detail.length > 240) detail = `${detail.slice(0, 237)}…`

  return {
    kind: 'other',
    title: 'Turno guardado · Google Calendar',
    body: detail,
  }
}
