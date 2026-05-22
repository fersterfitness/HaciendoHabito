/**
 * Escapa `%` y `_` para filtros PostgREST `.ilike()` y evita wildcards accidentales.
 */
export function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}
