/**
 * Bloque tipo changeable-pricing (referencia tipo Watermelon).
 * `tone="card"`: en `uiTheme="light"` usa cromado claro embebido; en `uiTheme="dark"` mismo layout con superficies oscuras.
 */
import { useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { intakePanelPlansCtaClass } from '@/lib/intake/intakePanelUi'
import {
  type PlanBilling,
  type IntakeNormalizedPricingPlan,
} from '@/lib/publicIntakePlanPricing'
import { WebPlanIncludesSectionsDisplay } from '@/components/webPlans/WebPlanIncludesSectionsDisplay'
import type { IntakeIncludeSectionAvatarMap } from '@/lib/webPlanIncludeSections'
import { attachAvatarsToIncludeSectionViews } from '@/lib/webPlanIncludeSections'

export type PlanId = string

export type { PlanBilling }

export type IntakePricingUiTheme = 'light' | 'dark'

export interface PricingFeatureItem {
  text: string
  hasInfo?: boolean
}

export interface IntakeChangeablePlansSectionProps {
  title?: string
  footerText?: string
  buttonText?: string
  plans: IntakeNormalizedPricingPlan[]
  selectedPlanId: PlanId | null
  onSelectPlan: (id: PlanId) => void
  onContinue?: () => void
  badgeVariant?: 'green' | 'amber'
  /** `hero` sólo modo oscuro con marco típico hero; `card` alterna claro u oscuro según `uiTheme`. */
  tone?: 'card' | 'hero'
  embedded?: boolean
  /** Tema visual del bloque (alinear con ThemeContext del formulario público). */
  uiTheme?: IntakePricingUiTheme
  /** Con `embedded`: sin segundo recuadro ni relleno exterior (más limpio dentro de una sola card padre). */
  flush?: boolean
  billing: PlanBilling
  onBillingChange: (mode: PlanBilling) => void
  /** Fotos por rol para cada bloque del «Incluye». */
  includeSectionAvatars?: IntakeIncludeSectionAvatarMap
  /** Pie de sección (ej. cancelación). */
  showFooter?: boolean
}

function normalizeBadgeClass(variant: 'green' | 'amber', dark: boolean) {
  if (variant === 'amber') {
    return dark
      ? 'border border-white/12 bg-white/[0.06] text-white/65'
      : 'border border-neutral-200 bg-neutral-100 text-neutral-700'
  }
  return dark ? 'bg-emerald-500/15 text-emerald-300' : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
}

function badgeChipClass(planBadge: string | undefined | null, variant: 'green' | 'amber', dark: boolean): string {
  const raw = planBadge?.trim() ?? ''
  if (/popular|recomendado|destacado/i.test(raw)) {
    return dark ? 'border border-emerald-400/40 bg-emerald-500/20 text-emerald-200' : 'border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold'
  }
  return normalizeBadgeClass(variant, dark)
}

export function IntakeChangeablePlansSection({
  title = 'Elegí un plan',
  footerText = 'Cancelá cuando quieras · Sin compromiso a largo plazo.',
  buttonText = 'Ver detalle',
  plans,
  selectedPlanId,
  onSelectPlan,
  onContinue,
  badgeVariant = 'green',
  tone = 'card',
  embedded = false,
  uiTheme = 'light',
  flush = false,
  billing,
  onBillingChange,
  includeSectionAvatars = {},
  showFooter = true,
}: IntakeChangeablePlansSectionProps) {
  const heroTone = tone === 'hero'
  const lightChrome = tone === 'card' && uiTheme === 'light'
  /** Modo oscuro: hero explícito o card oscuro integrado al panel */
  const darkChrome = heroTone || (tone === 'card' && uiTheme === 'dark')
  const flushEmbed = Boolean(embedded && flush)
  const lightInsetChrome = embedded && lightChrome && !flushEmbed
  const darkInsetChrome = embedded && darkChrome && !flushEmbed
  const glassShell = heroTone && !embedded

  const selectedRing = useMemo(() => {
    if (lightChrome) {
      return cn(
        'border border-neutral-300/90 bg-gradient-to-b from-white via-neutral-50/80 to-transparent',
        'shadow-[0_4px_20px_rgba(15,23,42,0.08)] ring-1 ring-neutral-200/80',
        'border-l-[3px] border-l-neutral-400/70',
      )
    }
    return cn(
      'border border-white/20 bg-white/[0.07]',
      'border-l-[3px] border-l-[rgb(255,72,0)]/70',
      'ring-1 ring-white/10',
      'shadow-[0_4px_24px_-6px_rgba(0,0,0,0.4)]',
    )
  }, [lightChrome])

  const unselectedRow = lightChrome
    ? cn(
        'border border-surface-border/80 bg-surface-card/80',
        'hover:border-neutral-300 hover:bg-neutral-50/80',
      )
    : cn(
        'border border-white/10 bg-black/20',
        'hover:border-white/18 hover:bg-white/[0.04]',
      )

  if (plans.length === 0) return null

  const toggleActive = darkChrome
    ? 'border border-[rgb(255,72,0)]/40 bg-[rgb(255,72,0)]/[0.12] !text-white shadow-[0_0_10px_rgba(255,72,0,0.2)]'
    : 'border border-surface-border bg-white text-ink-primary shadow-sm'
  const toggleInactive = darkChrome
    ? '!text-white/55 hover:!text-white/85 hover:bg-white/[0.05]'
    : 'text-ink-muted hover:text-ink-primary hover:bg-surface-elevated/80'

  return (
    <div
      className={cn(
        'w-full',
        lightInsetChrome &&
          'rounded-[20px] border border-neutral-200/80 bg-neutral-100/98 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-sm sm:p-3',
        darkInsetChrome &&
          'rounded-[20px] border border-white/10 bg-black/35 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md sm:p-3',
        glassShell && 'rounded-xl border border-white/10 bg-black/25 p-2 backdrop-blur-sm',
        embedded && heroTone && 'p-0',
        !embedded && lightChrome &&
          'max-w-[460px] rounded-[24px] border border-neutral-200/70 bg-neutral-100/95 p-1.5 shadow-lg ring-1 ring-neutral-200/60 backdrop-blur-md',
        !embedded && tone === 'card' && uiTheme === 'dark' &&
          'max-w-[460px] rounded-[24px] border border-neutral-700/75 bg-neutral-950/85 p-1.5 shadow-lg ring-1 ring-neutral-700/65 backdrop-blur-md',
      )}
    >
      <div
        className={cn(
          // Embebido en /form: siempre columna para que el toggle use todo el ancho y no lo corte overflow del padre.
          flushEmbed
            ? 'flex flex-col items-stretch gap-2.5'
            : 'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between',
          flushEmbed ? 'px-0 py-1' : darkChrome ? 'px-2 py-1.5' : lightChrome ? 'px-2 pb-1 pt-0.5 sm:px-3 sm:pb-2 sm:pt-1' : 'px-3 py-4',
          embedded && heroTone && 'px-0',
          darkInsetChrome && 'border-b border-white/[0.07] pb-2.5',
        )}
      >
        <h2
          className={cn(
            'font-semibold tracking-tight',
            flushEmbed
              ? lightChrome
                ? 'text-[10px] font-bold uppercase tracking-[0.14em] text-ink-secondary'
                : 'text-xs font-medium text-ink-muted'
              : heroTone
                ? 'text-xs font-medium text-white/55'
                : darkChrome && !heroTone
                  ? 'text-xs font-medium text-white/55'
                  : lightChrome
                    ? 'text-[15px] font-semibold text-ink-primary'
                    : 'text-[17px] font-medium text-ink-primary',
          )}
        >
          {title}
        </h2>
        <div
          className={cn(
            flushEmbed
              ? 'flex w-full min-w-0 flex-nowrap overflow-x-auto rounded-lg p-0.5 [-webkit-overflow-scrolling:touch] scrollbar-hide'
              : 'inline-flex max-w-full flex-nowrap self-start overflow-x-auto rounded-lg p-0.5 [-webkit-overflow-scrolling:touch] scrollbar-hide sm:self-auto',
            lightChrome
              ? 'border border-neutral-300/55 bg-neutral-200/90 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]'
              : darkChrome
                ? 'border border-white/[0.09] bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                : 'border border-neutral-300/50 bg-neutral-200/80 shadow-[inset_0_1px_1px_rgba(15,23,42,0.05)] dark:border-neutral-600/80 dark:bg-neutral-700/80 dark:shadow-none',
          )}
          role="group"
          aria-label="Plazo de pago: solo cambia el precio en las cards. Lo que ofrece cada opción está en cada oferta."
        >
          <button
            type="button"
            onClick={() => onBillingChange('monthly')}
            className={cn(
              flushEmbed
                ? 'min-w-0 flex-1 basis-0 whitespace-nowrap rounded-md px-1.5 py-1.5 text-center text-[9px] font-semibold uppercase tracking-[0.06em] transition-all duration-200 sm:px-2 sm:text-[10px]'
                : 'shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.06em] transition-all duration-200 sm:px-3.5 sm:py-1.5 sm:text-[10px]',
              billing === 'monthly' ? toggleActive : toggleInactive,
            )}
            aria-pressed={billing === 'monthly'}
          >
            Mensual
          </button>
          <button
            type="button"
            onClick={() => onBillingChange('months3')}
            className={cn(
              flushEmbed
                ? 'min-w-0 flex-1 basis-0 whitespace-nowrap rounded-md px-1.5 py-1.5 text-center text-[9px] font-semibold uppercase tracking-[0.06em] transition-all duration-200 sm:px-2 sm:text-[10px]'
                : 'shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.06em] transition-all duration-200 sm:px-3.5 sm:py-1.5 sm:text-[10px]',
              billing === 'months3' ? toggleActive : toggleInactive,
            )}
            aria-pressed={billing === 'months3'}
          >
            x3 meses
          </button>
          <button
            type="button"
            onClick={() => onBillingChange('months6')}
            className={cn(
              flushEmbed
                ? 'min-w-0 flex-1 basis-0 whitespace-nowrap rounded-md px-1.5 py-1.5 text-center text-[9px] font-semibold uppercase tracking-[0.06em] transition-all duration-200 sm:px-2 sm:text-[10px]'
                : 'shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.06em] transition-all duration-200 sm:px-3.5 sm:py-1.5 sm:text-[10px]',
              billing === 'months6' ? toggleActive : toggleInactive,
            )}
            aria-pressed={billing === 'months6'}
          >
            x6 meses
          </button>
          <button
            type="button"
            onClick={() => onBillingChange('annual')}
            className={cn(
              flushEmbed
                ? 'min-w-0 flex-1 basis-0 whitespace-nowrap rounded-md px-1.5 py-1.5 text-center text-[9px] font-semibold uppercase tracking-[0.06em] transition-all duration-200 sm:px-2 sm:text-[10px]'
                : 'shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.06em] transition-all duration-200 sm:px-3.5 sm:py-1.5 sm:text-[10px]',
              billing === 'annual' ? toggleActive : toggleInactive,
            )}
            aria-pressed={billing === 'annual'}
          >
            Anual
          </button>
        </div>
      </div>

      <div
        className={cn(
          'flex flex-col',
          flushEmbed ? 'mt-2 gap-2.5' : lightChrome ? 'mt-1.5 gap-2 sm:gap-2' : 'gap-2',
          darkInsetChrome && 'mt-2.5',
        )}
      >
        {plans.map((plan) => {
          const isSelected = selectedPlanId === plan.id
          const badgeCls = badgeChipClass(plan.badge, badgeVariant, darkChrome)
          const priceMain =
            billing === 'monthly'
              ? plan.priceMonthlyDisplay
              : billing === 'months3'
                ? plan.price3MonthsDisplay
                : billing === 'months6'
                  ? plan.price6MonthsDisplay
                  : plan.priceYearlyDisplay
          const priceSub =
            billing === 'monthly'
              ? 'Por mes'
              : billing === 'months3'
                ? 'Total · 3 meses'
                : billing === 'months6'
                  ? 'Total · 6 meses'
                  : 'Por año · pago único'

          return (
            <motion.div
              key={plan.id}
              role="button"
              tabIndex={0}
              title={plan.description?.trim() || undefined}
              onClick={() => onSelectPlan(plan.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectPlan(plan.id)
                }
              }}
              transition={{ type: 'spring', bounce: 0.35, duration: 0.55 }}
              className={cn(
                'relative cursor-pointer overflow-hidden outline-none transition-colors duration-200',
                'focus-visible:ring-2 focus-visible:ring-offset-0',
                !flushEmbed && (lightChrome || darkChrome) && 'rounded-[14px]',
                !flushEmbed && !lightChrome && !darkChrome && 'rounded-[18px]',
                flushEmbed && 'rounded-lg',
                'focus-visible:ring-white/25',
                isSelected ? selectedRing : unselectedRow,
              )}
            >
              <div className={cn(flushEmbed ? 'px-2.5 py-2 sm:px-3' : 'px-3 py-2.5 sm:px-4 sm:py-3.5', darkChrome && !flushEmbed && 'py-2 sm:py-2.5')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <div className="mt-px shrink-0">
                      <div
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded-full border transition-all duration-200 sm:h-4.5 sm:w-4.5',
                          isSelected
                            ? darkChrome
                              ? 'border-[rgb(255,72,0)] bg-[rgb(255,72,0)] shadow-[0_0_8px_rgba(255,72,0,0.4)]'
                              : 'border-zinc-700 bg-zinc-800'
                            : lightChrome
                              ? 'border-surface-border bg-white'
                              : 'border-white/20 bg-transparent',
                        )}
                        aria-hidden
                      >
                        {isSelected ? (
                          <Check size={9} strokeWidth={3} className="text-white" />
                        ) : null}
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            'leading-snug transition-all duration-200',
                            isSelected
                              ? 'text-[14px] font-semibold'
                              : 'text-[13px] font-medium',
                            darkChrome ? 'text-white/95' : 'text-neutral-900',
                          )}
                        >
                          {plan.name}
                        </span>
                        {plan.badge?.trim() ? (
                          <span className={cn('rounded-md px-2 py-[3px] text-[9px] font-semibold uppercase tracking-[0.08em]', badgeCls)}>
                            {plan.badge.trim()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end">
                    <div
                      className={cn(
                        'text-[13px] font-semibold leading-none tabular-nums',
                        darkChrome ? 'text-white' : 'text-neutral-900',
                      )}
                    >
                      {priceMain}
                    </div>
                    <span
                      className={cn(
                        'mt-1 text-[9px] font-semibold uppercase leading-tight tracking-[0.1em]',
                        darkChrome ? 'text-white/35' : 'text-neutral-400',
                      )}
                    >
                      {priceSub}
                    </span>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isSelected ? (
                    <motion.div
                      key="features"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        opacity: { duration: 0.18 },
                        height: { duration: 0.28, ease: 'easeOut' },
                      }}
                      className="overflow-hidden"
                    >
                      <div className="mb-0.5 mt-2 pt-2 sm:mt-2.5 sm:pt-2.5">
                        <div
                          className={cn(
                            'mb-3 h-px w-full',
                            darkChrome
                              ? 'bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.05)_22%,rgba(255,255,255,0.24)_50%,rgba(255,255,255,0.05)_78%,transparent_100%)]'
                              : 'bg-[linear-gradient(90deg,transparent_0%,rgba(163,163,163,0.12)_18%,rgba(163,163,163,0.5)_50%,rgba(163,163,163,0.12)_82%,transparent_100%)]',
                          )}
                          aria-hidden
                        />
                        {plan.featureSections && plan.featureSections.length > 0 ? (
                          <WebPlanIncludesSectionsDisplay
                            sections={attachAvatarsToIncludeSectionViews(
                              plan.featureSections,
                              includeSectionAvatars,
                            )}
                            darkChrome={darkChrome}
                            listTitle={plan.featuresLabel ?? 'Incluye'}
                            showProfessionalAvatars
                            gifts={plan.gifts}
                            giftsLabel={plan.giftsLabel ?? 'De regalo'}
                          />
                        ) : plan.features.length > 0 ? (
                          <>
                            <p
                              className={cn(
                                'mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]',
                                darkChrome ? 'text-white/45' : 'text-neutral-400',
                              )}
                            >
                              {plan.featuresLabel ?? 'Incluye'}
                            </p>
                            <div className="flex flex-col gap-1.5">
                              {plan.features.map((feature, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                  <Check
                                    size={14}
                                    strokeWidth={2.8}
                                    className={cn('mt-0.5 shrink-0', darkChrome ? 'text-white/40' : 'text-ink-muted')}
                                  />
                                  <span
                                    className={cn(
                                      'text-[13px] font-medium leading-snug',
                                      darkChrome ? 'text-white/78' : 'text-neutral-600',
                                    )}
                                  >
                                    {feature.text}
                                  </span>
                                  {feature.hasInfo ? (
                                    <Info
                                      size={13}
                                      className={cn(
                                        'ml-0.5 shrink-0',
                                        darkChrome ? 'text-white/35' : 'text-neutral-300',
                                      )}
                                    />
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </>
                        ) : null}
                        {(!plan.featureSections || plan.featureSections.length === 0) &&
                        plan.gifts &&
                        plan.gifts.length > 0 ? (
                          <WebPlanIncludesSectionsDisplay
                            sections={[]}
                            darkChrome={darkChrome}
                            listTitle=""
                            gifts={plan.gifts}
                            giftsLabel={plan.giftsLabel ?? 'De regalo'}
                          />
                        ) : null}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </motion.div>
          )
        })}
      </div>

      <div
        className={cn(
          'flex flex-col items-stretch pb-1 sm:flex-row sm:items-center sm:justify-end',
          flushEmbed ? 'mt-2 gap-2' : 'mt-3 gap-2.5',
          darkChrome && !flushEmbed && 'mt-2.5',
          embedded && heroTone && !lightInsetChrome && 'px-0 pb-0',
          lightInsetChrome && 'mt-3 gap-3 px-0.5 pb-0.5 pt-1 sm:px-1 sm:pb-1',
          darkInsetChrome && 'mt-3 px-0.5 pb-0.5 pt-2 sm:border-t sm:border-white/10 sm:px-0 sm:pb-0 sm:pt-3',
          flushEmbed && cn('border-t pt-3', darkChrome ? 'border-white/[0.06]' : 'border-neutral-200/75'),
        )}
      >
        {showFooter && footerText ? (
          <span
            className={cn(
              'mr-auto max-w-[18rem] text-[10px] leading-snug sm:text-left',
              darkChrome ? 'text-white/40' : 'text-ink-muted',
            )}
          >
            {footerText}
          </span>
        ) : null}
        <button
          type="button"
          disabled={!selectedPlanId}
          onClick={() => selectedPlanId && onContinue?.()}
          className={cn(
            intakePanelPlansCtaClass,
            'active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          {buttonText}
        </button>
      </div>
    </div>
  )
}
