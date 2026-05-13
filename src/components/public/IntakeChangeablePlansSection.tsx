/**
 * Bloque tipo changeable-pricing (referencia tipo Watermelon).
 * `tone="card"`: en `uiTheme="light"` usa cromado claro embebido; en `uiTheme="dark"` mismo layout con superficies oscuras.
 */
import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type PlanBilling,
  type IntakeNormalizedPricingPlan,
} from '@/lib/publicIntakePlanPricing'

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
}

function normalizeBadgeClass(variant: 'green' | 'amber', dark: boolean) {
  if (variant === 'amber') {
    return dark
      ? 'border border-white/12 bg-black/25 text-white/75'
      : 'border border-amber-200/90 bg-amber-50 text-amber-900'
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
      return [
        'border border-neutral-200/90 bg-gradient-to-b from-white via-neutral-50/50 to-neutral-100/45',
        'shadow-[0_5px_22px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.95)]',
        'ring-1 ring-neutral-900/[0.045]',
      ].join(' ')
    }
    if (badgeVariant === 'amber') {
      return darkChrome
        ? 'border border-white/[0.11] bg-white/[0.045] border-l-[2px] border-l-white/32 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]'
        : 'ring-[1px] ring-neutral-300 bg-white shadow-sm dark:ring-neutral-600 dark:bg-transparent'
    }
    return darkChrome
      ? 'border border-white/[0.12] bg-white/[0.055] border-l-[2px] border-l-white/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]'
      : 'ring-[1px] ring-neutral-300 shadow-sm dark:shadow-none dark:ring-neutral-600'
  }, [badgeVariant, darkChrome, lightChrome])

  const unselectedRow = lightChrome
    ? [
        'border border-neutral-200/90 bg-gradient-to-b from-white to-neutral-50/75',
        'shadow-[0_2px_12px_rgba(15,23,42,0.05)] ring-1 ring-neutral-900/[0.03]',
        'hover:border-neutral-300/95 hover:shadow-[0_6px_22px_rgba(15,23,42,0.09)]',
      ].join(' ')
    : darkChrome
      ? 'bg-black/25 ring-1 ring-white/10 shadow-none hover:bg-white/[0.07] hover:ring-white/15'
      : 'shadow-sm ring-1 ring-neutral-200/80 dark:shadow-none dark:ring-neutral-800 hover:ring-neutral-300 dark:hover:ring-neutral-700'

  if (plans.length === 0) return null

  const toggleActive =
    darkChrome
      ? 'bg-white text-neutral-900 shadow-[0_2px_10px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.05]'
      : 'bg-white text-neutral-900 shadow-[0_2px_8px_rgba(15,23,42,0.08)] ring-1 ring-neutral-900/[0.04]'
  const toggleInactive =
    darkChrome ? 'text-white/45 hover:text-white/72' : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'

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
            flushEmbed ? (lightChrome ? 'text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500' : 'text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42') : heroTone ? 'text-xs uppercase tracking-[0.16em] text-white/55' : darkChrome && !heroTone ? 'text-xs uppercase tracking-[0.14em] text-white/50' : lightChrome ? 'text-[15px] text-neutral-800' : 'text-[17px] font-medium text-neutral-800 dark:text-neutral-100',
          )}
        >
          {title}
        </h2>
        <div
          className={cn(
            flushEmbed
              ? 'flex w-full min-w-0 flex-nowrap overflow-x-auto rounded-xl p-1 [-webkit-overflow-scrolling:touch] scrollbar-hide'
              : 'inline-flex max-w-full flex-nowrap self-start overflow-x-auto rounded-xl p-1 [-webkit-overflow-scrolling:touch] scrollbar-hide sm:self-auto',
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
                ? 'min-w-0 flex-1 basis-0 whitespace-nowrap rounded-lg px-1.5 py-1.5 text-center text-[8px] font-bold uppercase tracking-[0.04em] transition-all duration-200 sm:px-2 sm:text-[9px] sm:tracking-[0.06em]'
                : 'shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.06em] transition-all duration-200 sm:px-3.5 sm:py-1.5 sm:text-[10px]',
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
                ? 'min-w-0 flex-1 basis-0 whitespace-nowrap rounded-lg px-1.5 py-1.5 text-center text-[8px] font-bold uppercase tracking-[0.04em] transition-all duration-200 sm:px-2 sm:text-[9px] sm:tracking-[0.06em]'
                : 'shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.06em] transition-all duration-200 sm:px-3.5 sm:py-1.5 sm:text-[10px]',
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
                ? 'min-w-0 flex-1 basis-0 whitespace-nowrap rounded-lg px-1.5 py-1.5 text-center text-[8px] font-bold uppercase tracking-[0.04em] transition-all duration-200 sm:px-2 sm:text-[9px] sm:tracking-[0.06em]'
                : 'shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.06em] transition-all duration-200 sm:px-3.5 sm:py-1.5 sm:text-[10px]',
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
                ? 'min-w-0 flex-1 basis-0 whitespace-nowrap rounded-lg px-1.5 py-1.5 text-center text-[8px] font-bold uppercase tracking-[0.04em] transition-all duration-200 sm:px-2 sm:text-[9px] sm:tracking-[0.06em]'
                : 'shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.06em] transition-all duration-200 sm:px-3.5 sm:py-1.5 sm:text-[10px]',
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
                flushEmbed && 'rounded-xl',
                darkChrome
                  ? 'focus-visible:ring-white/18'
                  : lightChrome
                    ? 'focus-visible:ring-neutral-400/35'
                    : 'focus-visible:ring-neutral-400/40 dark:focus-visible:ring-neutral-500/40',
                isSelected ? selectedRing : unselectedRow,
              )}
            >
              <div className={cn(flushEmbed ? 'px-2.5 py-2 sm:px-3' : 'px-3 py-2.5 sm:px-4 sm:py-3.5', darkChrome && !flushEmbed && 'py-2 sm:py-2.5')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <div className="mt-px shrink-0">
                      <div
                        className={cn(
                          'flex h-3.5 w-3.5 items-center justify-center rounded border transition-colors sm:h-4 sm:w-4',
                          isSelected
                            ? 'border-brand-primary bg-brand-primary text-white shadow-sm'
                            : lightChrome
                              ? 'border-neutral-300 bg-white'
                              : darkChrome
                                ? 'border-white/30 bg-transparent'
                                : 'border-neutral-300 bg-white dark:border-neutral-600 dark:bg-transparent',
                        )}
                        aria-hidden
                      >
                        {isSelected ? (
                          <Check size={9} strokeWidth={2.75} className="text-white" />
                        ) : null}
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            'text-[12px] font-semibold leading-tight sm:text-[13px]',
                            darkChrome ? 'text-white' : 'text-neutral-900',
                          )}
                        >
                          {plan.name}
                        </span>
                        {plan.badge?.trim() ? (
                          <span className={cn('rounded-full px-2 py-[3px] text-[8px] font-bold uppercase tracking-wider', badgeCls)}>
                            {plan.badge.trim()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end">
                    <div
                      className={cn(
                        'text-[13px] font-bold leading-none tabular-nums sm:text-[14px]',
                        darkChrome ? 'text-white' : 'text-neutral-900',
                      )}
                    >
                      {priceMain}
                    </div>
                    <span
                      className={cn(
                        'mt-1 text-[8px] font-bold uppercase leading-tight tracking-[0.12em]',
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
                      <div className="mb-0.5 mt-3 pt-3 sm:mt-3.5 sm:pt-3.5">
                        <div
                          className={cn(
                            'mb-3 h-px w-full',
                            darkChrome
                              ? 'bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.05)_22%,rgba(255,255,255,0.24)_50%,rgba(255,255,255,0.05)_78%,transparent_100%)]'
                              : 'bg-[linear-gradient(90deg,transparent_0%,rgba(163,163,163,0.12)_18%,rgba(163,163,163,0.5)_50%,rgba(163,163,163,0.12)_82%,transparent_100%)]',
                          )}
                          aria-hidden
                        />
                        {plan.features.length > 0 ? (
                          <p
                            className={cn(
                              'mb-2 text-[9px] font-bold uppercase tracking-[0.14em]',
                              darkChrome ? 'text-white/40' : 'text-neutral-400',
                            )}
                          >
                            {plan.featuresLabel ?? 'Incluye'}
                          </p>
                        ) : null}
                        <div className="flex flex-col gap-1.5">
                          {plan.features.map((feature, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <Check
                                size={14}
                                strokeWidth={2.8}
                                className={cn('mt-0.5 shrink-0', darkChrome ? 'text-emerald-400/95' : 'text-emerald-600')}
                              />
                              <span
                                className={cn(
                                  'text-[11px] leading-tight sm:text-[12px]',
                                  darkChrome ? 'text-white/80' : 'text-neutral-600',
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
                        {plan.gifts && plan.gifts.length > 0 ? (
                          <>
                            <p
                              className={cn(
                                'mb-2 mt-4 text-[9px] font-bold uppercase tracking-[0.14em]',
                                darkChrome ? 'text-white/40' : 'text-neutral-400',
                              )}
                            >
                              {plan.giftsLabel ?? 'De regalo'}
                            </p>
                            <div className="flex flex-col gap-1.5">
                              {plan.gifts.map((g, gidx) => (
                                <div key={`g-${gidx}`} className="flex items-start gap-2">
                                  <Check
                                    size={14}
                                    strokeWidth={2.8}
                                    className={cn('mt-0.5 shrink-0', darkChrome ? 'text-amber-400/90' : 'text-amber-600')}
                                  />
                                  <span
                                    className={cn(
                                      'text-[11px] leading-tight sm:text-[12px]',
                                      darkChrome ? 'text-white/78' : 'text-neutral-600',
                                    )}
                                  >
                                    {g.text}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </>
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
          'flex flex-col items-stretch pb-1 sm:flex-row sm:items-center sm:justify-between',
          flushEmbed ? 'mt-2 gap-2 sm:gap-3' : 'mt-3 gap-2.5',
          darkChrome && !flushEmbed && 'mt-2.5',
          embedded && heroTone && !lightInsetChrome && 'px-0 pb-0',
          lightInsetChrome && 'mt-3 gap-3 px-0.5 pb-0.5 pt-1 sm:px-1 sm:pb-1',
          darkInsetChrome && 'mt-3 px-0.5 pb-0.5 pt-2 sm:border-t sm:border-white/10 sm:px-0 sm:pb-0 sm:pt-3',
          flushEmbed && cn('border-t pt-3', darkChrome ? 'border-white/[0.06]' : 'border-neutral-200/75'),
        )}
      >
        <span
          className={cn(
            flushEmbed
              ? cn(
                  'max-w-[18rem] text-center text-[8px] font-medium uppercase leading-snug tracking-[0.08em] sm:text-left',
                  lightChrome ? 'text-neutral-500' : 'text-white/38',
                )
              : 'max-w-[16rem] text-center text-[8px] font-bold uppercase leading-relaxed tracking-[0.12em] sm:max-w-[14rem] sm:text-left sm:text-[9px]',
            !flushEmbed && (darkChrome ? 'text-white/45' : 'text-neutral-500'),
          )}
        >
          {footerText}
        </span>
        <button
          type="button"
          disabled={!selectedPlanId}
          onClick={() => selectedPlanId && onContinue?.()}
          className={cn(
            'w-full shrink-0 rounded-xl px-5 py-2.5 text-[12px] font-semibold outline-none transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:px-7 sm:text-[13px]',
            flushEmbed && 'py-2 sm:py-2',
            darkChrome
              ? 'border border-white/14 bg-white/[0.07] text-white hover:bg-white/[0.11] focus-visible:ring-1 focus-visible:ring-white/25 focus-visible:ring-offset-0'
              : lightChrome || !embedded
              ? 'border border-neutral-200/95 bg-gradient-to-b from-white to-neutral-50/90 text-neutral-900 shadow-[0_3px_14px_rgba(15,23,42,0.07)] hover:bg-neutral-50/95 focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-100'
              : 'border border-neutral-600 bg-neutral-800 px-8 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-neutral-700 focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950',
          )}
        >
          {buttonText}
        </button>
      </div>
    </div>
  )
}
