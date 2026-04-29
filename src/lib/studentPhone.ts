/**
 * Teléfono alumno Argentina en formato guardado legible para humanos / tel: link.
 *
 * Ej.: +54 11 59059170 (+54 · código área sin 0 · número local/incluye móvil)
 * wa.me necesita dígitos consecutivos: 541159059170
 */

/** Formato canónico: +54, espacio, 2–4 dígitos zona, espacio, 6–11 dígitos resto (total típico 14–21 caracteres) */
export const STUDENT_PHONE_FORMAT_HINT = '+54 11 59059170'

const CANON_AFTER_NORMALIZE_SPACE = /^\+54\s+([1-9]\d{1,3})\s+(\d{6,11})$/

/**
 * Une espacios y valida formato. Devuelve el string canónico o null si no cumple reglas.
 */
export function canonicalizeArgentinaStudentPhone(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, ' ')
  if (!t) return null
  if (!CANON_AFTER_NORMALIZE_SPACE.test(t)) return null
  const m = t.match(CANON_AFTER_NORMALIZE_SPACE)
  if (!m) return null
  const [, area, local] = m
  return `+54 ${area} ${local}`
}

/** Teléfono vacío válido para campos opcionales; distingue vacío vs inválido. */
export function isEmptyStudentPhone(raw: string | null | undefined): boolean {
  return !raw?.trim()
}

/** true si viene algo escrito pero no coincide con el formato esperado. */
export function isInvalidArgentinaStudentPhoneInput(raw: string | null | undefined): boolean {
  return Boolean(raw?.trim()) && canonicalizeArgentinaStudentPhone(raw!) === null
}

/**
 * Solo dígitos internacionales (sin +) para https://wa.me/<digits>.
 * Espera formato canónico guardado en estudiantes.
 */
export function studentPhoneDigitsForWhatsApp(storedCanon: string | null | undefined): string | null {
  if (!storedCanon?.trim()) return null
  const canon = canonicalizeArgentinaStudentPhone(storedCanon.trim())
  if (!canon) return null
  const d = canon.replace(/\D/g, '')
  if (!d.startsWith('54')) return null
  // Mínimo razonable: +54 zona (≥2 dígitos) + abonado (≥6 dígitos) → típicamente ≥10 dígitos totales
  if (d.length < 10) return null
  return d
}
