export function emptyToNull(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s ? s : null
}

