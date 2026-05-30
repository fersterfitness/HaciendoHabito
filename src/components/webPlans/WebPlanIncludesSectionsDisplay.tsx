import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IntakeProAvatar, intakeProAvatarFocusForRole } from '@/components/public/intake/IntakeProAvatar'
import type { IntakeIncludeSectionView } from '@/lib/webPlanIncludeSections'

export type WebPlanGiftLine = string | { text: string }

type Props = {
  sections: IntakeIncludeSectionView[]
  /** Tarjeta oscura del panel de planes o detalle. */
  darkChrome?: boolean
  /** Título global encima de las secciones (ej. «Incluye»). */
  listTitle?: string
  className?: string
  checkSize?: number
  /** Foto en la fila del título (no al lado de cada ítem). */
  showProfessionalAvatars?: boolean
  /** Ítems de regalo bajo el mismo bloque visual que «Incluye». */
  gifts?: WebPlanGiftLine[]
  giftsLabel?: string
  /** Marcador de cada ítem: tilde (default) o viñeta minimal estilo pricing. */
  marker?: 'check' | 'dot'
  /** Separación entre secciones: barra de acento lateral (default) o hairline sutil. */
  sectionDivider?: 'accent' | 'subtle'
}

function giftLineText(g: WebPlanGiftLine): string {
  return typeof g === 'string' ? g : g.text
}

function FeatureCheckList({
  items,
  checkSize,
  checkClass,
  itemTextClass,
  keyPrefix,
  marker = 'check',
}: {
  items: string[]
  checkSize: number
  checkClass: string
  itemTextClass: string
  keyPrefix: string
  marker?: 'check' | 'dot'
}) {
  if (!items.length) return null
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((text, idx) => (
        <li key={`${keyPrefix}-${idx}`} className="flex items-start gap-2">
          {marker === 'dot' ? (
            <span
              aria-hidden
              className={cn('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', checkClass)}
              style={{ backgroundColor: 'currentColor' }}
            />
          ) : (
            <Check size={checkSize} strokeWidth={2.8} className={cn('mt-0.5 shrink-0', checkClass)} />
          )}
          <span className={cn('text-[13px] font-medium leading-snug', itemTextClass)}>{text}</span>
        </li>
      ))}
    </ul>
  )
}

export function WebPlanIncludesSectionsDisplay({
  sections,
  darkChrome = false,
  listTitle = 'Incluye',
  className,
  checkSize = 14,
  showProfessionalAvatars = false,
  gifts,
  giftsLabel = 'De regalo',
  marker = 'check',
  sectionDivider = 'accent',
}: Props) {
  const giftItems = (gifts ?? []).map(giftLineText).filter(Boolean)
  if (!sections.length && !giftItems.length) return null

  const eyebrowClass = darkChrome
    ? 'text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45'
    : 'text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400'

  const sectionHeadingClass = (s: IntakeIncludeSectionView) =>
    darkChrome
      ? cn('text-xs font-bold uppercase tracking-wide leading-tight', s.headingClassDark)
      : cn('text-xs font-bold uppercase tracking-wide leading-tight', s.headingClassLight)

  const subtitleClass = darkChrome ? 'text-[11px] leading-snug text-white/55' : 'text-[11px] leading-snug text-neutral-500'
  const itemTextClass = darkChrome ? 'text-white/78' : 'text-neutral-600'
  const giftCheckClass = darkChrome ? 'text-emerald-400/75' : 'text-emerald-600/85'
  const dividerClass = darkChrome ? 'border-white/10' : 'border-neutral-200/80'

  const sectionAccentClass = (s: IntakeIncludeSectionView) =>
    darkChrome ? s.accentBarClassDark : s.accentBarClassLight

  return (
    <div className={className}>
      {sections.length > 0 ? (
        <div className="space-y-4">
          {listTitle ? <p className={eyebrowClass}>{listTitle}</p> : null}
          <div className={cn('flex flex-col', sectionDivider === 'subtle' ? 'gap-3.5' : 'gap-5')}>
            {sections.map((sec, idx) => (
              <section
                key={sec.professional}
                className={cn(
                  'space-y-2.5',
                  sectionDivider === 'subtle'
                    ? idx > 0 && cn('border-t pt-3.5', dividerClass)
                    : cn('border-l-2 pl-2.5', sectionAccentClass(sec)),
                )}
              >
                {showProfessionalAvatars ? (
                  <div className="flex items-center gap-3">
                    <IntakeProAvatar
                      label={sec.title}
                      url={sec.avatarUrl ?? null}
                      sizeClass="h-10 w-10"
                      theme={darkChrome ? 'dark' : 'light'}
                      focus={intakeProAvatarFocusForRole(sec.professional)}
                      priority
                      expandable
                    />
                    <div className="min-w-0 flex-1">
                      <p className={sectionHeadingClass(sec)}>{sec.title}</p>
                      {sec.subtitle?.trim() ? (
                        <p className={cn('mt-0.5', subtitleClass)}>{sec.subtitle.trim()}</p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className={sectionHeadingClass(sec)}>{sec.title}</p>
                    {sec.subtitle?.trim() ? (
                      <p className={cn('mt-0.5', subtitleClass)}>{sec.subtitle.trim()}</p>
                    ) : null}
                  </div>
                )}
                <FeatureCheckList
                  items={sec.items}
                  checkSize={checkSize}
                  checkClass={darkChrome ? sec.checkClassDark : sec.checkClassLight}
                  itemTextClass={itemTextClass}
                  keyPrefix={sec.professional}
                  marker={marker}
                />
              </section>
            ))}
          </div>
        </div>
      ) : null}

      {giftItems.length > 0 ? (
        <div
          className={cn(
            'space-y-2.5',
            sections.length > 0 && 'mt-5 border-t pt-4',
            sections.length > 0 && dividerClass,
          )}
        >
          <p className={eyebrowClass}>{giftsLabel}</p>
          <FeatureCheckList
            items={giftItems}
            checkSize={checkSize}
            checkClass={giftCheckClass}
            itemTextClass={itemTextClass}
            keyPrefix="gift"
            marker={marker}
          />
        </div>
      ) : null}
    </div>
  )
}
