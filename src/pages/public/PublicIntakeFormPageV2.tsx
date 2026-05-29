/**
 * /v2/form — versión experimental del formulario público.
 * Misma UI que /form; enlaces de panel apuntan a /v2/login.
 */
import { PublicIntakeFormPage } from './PublicIntakeFormPage'

export function PublicIntakeFormPageV2() {
  return <PublicIntakeFormPage loginHref="/v2/login" />
}
