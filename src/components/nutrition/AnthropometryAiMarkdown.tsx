import { parseInlineMarkdown } from '@/lib/nutrition/inlineMarkdown'
import { cn } from '@/lib/utils'

function InlineMd({ text }: { text: string }) {
  return (
    <>
      {parseInlineMarkdown(text).map((seg, i) => (
        <span
          key={i}
          className={cn(seg.bold && 'font-semibold text-ink-primary', seg.italic && 'italic')}
        >
          {seg.text}
        </span>
      ))}
    </>
  )
}

/** Render mínimo del Markdown del análisis IA (## títulos, viñetas, párrafos). */
export function AiMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: JSX.Element[] = []
  let bullets: string[] = []

  const flushBullets = () => {
    if (bullets.length === 0) return
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="ml-1 space-y-1.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2 text-sm text-ink-secondary">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-tertiary" aria-hidden />
            <span className="leading-relaxed">
              <InlineMd text={b} />
            </span>
          </li>
        ))}
      </ul>,
    )
    bullets = []
  }

  lines.forEach((raw) => {
    const line = raw.trimEnd()
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    if (heading) {
      flushBullets()
      blocks.push(
        <p
          key={`h-${blocks.length}`}
          className="mt-1 text-xs font-semibold text-brand-tertiary"
        >
          <InlineMd text={heading[1] ?? ''} />
        </p>,
      )
    } else if (bullet) {
      bullets.push(bullet[1] ?? '')
    } else if (line.trim() === '') {
      flushBullets()
    } else {
      flushBullets()
      blocks.push(
        <p key={`p-${blocks.length}`} className="text-sm leading-relaxed text-ink-secondary">
          <InlineMd text={line} />
        </p>,
      )
    }
  })
  flushBullets()

  return <div className="space-y-3">{blocks}</div>
}

