import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'

/**
 * Mensaje legible cuando `functions.invoke` devuelve error (el body JSON
 * del Edge Function suele tener `error`, `hint` o `message`).
 */
export async function formatFunctionsInvokeError(err: unknown): Promise<string> {
  if (err instanceof FunctionsHttpError && err.context instanceof Response) {
    const res = err.context
    try {
      const ct = res.headers.get('content-type') ?? ''
      if (ct.includes('application/json')) {
        const j = (await res.clone().json()) as {
          error?: string
          message?: string
          hint?: string
          role?: string
        }
        if (j.error === 'sin_perfil' && j.hint) return j.hint
        if (j.message && j.error !== 'sin_permiso_nutricion') return j.message
        if (j.error === 'usda_api_key_invalida' && j.hint) return j.hint
        if (j.error === 'falta_USDA_FDC_API_KEY')
          return 'Falta la clave USDA en Supabase Secrets (USDA_FDC_API_KEY). Pedile eso quien gestione el proyecto.'
        if (j.error === 'configuracion_incompleta')
          return 'La función Edge no tiene URL o anon key de Supabase. Contactá soporte técnico.'
        if (j.error === 'no_autenticado') return 'Sesión vencida o no iniciada: cerrá sesión y volvé a entrar.'
        if (j.error === 'sin_permiso_nutricion') {
          if (typeof j.role === 'string' && j.role !== '') {
            return `Tu cuenta tiene rol "${j.role}". Solo trainer, nutritionist o admin pueden buscar en USDA.${j.hint ? ` ${j.hint}` : ''}`
          }
          return j.hint ?? 'Tu perfil no tiene permiso para usar la guía USDA.'
        }
        if (j.error === 'perfil_no_legible' && j.message)
          return `No se pudo leer tu perfil: ${j.message}`
        if (j.message) return j.message
        if (j.error === 'fdc_error' && typeof j.message === 'string') return `USDA no respondió: ${j.message}`
        if (j.error) return j.error
      }
    } catch {
      /* usar fallback abajo */
    }
    if (res.status === 404)
      return 'La función food-nutrition-lookup no está desplegada en este proyecto. Deploy con: supabase functions deploy food-nutrition-lookup'
    return `Error del servicio (${res.status}). Si acabás de subir la función, esperá unos segundos y reintentá.`
  }
  if (err instanceof FunctionsFetchError) {
    return 'No se pudo conectar con la función en la nube. Revisá tu red o que el proyecto Supabase esté activo.'
  }
  if (err instanceof Error) return err.message
  return 'Error desconocido al llamar la función.'
}
