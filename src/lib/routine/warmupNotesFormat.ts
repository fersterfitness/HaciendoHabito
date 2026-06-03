/**
 * Formatea entrada en calor para lista vertical (editor/PDF).
 * Respeta saltos de línea; si viene en una línea, separa por ítems numerados (1) 2) 1. …).
 */
export function formatWarmupDisplayLines(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  if (trimmed.includes('\n')) {
    return trimmed
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
  }

  const numbered = trimmed.split(/(?=\d+[).]\s*)/).map((p) => p.trim()).filter(Boolean)
  if (numbered.length > 1) return numbered

  return [trimmed]
}
