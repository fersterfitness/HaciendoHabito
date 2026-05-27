export function emptyToNull(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s ? s : null
}

/** Número con coma o punto decimal (ej. 67,5 o 67.5). */
export function parseLocaleNumber(raw: string): number {
  const t = raw.trim().replace(/\s+/g, '').replace(',', '.')
  if (!t) return NaN
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

export function parseLocaleNumberOrZero(raw: string): number {
  const n = parseLocaleNumber(raw)
  return Number.isNaN(n) ? 0 : n
}

export function parseLocaleNumberOrNull(raw: string): number | null {
  if (!raw.trim()) return null
  const n = parseLocaleNumber(raw)
  return Number.isFinite(n) ? n : null
}

/**
 * Altura en cm: acepta centímetros (175) o metros con coma/punto si el valor es < 3,5 (1,75 → 175).
 */
export function parseHeightCmFromInput(raw: string): number | null {
  const n = parseLocaleNumber(raw)
  if (Number.isNaN(n) || n <= 0) return null
  if (n < 3.5) return Math.round(n * 1000) / 10
  return n
}

