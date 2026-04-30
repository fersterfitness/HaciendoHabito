/** Filas parseadas desde `students.notes` (formulario web, texto libre, etc.). */
export type StudentNoteRow =
  | { kind: 'meta'; content: string }
  | { kind: 'pair'; label: string; value: string }
  | { kind: 'free'; content: string }

/**
 * Convierte notas multilínea en bloques etiquetados cuando el formato es "Clave: valor"
 * o líneas entre corchetes [Origen: ...].
 */
export function parseStudentNotesDisplay(raw: string): StudentNoteRow[] {
  const lines = raw.split(/\r?\n/)
  const rows: StudentNoteRow[] = []

  for (let line of lines) {
    line = line.trim()
    if (!line) continue

    if (line.startsWith('[') && line.endsWith(']')) {
      rows.push({ kind: 'meta', content: line.slice(1, -1).trim() })
      continue
    }

    const colon = line.indexOf(':')
    if (colon > 0 && colon < 100) {
      const label = line.slice(0, colon).trim()
      const value = line.slice(colon + 1).trim()
      if (label.length >= 1 && label.length <= 120) {
        rows.push({ kind: 'pair', label, value: value.length > 0 ? value : '—' })
        continue
      }
    }

    rows.push({ kind: 'free', content: line })
  }

  return rows
}
