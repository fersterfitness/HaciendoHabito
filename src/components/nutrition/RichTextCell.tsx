import { useEffect, useRef } from 'react'
import { Bold, Italic } from 'lucide-react'
import { parseInlineMarkdown } from '@/lib/nutrition/inlineMarkdown'
import { cn } from '@/lib/utils'

/**
 * Celda de edición WYSIWYG para los menús del plan nutricional.
 *
 * - El usuario ve el texto ya formateado (negrita / itálica reales), nunca los
 *   asteriscos de markdown.
 * - Internamente se sigue guardando markdown plano (`**negrita**`, `_itálica_`)
 *   en `string`, así el resto del sistema (PDF, datos ya cargados) no cambia.
 *
 * El `contentEditable` es NO controlado por React: sólo escribimos su `innerHTML`
 * cuando el `value` cambia desde afuera (ej. cambiar de plantilla), nunca en cada
 * tecla, para no romper la posición del cursor.
 */

function escapeHtml(input: string): string {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** markdown → HTML para pintar la celda. Usa <br> (no <div>) para los saltos. */
export function markdownToHtml(md: string): string {
  if (!md) return ''
  return parseInlineMarkdown(md)
    .map((seg) => {
      const html = escapeHtml(seg.text).replace(/\n/g, '<br>')
      if (seg.bold) return `<strong>${html}</strong>`
      if (seg.italic) return `<em>${html}</em>`
      return html
    })
    .join('')
}

/** Envuelve cada línea no vacía por separado para no cruzar saltos con la marca. */
function wrapPerLine(inner: string, marker: string): string {
  return inner
    .split('\n')
    .map((line) => (line.length ? `${marker}${line}${marker}` : ''))
    .join('\n')
}

function elementIsBold(el: HTMLElement): boolean {
  if (el.tagName === 'B' || el.tagName === 'STRONG') return true
  const fw = el.style.fontWeight
  return fw === 'bold' || (!!fw && Number(fw) >= 600)
}

function elementIsItalic(el: HTMLElement): boolean {
  if (el.tagName === 'I' || el.tagName === 'EM') return true
  return el.style.fontStyle === 'italic'
}

function serializeNode(node: Node, isFirst: boolean): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (!(node instanceof HTMLElement)) return ''

  if (node.tagName === 'BR') return '\n'

  if (node.tagName === 'DIV' || node.tagName === 'P') {
    // Línea vacía generada por el navegador: <div><br></div> → un solo salto.
    const onlyBr = node.childNodes.length === 1 && node.firstChild?.nodeName === 'BR'
    const inner = onlyBr ? '' : serializeChildren(node)
    return (isFirst ? '' : '\n') + inner
  }

  let inner = serializeChildren(node)
  if (elementIsBold(node) && inner.trim()) inner = wrapPerLine(inner, '**')
  else if (elementIsItalic(node) && inner.trim()) inner = wrapPerLine(inner, '_')
  return inner
}

/** HTML del contentEditable → markdown. */
function serializeChildren(parent: Node): string {
  const parts: string[] = []
  parent.childNodes.forEach((child, i) => {
    parts.push(serializeNode(child, i === 0))
  })
  // Colapsa más de 2 saltos seguidos para mantener estable el round-trip.
  return parts.join('').replace(/\n{3,}/g, '\n\n')
}

interface Props {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  className?: string
}

export function RichTextCell({ value, onChange, placeholder, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  // Último markdown emitido por nosotros: evita reescribir el DOM mientras se tipea.
  const lastEmitted = useRef<string | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (value !== lastEmitted.current) {
      el.innerHTML = markdownToHtml(value)
      lastEmitted.current = value
    }
  }, [value])

  function emit() {
    const el = ref.current
    if (!el) return
    const md = serializeChildren(el)
    lastEmitted.current = md
    onChange(md)
  }

  function exec(command: 'bold' | 'italic') {
    ref.current?.focus()
    document.execCommand(command)
    emit()
  }

  const isEmpty = !value.trim()

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-0.5 px-1.5 pt-1">
        <button
          type="button"
          title="Negrita"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('bold')}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-ink-muted hover:bg-brand-secondary/10 hover:text-brand-secondary"
        >
          <Bold className="h-3 w-3" />
        </button>
        <button
          type="button"
          title="Itálica"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('italic')}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-ink-muted hover:bg-brand-secondary/10 hover:text-brand-secondary"
        >
          <Italic className="h-3 w-3" />
        </button>
      </div>
      <div className="relative flex-1">
        {isEmpty && placeholder ? (
          <span className="pointer-events-none absolute left-2 top-2 text-xs leading-snug text-ink-muted/50">
            {placeholder}
          </span>
        ) : null}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          onInput={emit}
          className={cn(
            'min-h-[6rem] w-full whitespace-pre-wrap break-words px-2 py-2 text-xs leading-snug text-ink-primary',
            'focus:outline-none focus:ring-1 focus:ring-brand-secondary/30',
            className,
          )}
        />
      </div>
    </div>
  )
}
