/**
 * Parser inline mínimo para el texto de las celdas del plan nutricional.
 * Soporta solo dos marcas, compatibles con texto plano ya cargado:
 *   - **negrita**
 *   - _itálica_
 *
 * Devuelve una lista de segmentos con flags de estilo, preservando los saltos
 * de línea dentro del texto de cada segmento. No soporta anidación (negrita +
 * itálica al mismo tiempo) a propósito: mantiene el render simple y predecible
 * tanto en web como en el PDF.
 */
export interface InlineMarkdownSegment {
  text: string
  bold?: boolean
  italic?: boolean
}

// `**...**` (negrita) o `_..._` (itálica). No greedy, no cruza otra marca.
const INLINE_PATTERN = /(\*\*)(.+?)\*\*|(_)(.+?)_/g

export function parseInlineMarkdown(input: string): InlineMarkdownSegment[] {
  if (!input) return []

  const segments: InlineMarkdownSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  INLINE_PATTERN.lastIndex = 0
  while ((match = INLINE_PATTERN.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: input.slice(lastIndex, match.index) })
    }
    if (match[1] === '**') {
      segments.push({ text: match[2], bold: true })
    } else {
      segments.push({ text: match[4], italic: true })
    }
    lastIndex = INLINE_PATTERN.lastIndex
  }

  if (lastIndex < input.length) {
    segments.push({ text: input.slice(lastIndex) })
  }

  return segments
}
