/**
 * Planes de /form, con el patrón de una pantalla de suscripción: a la izquierda una lista compacta
 * (nombre, para quién es y precio) y a la derecha el detalle del plan elegido. En el celu no hay
 * columna derecha: el detalle se despliega dentro de la fila elegida.
 */
import { useId, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Gift } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IntakeProAvatar, intakeProAvatarFocusForRole } from '@/components/public/intake/IntakeProAvatar'
import type { IntakeNormalizedPricingPlan, PlanBilling } from '@/lib/publicIntakePlanPricing'
import {
  attachAvatarsToIncludeSectionViews,
  type IntakeIncludeSectionAvatarMap,
} from '@/lib/webPlanIncludeSections'
import {
  INTAKE_BILLING_OPTIONS,
  intakeBillingCaption,
  intakePlanPriceFor,
  intakePlanTitle,
} from '@/lib/intake/intakePlanBilling'

const EASE = [0.16, 1, 0.3, 1] as const

/** Plazo de pago: la pastilla blanca se desliza hasta la opción elegida. */
export function IntakeBillingSwitch({ value, onChange }: { value: PlanBilling; onChange: (b: PlanBilling) => void }) {
  const id = useId()
  return (
    <div role="radiogroup" aria-label="Plazo de pago" className="grid w-full grid-cols-4 rounded-lg bg-surface-elevated p-0.5 sm:inline-grid sm:w-auto">
      {INTAKE_BILLING_OPTIONS.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'hh-focus relative h-8 rounded-md px-3 text-body-sm transition-colors',
              on ? 'font-medium text-ink-primary' : 'text-ink-muted hover:text-ink-primary',
            )}
          >
            {on ? (
              <motion.span
                layoutId={`${id}-pill`}
                className="absolute inset-0 rounded-md bg-surface-card shadow-[0_1px_2px_rgb(0_0_0/0.12),0_0_0_1px_rgb(0_0_0/0.04)]"
                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                aria-hidden
              />
            ) : null}
            <span className="relative whitespace-nowrap">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function Radio({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-200',
        on ? 'border-ink-primary bg-ink-primary' : 'border-surface-inputBorder bg-surface-card',
      )}
      aria-hidden
    >
      <motion.span
        initial={false}
        animate={{ scale: on ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 520, damping: 26 }}
        className="h-2 w-2 rounded-full bg-surface-card"
      />
    </span>
  )
}

/** Todo lo que trae un plan: por profesional (con su foto chica), y los regalos si hay. */
export function IntakePlanIncludes({
  plan,
  avatars,
  theme,
}: {
  plan: IntakeNormalizedPricingPlan
  avatars: IntakeIncludeSectionAvatarMap
  theme: 'light' | 'dark'
}) {
  const sections = attachAvatarsToIncludeSectionViews(plan.featureSections ?? [], avatars)
  const list = (items: string[]) => (
    <ul className="space-y-2">
      {items.map((text, i) => (
        <li key={i} className="flex items-start gap-2.5 text-body-sm leading-snug text-ink-secondary">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-ok-ink" strokeWidth={2.75} aria-hidden />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  )
  return (
    <div className="space-y-5">
      {sections.length > 0
        ? sections.map((s) => (
            <section key={s.professional}>
              <div className="mb-2.5 flex items-center gap-2.5">
                <IntakeProAvatar
                  label={s.title}
                  url={s.avatarUrl ?? null}
                  sizeClass="h-8 w-8"
                  theme={theme}
                  shape="circle"
                  focus={intakeProAvatarFocusForRole(s.professional)}
                  priority
                  expandable
                />
                <p className="min-w-0 text-body-sm leading-tight">
                  <span className="font-medium text-ink-primary">{s.subtitle?.trim() || s.title}</span>
                  {s.subtitle?.trim() ? <span className="text-ink-muted"> · {s.title}</span> : null}
                </p>
              </div>
              {list(s.items)}
            </section>
          ))
        : plan.features.length > 0
          ? list(plan.features.map((f) => f.text))
          : null}
      {plan.gifts && plan.gifts.length > 0 ? (
        <div className="hh-pastel rounded-xl bg-pastel-butter px-3.5 py-3">
          <p className="flex items-center gap-1.5 text-2xs font-medium text-pastel-butter-ink">
            <Gift className="h-3.5 w-3.5" aria-hidden />
            {plan.giftsLabel ?? 'De regalo'}
          </p>
          <ul className="mt-1.5 space-y-1">
            {plan.gifts.map((g, i) => (
              <li key={i} className="text-body-sm leading-snug text-ink-primary">
                {g.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/** Lista de planes: una fila por plan; la elegida se levanta sobre las demás. */
export function IntakePlanList({
  plans,
  selectedPlanId,
  onSelect,
  billing,
  renderMobileDetails,
}: {
  plans: IntakeNormalizedPricingPlan[]
  selectedPlanId: string | null
  onSelect: (id: string) => void
  billing: PlanBilling
  /** Detalle del plan elegido para pantallas angostas (en la compu va en la columna derecha). */
  renderMobileDetails?: (plan: IntakeNormalizedPricingPlan) => ReactNode
}) {
  if (plans.length === 0) return null
  return (
    <div role="radiogroup" aria-label="Planes" className="rounded-2xl border border-surface-border">
      {plans.map((plan, idx) => {
        const selected = plan.id === selectedPlanId
        const price = intakePlanPriceFor(plan, billing)
        return (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, ease: EASE, delay: Math.min(idx, 6) * 0.04 }}
            className={cn(
              'relative transition-[box-shadow,background-color] duration-200',
              selected
                ? 'z-10 -mx-1.5 rounded-xl bg-surface-card shadow-[0_0_0_1px_rgb(var(--surface-input-border)),0_10px_28px_-12px_rgb(0_0_0/0.28)]'
                : cn(
                    'hover:bg-surface-panel',
                    idx > 0 && 'border-t border-surface-border',
                    idx === 0 && 'rounded-t-2xl',
                    idx === plans.length - 1 && 'rounded-b-2xl',
                  ),
            )}
          >
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(plan.id)}
              className={cn('hh-focus flex w-full items-center gap-3.5 rounded-xl py-3.5 text-left', selected ? 'px-[1.375rem]' : 'px-4')}
            >
              <Radio on={selected} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium leading-tight text-ink-primary">{intakePlanTitle(plan.name)}</span>
                {plan.badge?.trim() ? (
                  <span className="mt-0.5 block truncate text-2xs text-ink-muted">{intakePlanTitle(plan.badge)}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-right">
                <span className="block overflow-hidden text-lg font-semibold leading-tight tabular-nums tracking-tight text-ink-primary">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={price}
                      initial={{ y: 12, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -12, opacity: 0 }}
                      transition={{ duration: 0.22, ease: EASE }}
                      className="inline-block"
                    >
                      {price}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <span className="mt-0.5 block text-2xs text-ink-muted">{intakeBillingCaption(billing)}</span>
              </span>
            </button>

            {renderMobileDetails ? (
              <AnimatePresence initial={false}>
                {selected ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ height: { duration: 0.3, ease: EASE }, opacity: { duration: 0.2 } }}
                    className="overflow-hidden lg:hidden"
                  >
                    <div className="mx-[1.375rem] border-t border-dashed border-surface-border pb-4 pt-4">{renderMobileDetails(plan)}</div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            ) : null}
          </motion.div>
        )
      })}
    </div>
  )
}
