/**
 * El título guardado repite tipo, paciente y mes («Anamnesis de Ana Pérez Inicial 11-2026»), que ya
 * se ven en la fila. Se muestra solo el nombre del archivo; el título completo queda en el tooltip.
 */
export function shortDocumentTitle(title: string, patientName: string) {
  const esc = patientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const t = title
    .replace(new RegExp(`^Anamnesis de ${esc}\\s+`, 'i'), '')
    .replace(new RegExp(`^Estudio · ${esc} · `, 'i'), '')
    .replace(/^Antropometría\s+/i, '')
    .replace(/\s+\d{2}-\d{4}$/, '')
    .trim()
  return t && !/^\d{2}-\d{4}$/.test(t) ? t : title
}
