import { parsePlanGeneralNotes } from '@/lib/nutrition/planGeneralNotes'
import { cn } from '@/lib/utils'

type Props = {
  value: string | null | undefined
  className?: string
  /** Tamaño de cuerpo: `sm` alinea al editor de plan; `xs` para listados. */
  size?: 'sm' | 'xs'
}

export function PlanGeneralNotesDisplay({ value, className, size = 'sm' }: Props) {
  const { preamble, aclaraciones } = parsePlanGeneralNotes(value)
  if (!preamble && aclaraciones.length === 0) return null

  const bodyClass = size === 'xs' ? 'text-xs leading-snug' : 'text-sm leading-snug'
  const labelClass =
    size === 'xs'
      ? 'text-[10px] font-semibold uppercase tracking-wider text-brand-secondary/90 mb-1'
      : 'text-[10px] font-semibold uppercase tracking-wider text-brand-secondary mb-1.5'

  return (
    <div className={cn('space-y-2.5', className)}>
      {preamble ? (
        <p className={cn(bodyClass, 'text-ink-secondary whitespace-pre-wrap')}>{preamble}</p>
      ) : null}
      {aclaraciones.length > 0 ? (
        <div>
          <p className={labelClass}>Aclaraciones</p>
          <ul className="space-y-1.5">
            {aclaraciones.map((item, index) => (
              <li key={index} className={cn('flex gap-2', bodyClass, 'text-ink-secondary')}>
                <span
                  className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-secondary"
                  aria-hidden
                />
                <span className="min-w-0 flex-1">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
