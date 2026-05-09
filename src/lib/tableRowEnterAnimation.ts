import type { CSSProperties } from 'react'

/**
 * Cascada de filas “desde arriba” (`hh-row-drop-in` en cada `<td>`).
 * Poné `style={tableRowEnterStyle(i)}` en el `<tr>`; la variable CSS hereda a las celdas.
 */
export function tableRowEnterStyle(rowIndex: number): CSSProperties {
  return { ['--row-enter-delay']: `${Math.min(rowIndex, 36) * 148}ms` } as CSSProperties
}
