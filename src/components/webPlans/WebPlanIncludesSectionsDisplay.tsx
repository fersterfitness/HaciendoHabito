import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IntakeIncludeSectionView } from '@/lib/webPlanIncludeSections'

type Props = {
  sections: IntakeIncludeSectionView[]
  /** Tarjeta oscura del panel de planes o detalle. */
  darkChrome?: boolean
  /** Título global encima de las secciones (ej. «Incluye»). */
  listTitle?: string
  className?: string
  checkSize?: number
}

export function WebPlanIncludesSectionsDisplay({
  sections,
  darkChrome = false,
  listTitle = 'Incluye',
  className,
  checkSize = 14,
}: Props) {
  if (!sections.length) return null

  const titleClass = darkChrome
    ? 'text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45'
    : 'text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400'

  const sectionHeadingClass = (s: IntakeIncludeSectionView) =>
    darkChrome ? cn('text-xs font-bold uppercase tracking-wide', s.headingClassDark) : cn('text-xs font-bold uppercase tracking-wide', s.headingClassLight)

  const itemTextClass = darkChrome ? 'text-white/78' : 'text-neutral-600'

  return (
    <div className={className}>
      {listTitle ? <p className={cn('mb-2', titleClass)}>{listTitle}</p> : null}
      <div className="flex flex-col gap-4">
        {sections.map((sec) => (
          <div key={sec.professional}>
            <p className={cn('mb-1.5', sectionHeadingClass(sec))}>{sec.title}</p>
            <ul className="flex flex-col gap-1.5">
              {sec.items.map((text, idx) => (
                <li key={`${sec.professional}-${idx}`} className="flex items-start gap-2">
                  <Check
                    size={checkSize}
                    strokeWidth={2.8}
                    className={cn(
                      'mt-0.5 shrink-0',
                      darkChrome ? sec.checkClassDark : sec.checkClassLight,
                    )}
                  />
                  <span className={cn('text-[13px] font-medium leading-snug', itemTextClass)}>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
